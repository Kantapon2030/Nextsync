import sys
import io

if sys.platform.startswith('win'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import os
from deepface import DeepFace
import numpy as np
import cv2

print("Starting DeepFace test extract...")
# Create a dummy image (black image of size 224x224)
dummy = np.zeros((224, 224, 3), dtype=np.uint8)

# Draw a circle so it's not completely empty (though it won't have a face)
cv2.circle(dummy, (112, 112), 50, (255, 255, 255), -1)

try:
    print("Running represent on dummy (expecting face not found, but it should download weights first if missing)...")
    results = DeepFace.represent(
        img_path=dummy,
        model_name="ArcFace",
        detector_backend="retinaface",
        enforce_detection=False,
        align=True
    )
    print("SUCCESS! Results:", results)
except Exception as e:
    print("❌ ERROR OCCURRED:")
    import traceback
    traceback.print_exc()
print("Test completed.")
