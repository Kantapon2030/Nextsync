# pipeline/01_quality_filter.py
import cv2
import numpy as np

def calculate_blur(image_gray):
    """
    Calculate the focus measure of the image using the Variance of Laplacian method.
    Higher values mean sharper images; lower values mean more blur.
    """
    return cv2.Laplacian(image_gray, cv2.CV_64F).var()

def calculate_brightness(image_hsv):
    """
    Calculate the average brightness of the image (0.0 to 1.0) using the Value channel in HSV.
    """
    v_channel = image_hsv[:, :, 2]
    return float(np.mean(v_channel) / 255.0)

def calculate_ear(landmarks):
    """
    Calculate Eye Aspect Ratio (EAR) if 106 landmarks are available.
    InsightFace 2d-106 landmark indices for eyes:
    Left eye: outline indices
    Right eye: outline indices
    If only 5 keypoints are provided, we cannot calculate EAR accurately, so we return a default of 0.25 (open).
    """
    if landmarks is None or len(landmarks) < 106:
        # Default fallback value representing open eyes
        return 0.25
        
    try:
        # Landmark indices for Left Eye:
        # 35, 36, 37, 38, 39, 40, 41, 42
        # Vertical distances:
        p36 = landmarks[36]
        p40 = landmarks[40]
        p38 = landmarks[38]
        p42 = landmarks[42]
        
        # Horizontal distance:
        p35 = landmarks[35]
        p39 = landmarks[39]
        
        left_ear = (np.linalg.norm(p36 - p40) + np.linalg.norm(p38 - p42)) / (2.0 * np.linalg.norm(p35 - p39))
        
        # Landmark indices for Right Eye:
        # 89, 90, 91, 92, 93, 94, 95, 96
        # Vertical distances:
        p90 = landmarks[90]
        p94 = landmarks[94]
        p92 = landmarks[92]
        p96 = landmarks[96]
        
        # Horizontal distance:
        p89 = landmarks[89]
        p93 = landmarks[93]
        
        right_ear = (np.linalg.norm(p90 - p94) + np.linalg.norm(p92 - p96)) / (2.0 * np.linalg.norm(p89 - p93))
        
        return float((left_ear + right_ear) / 2.0)
    except Exception as e:
        print(f"Error calculating EAR: {e}")
        return 0.25

def evaluate_quality(image_path, thresholds):
    """
    Evaluates image quality based on thresholds.
    thresholds dict keys: blur_min, brightness_min, brightness_max
    Returns: (is_approved, reject_reason, scores_dict)
    """
    # Read image
    img = cv2.imread(image_path)
    if img is None:
        return False, "corrupted", {"blur": 0.0, "brightness": 0.0}
        
    # Convert to grayscale and HSV
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # Calculate scores
    blur_score = calculate_blur(gray)
    brightness_score = calculate_brightness(hsv)
    
    scores = {
      "blur": blur_score,
      "brightness": brightness_score
    }
    
    # Validate against thresholds
    if blur_score < thresholds.get("blur_min", 80.0):
        return False, "blur", scores
        
    if brightness_score < thresholds.get("brightness_min", 0.12):
        return False, "dark", scores
        
    if brightness_score > thresholds.get("brightness_max", 0.88):
        return False, "bright", scores
        
    return True, None, scores
