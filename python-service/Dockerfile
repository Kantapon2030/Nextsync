FROM python:3.11-slim
WORKDIR /app

# Install system deps required by OpenCV/DeepFace (libGL renamed in Debian trixie)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download and cache DeepFace models (ArcFace + SSD + OpenCV detectors)
# to avoid first-request timeout crashes on Render / Vercel
RUN python -c "from deepface import DeepFace; import numpy as np; dummy = np.zeros((224, 224, 3), dtype=np.uint8); DeepFace.represent(dummy, model_name='ArcFace', detector_backend='opencv', enforce_detection=False); DeepFace.represent(dummy, model_name='ArcFace', detector_backend='ssd', enforce_detection=False)"

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
