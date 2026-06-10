# ─────────────────────────────────────────────────────────────────────────────
# ShotSync Face API — Dockerfile for Hugging Face Spaces (Docker Space)
# Target: python:3.10-slim  |  Port: 7860 (HF required)
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.10-slim

# ─── Build-time metadata ─────────────────────────────────────────────────────
LABEL maintainer="ShotSync" \
      description="DeepFace ArcFace Face API — optimised for Hugging Face Spaces" \
      version="3.0.0"

# ─── Cache directories (writable in HF Spaces sandbox) ───────────────────────
ENV HF_HOME=/tmp/hf-cache \
    DEEPFACE_HOME=/tmp/deepface-cache \
    TF_CPP_MIN_LOG_LEVEL=2 \
    TF_USE_LEGACY_KERAS=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ─── System dependencies ──────────────────────────────────────────────────────
# libgl1           → OpenCV imshow / VideoCapture (headless still needs shared lib)
# libglib2.0-0     → GLib required by OpenCV & TF
# cmake            → required to compile dlib (face detector)
# build-essential  → gcc/g++ for dlib & other C extensions
# libgomp1         → OpenMP used by dlib / sklearn
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    cmake \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# ─── Python dependencies (layer-cached before source copy) ───────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ─── Pre-bake ArcFace model into the image ───────────────────────────────────
# Runs at BUILD time so the model weights (~170 MB) live inside the image layer.
# Startup is instant — no download on every container cold-start.
RUN python -c "\
import os; \
os.makedirs('/tmp/deepface-cache', exist_ok=True); \
from deepface import DeepFace; \
import numpy as np; \
print('[BUILD] Pre-downloading ArcFace model...'); \
DeepFace.build_model('ArcFace'); \
print('[BUILD] Pre-downloading SSD detector...'); \
dummy = np.zeros((224, 224, 3), dtype=np.uint8); \
DeepFace.represent(dummy, model_name='ArcFace', detector_backend='ssd', enforce_detection=False); \
print('[BUILD] Model pre-download complete.')"

# ─── Application source ───────────────────────────────────────────────────────
COPY . .

# ─── HF Spaces requires port 7860 ────────────────────────────────────────────
EXPOSE 7860

# Single worker: ArcFace is memory-heavy; multiple workers would OOM even on 16 GB
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
