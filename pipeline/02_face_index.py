#!/usr/bin/env python3
# pipeline/02_face_index.py
# Improved face detection with CLAHE preprocessing for heavy makeup support.

import io
import os
import numpy as np
from PIL import Image

import face_recognition
import psycopg2
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload


def get_db_connection():
    """Establish a connection to the PostgreSQL database."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is missing")
    return psycopg2.connect(database_url)


def get_gdrive_service(service_account_json_path):
    """Authenticate with Google Drive using a Service Account JSON file."""
    scopes = ["https://www.googleapis.com/auth/drive.readonly"]
    creds = service_account.Credentials.from_service_account_file(
        service_account_json_path, scopes=scopes
    )
    return build("drive", "v3", credentials=creds)


def download_file_from_drive(service, file_id, local_path):
    """Download a file from Google Drive to a local path."""
    request = service.files().get_media(fileId=file_id)
    fh = io.FileIO(local_path, "wb")
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    fh.close()


def preprocess_image_for_detection(image_path: str) -> np.ndarray:
    """
    Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to improve
    face detection accuracy for heavily made-up faces.
    
    The makeup changes local contrast which can fool standard detectors.
    CLAHE normalizes local contrast without affecting color information.
    """
    try:
        import cv2
        img_bgr = cv2.imread(image_path)
        if img_bgr is None:
            raise ValueError("Cannot read image")

        # Convert to LAB color space — only apply CLAHE to L channel
        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)

        # CLAHE on luminance only
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_clahe = clahe.apply(l_channel)

        lab_clahe = cv2.merge((l_clahe, a_channel, b_channel))
        img_enhanced = cv2.cvtColor(lab_clahe, cv2.COLOR_LAB2BGR)

        # Convert BGR → RGB for face_recognition
        return cv2.cvtColor(img_enhanced, cv2.COLOR_BGR2RGB)

    except ImportError:
        # Fallback: PIL-based simple brightness boost
        img = Image.open(image_path).convert("RGB")
        img_array = np.array(img)
        mean_lum = img_array.mean()
        if mean_lum < 100:
            # Dark image: boost brightness
            boost = min(1.4, 100 / max(mean_lum, 1))
            img_array = np.clip(img_array * boost, 0, 255).astype(np.uint8)
        return img_array


def index_photo_faces(image_path: str, _face_app=None):
    """
    Detect faces and extract 128-dim embeddings compatible with face-api.js.
    
    Uses CLAHE preprocessing for better detection of heavily made-up faces.
    Uses upsample_num_times=2 for better detection of small/angled faces.
    
    Returns: list of dicts with {bbox, embedding, confidence, face_index}
    """
    # Try with CLAHE-preprocessed image first
    try:
        enhanced_array = preprocess_image_for_detection(image_path)
    except Exception as e:
        print(f"Preprocessing failed, using original: {e}")
        enhanced_array = face_recognition.load_image_file(image_path)

    # upsample_num_times=2 improves detection of small faces, faces at angles,
    # and faces with heavy makeup that alter edge patterns
    face_locations = face_recognition.face_locations(
        enhanced_array,
        model="hog",
        number_of_times_to_upsample=2
    )

    # If no faces found with enhanced image, try original
    if not face_locations:
        original = face_recognition.load_image_file(image_path)
        face_locations = face_recognition.face_locations(
            original,
            model="hog",
            number_of_times_to_upsample=2
        )
        if face_locations:
            enhanced_array = original  # use original for encoding too

    if not face_locations:
        return []

    face_encodings = face_recognition.face_encodings(enhanced_array, face_locations)
    results = []

    for i, (encoding, location) in enumerate(zip(face_encodings, face_locations)):
        top, right, bottom, left = location
        results.append({
            "face_index": i,
            "bbox": {
                "x": float(left),
                "y": float(top),
                "w": float(right - left),
                "h": float(bottom - top),
            },
            "embedding": encoding.tolist(),
            "confidence": 0.99,
        })

    return results
