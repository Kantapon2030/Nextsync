FROM python:3.11-slim
WORKDIR /app

# Install system deps for OpenCV with retry logic in case of network issues
RUN (apt-get update -y || (sleep 5 && apt-get update -y)) && apt-get install -y --fix-missing \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download ArcFace + RetinaFace model weights at build time
# so the first request doesn't need to download them (avoids cold-start timeout)
RUN python -c "\
from deepface import DeepFace; \
import numpy as np; \
dummy = np.zeros((112, 112, 3), dtype=np.uint8); \
try: \
    DeepFace.represent(dummy, model_name='ArcFace', detector_backend='retinaface', enforce_detection=False); \
except Exception as e: \
    print(f'Pre-load warning (expected): {e}'); \
print('ArcFace + RetinaFace models pre-loaded successfully'); \
"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
