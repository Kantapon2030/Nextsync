import sys
import io
import os
import gc
import traceback

# ─── TensorFlow CPU Memory/Threading Optimization ───────────────────────────
# Set environment variables BEFORE importing deepface / tensorflow
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["TF_NUM_INTRAOP_THREADS"] = "1"
os.environ["TF_NUM_INTEROP_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["TF_USE_LEGACY_KERAS"] = "1"

# Force stdout and stderr to use UTF-8 encoding on Windows to prevent UnicodeEncodeErrors with emojis
if sys.platform.startswith('win'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    import tensorflow as tf
    # Limit runtime threading for low-RAM containers
    tf.config.threading.set_inter_op_parallelism_threads(1)
    tf.config.threading.set_intra_op_parallelism_threads(1)
    # Disable GPU memory pre-allocation (prevent GPU growth leaks if running on system with GPU)
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
except Exception:
    pass

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from deepface import DeepFace
import numpy as np
import cv2

FACE_API_SECRET = os.getenv("FACE_API_SECRET", "")

app = FastAPI(title="Nextsync Face API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


def verify_secret(request: Request):
    """Validate FACE_API_SECRET from Authorization header."""
    if not FACE_API_SECRET:
        return  # No secret configured, skip check (dev mode)
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    if token != FACE_API_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

MODEL_NAME = "ArcFace"        # 512-dim, best accuracy
# Default to 'ssd' on Render (512MB RAM) to avoid OOM crashes, otherwise use 'retinaface'
is_render = os.getenv("RENDER", "false").lower() == "true"
default_detector = "ssd" if is_render else "retinaface"
DETECTOR = os.getenv("DETECTOR_BACKEND", default_detector)
DISTANCE_METRIC = "cosine"


def image_from_bytes(file_bytes: bytes) -> np.ndarray:
    """Convert raw bytes → BGR numpy array."""
    arr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="ไม่สามารถอ่านไฟล์รูปได้ กรุณาส่งไฟล์ภาพที่ถูกต้อง")
    return img


def get_embedding(img: np.ndarray, detector: str = DETECTOR) -> list:
    """Extract ArcFace embedding from image (returns largest face)."""
    try:
        results = DeepFace.represent(
            img_path=img,
            model_name=MODEL_NAME,
            detector_backend=detector,
            enforce_detection=True,
            align=True,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"ตรวจไม่พบใบหน้าในรูปนี้: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการประมวลผล: {str(e)}")

    if not results:
        raise HTTPException(status_code=400, detail="ตรวจไม่พบใบหน้าในรูปนี้")

    # Return embedding of the largest face (highest w value)
    best = sorted(results, key=lambda x: x["facial_area"]["w"], reverse=True)[0]
    return best["embedding"]  # list[float] of length 512


# ─── Health check ────────────────────────────────────────────
@app.get("/")
async def health():
    return {"status": "ok", "model": MODEL_NAME, "detector": DETECTOR}


# ─── Endpoint 1: Enroll ──────────────────────────────────────
@app.post("/enroll")
async def enroll(
    request: Request,
    image1: UploadFile = File(...),
    image2: UploadFile = File(None),
    image3: UploadFile = File(None),
):
    verify_secret(request)
    """
    Receive 1–3 face images, return mean ArcFace 512-dim embedding.
    Used for user registration/re-enrollment.
    """
    embeddings = []

    # Use a lighter detector ('opencv') for enrollment to fit within Render Free tier (512MB RAM).
    # Enrollment is always close-up frontal face, so opencv is extremely fast and sufficient.
    for upload in [image1, image2, image3]:
        if upload is None:
            continue
        raw = await upload.read()
        img = image_from_bytes(raw)
        try:
            emb = get_embedding(img, detector="opencv")
            embeddings.append(emb)
        except HTTPException:
            pass  # Skip images where no face detected

    # Clean up memory immediately after processing
    gc.collect()

    if not embeddings:
        raise HTTPException(
            status_code=400,
            detail="ตรวจไม่พบใบหน้าในรูปที่ส่งมาทั้งหมด กรุณาถ่ายใหม่ในที่แสงสว่าง",
        )

    # Average embeddings from multiple angles for better accuracy
    mean_emb = np.mean(embeddings, axis=0).tolist()

    return {
        "embedding": mean_emb,
        "dim": len(mean_emb),
        "faces_detected": len(embeddings),
        "model": MODEL_NAME,
    }


# ─── Endpoint 2: Extract ─────────────────────────────────────
@app.post("/extract")
async def extract(request: Request, image: UploadFile = File(...)):
    verify_secret(request)
    """
    Extract embeddings for ALL faces in one photo.
    Used by the pipeline to index event photos.
    Returns list of { embedding, bbox, confidence }.
    """
    raw = await image.read()
    img = image_from_bytes(raw)

    try:
        results = DeepFace.represent(
            img_path=img,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR,
            enforce_detection=False,  # Don't throw if no faces found
            align=True,
        )
    except Exception as e:
        traceback.print_exc()
        gc.collect()
        return {"faces": [], "count": 0, "error": str(e)}

    # Clean up memory immediately after processing
    gc.collect()

    if not results:
        return {"faces": [], "count": 0}

    faces = []
    for r in results:
        # Filter out very low confidence detections
        conf = r.get("face_confidence", 0.0)
        if conf < 0.5 and conf != 0.0:
            continue
        faces.append({
            "embedding": r["embedding"],   # 512-dim list
            "bbox": r["facial_area"],       # {x, y, w, h}
            "confidence": conf,
        })

    return {"faces": faces, "count": len(faces)}


# ─── Endpoint 3: Compare (debug/test) ────────────────────────
@app.post("/compare")
async def compare(
    request: Request,
    image1: UploadFile = File(...),
    image2: UploadFile = File(...),
):
    """Compare two face images. For debugging and threshold tuning."""
    verify_secret(request)
    raw1 = await image1.read()
    raw2 = await image2.read()
    img1 = image_from_bytes(raw1)
    img2 = image_from_bytes(raw2)

    try:
        result = DeepFace.verify(
            img1_path=img1,
            img2_path=img2,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR,
            distance_metric=DISTANCE_METRIC,
            enforce_detection=True,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "verified": result["verified"],
        "distance": result["distance"],      # cosine distance (lower = more similar)
        "threshold": result["threshold"],    # default ~0.40 for ArcFace cosine
        "model": MODEL_NAME,
        "metric": DISTANCE_METRIC,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
