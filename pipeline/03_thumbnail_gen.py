# pipeline/03_thumbnail_gen.py
import os
import boto3
import cv2
from botocore.config import Config

def get_r2_client():
    """
    Establish a connection to the Cloudflare R2 bucket using boto3.
    """
    r2_account_id = os.environ.get("R2_ACCOUNT_ID")
    r2_access_key_id = os.environ.get("R2_ACCESS_KEY_ID")
    r2_secret_access_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    
    if not all([r2_account_id, r2_access_key_id, r2_secret_access_key]):
        print("[R2 WARNING] Cloudflare R2 credentials are not fully configured. Using mock mode.")
        return None
        
    endpoint_url = f"https://{r2_account_id}.r2.cloudflarestorage.com"
    
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=r2_access_key_id,
        aws_secret_access_key=r2_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="auto"
    )

def generate_thumbnail(image_path, output_path, max_size):
    """
    Resize the image at image_path to have max dimension equal to max_size.
    Preserves aspect ratio.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not load image at {image_path}")
        
    h, w = img.shape[:2]
    
    # Calculate scale factor
    if max(h, w) <= max_size:
        # If image is smaller than max size, write it as is with jpeg compression
        cv2.imwrite(output_path, img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        return
        
    if w > h:
        new_w = max_size
        new_h = int(h * (max_size / w))
    else:
        new_h = max_size
        new_w = int(w * (max_size / h))
        
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    cv2.imwrite(output_path, resized, [int(cv2.IMWRITE_JPEG_QUALITY), 85])

def upload_thumbnail_to_r2(client, bucket_name, local_file_path, r2_key, content_type="image/jpeg"):
    """
    Upload thumbnail to R2 bucket.
    """
    if client is None:
        # Mock mode: return path representing mock URL
        r2_public_url = os.environ.get("R2_PUBLIC_URL", "")
        return f"{r2_public_url}/{r2_key}"
        
    try:
        client.upload_file(
            Filename=local_file_path,
            Bucket=bucket_name,
            Key=r2_key,
            ExtraArgs={
                "ContentType": content_type,
                "CacheControl": "public, max-age=31536000"
            }
        )
        r2_public_url = os.environ.get("R2_PUBLIC_URL", "")
        return f"{r2_public_url}/{r2_key}"
    except Exception as e:
        print(f"Failed to upload to R2 key {r2_key}: {e}")
        raise e

def create_and_upload_thumbnails(image_path, file_uuid, r2_client=None):
    """
    Create both 800px and 400px thumbnails and upload them to Cloudflare R2.
    Returns: (thumbnail_url, thumbnail_sm_url)
    """
    bucket_name = os.environ.get("R2_BUCKET_NAME", "shotsync-thumbnails")
    
    # Define temporary output paths
    temp_800 = f"temp_800_{file_uuid}.jpg"
    temp_400 = f"temp_400_{file_uuid}.jpg"
    
    try:
        # Generate locally
        generate_thumbnail(image_path, temp_800, 800)
        generate_thumbnail(image_path, temp_400, 400)
        
        # Upload keys
        key_800 = f"photos/{file_uuid}_800.jpg"
        key_400 = f"photos/{file_uuid}_400.jpg"
        
        url_800 = upload_thumbnail_to_r2(r2_client, bucket_name, temp_800, key_800)
        url_400 = upload_thumbnail_to_r2(r2_client, bucket_name, temp_400, key_400)
        
        return url_800, url_400
    finally:
        # Cleanup temp local files
        if os.path.exists(temp_800):
            os.remove(temp_800)
        if os.path.exists(temp_400):
            os.remove(temp_400)
