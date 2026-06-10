import sys
import io
import os
import gc
import time
import traceback
import asyncio

# ─── Platform detection ───────────────────────────────────────────────────────
is_render = os.getenv("RENDER", "false").lower() == "true"
is_hf     = os.getenv("SPACE_ID") is not None  # Hugging Face Spaces sets SPACE_ID

# ─── TensorFlow CPU Memory/Threading Optimization ────────────────────────────
# Must be set BEFORE importing deepface / tensorflow
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.environ["TF_USE_LEGACY_KERAS"]  = "1"

if is_render:
    # Restrict to 1 core only on Render to prevent OOM (512 MB free tier)
    os.environ["OMP_NUM_THREADS"]          = "1"
    os.environ["TF_NUM_INTRAOP_THREADS"]   = "1"
    os.environ["TF_NUM_INTEROP_THREADS"]   = "1"
    os.environ["MKL_NUM_THREADS"]          = "1"

# ─── UTF-8 stdout on Windows ──────────────────────────────────────────────────
if sys.platform.startswith("win"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ─── TensorFlow initialisation ────────────────────────────────────────────────
try:
    import tensorflow as tf
    if is_render:
        tf.config.threading.set_inter_op_parallelism_threads(1)
        tf.config.threading.set_intra_op_parallelism_threads(1)
    gpus = tf.config.list_physical_devices("GPU")
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

# ─── Config from environment ──────────────────────────────────────────────────
FACE_API_SECRET = os.getenv("FACE_API_SECRET", "")

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").strip()
if not allowed_origins_env:
    allowed_origins_env = "http://localhost:3000"
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

MODEL_NAME      = "ArcFace"  # 512-dim, best accuracy
default_detector = "ssd" if is_render else "retinaface"
DETECTOR         = os.getenv("DETECTOR_BACKEND", default_detector)
DISTANCE_METRIC  = "cosine"

# ─── Global state ─────────────────────────────────────────────────────────────
_model_ready  = False
_startup_time = time.time()
face_lock     = asyncio.Lock()   # serialise heavy ops to prevent RAM spikes

# ─── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="ShotSync Face API",
    version="3.0.0",
    description="ArcFace face enrollment & search — optimised for Hugging Face Spaces",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# ─── Startup: preload ArcFace model once ──────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    """
    Preload ArcFace model at startup so the first real request is instant.
    The model weights are already baked into the Docker image (build-time RUN),
    so this is just TF graph initialisation, not a network download.
    """
    global _model_ready
    print(f"[STARTUP] Platform  : {'Hugging Face Spaces' if is_hf else ('Render' if is_render else 'Local')}")
    print(f"[STARTUP] CORS origins: {allowed_origins}")
    print(f"[STARTUP] Detector  : {DETECTOR}")
    print(f"[STARTUP] Health    : /status (not /health — reserved by HF Spaces)")
    print(f"[STARTUP] Preloading ArcFace model...")

    try:
        # Build the Keras model graph in the main process (avoids cold-start on worker)
        DeepFace.build_model(MODEL_NAME)
        _model_ready = True
        print(f"[STARTUP] ArcFace model ready ✓ (took {time.time() - _startup_time:.1f}s)")
    except Exception as exc:
        # Non-fatal: requests will still work, just slower on first call
        print(f"[STARTUP] Warning — model preload failed: {exc}")


# ─── Security helper ──────────────────────────────────────────────────────────
def verify_secret(request: Request):
    """Validate FACE_API_SECRET from Authorization header."""
    auth_header = request.headers.get("Authorization")
    client_ip   = request.headers.get("x-forwarded-for") or (
        request.client.host if request.client else "unknown"
    )

    if not auth_header:
        print(f"[SECURITY] Missing Authorization header — IP: {client_ip}  path: {request.url.path}")
        raise HTTPException(status_code=401, detail="Unauthorized: Missing Authorization header")

    if not FACE_API_SECRET:
        return  # Dev mode: no secret configured → pass through

    token = auth_header.replace("Bearer ", "").strip()
    if token != FACE_API_SECRET:
        print(f"[SECURITY] Invalid token — IP: {client_ip}  path: {request.url.path}")
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")


# ─── Image helper ─────────────────────────────────────────────────────────────
def image_from_bytes(file_bytes: bytes) -> np.ndarray:
    """Convert raw bytes → BGR numpy array."""
    arr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="ไม่สามารถอ่านไฟล์รูปได้ กรุณาส่งไฟล์ภาพที่ถูกต้อง")
    return img


def get_embedding(img: np.ndarray, detector: str = DETECTOR) -> list:
    """Extract ArcFace embedding from image; returns embedding of the largest face."""
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

    best = sorted(results, key=lambda x: x["facial_area"]["w"], reverse=True)[0]
    return best["embedding"]  # list[float] len=512


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

# ─── GET / — Root (alias for /health) ────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "service": "ShotSync Face API",
        "version": "3.0.0",
        "docs": "/docs",
        "health": "/health",
    }


# ─── GET /status — UptimeRobot + Admin Panel ─────────────────────────────────
# NOTE: /health is intercepted by HF Spaces infrastructure — use /status instead
@app.get("/status")
async def status():
    """
    Lightweight health-check endpoint.
    Used by:
      • UptimeRobot (ping every 5 min to keep HF Space awake)
      • Admin Panel health-check badge
    NOTE: named /status because HF Spaces intercepts /health at proxy level.
    """
    uptime_seconds = int(time.time() - _startup_time)
    return {
        "status":   "ok",
        "model":    MODEL_NAME,
        "detector": DETECTOR,
        "model_ready": _model_ready,
        "uptime_seconds": uptime_seconds,
        "platform": "hf_spaces" if is_hf else ("render" if is_render else "local"),
    }


# ─── GET /warmup — Force model warm-up (optional) ────────────────────────────
@app.get("/warmup")
async def warmup():
    """
    Run DeepFace on a 1×1 dummy image to fully warm the model cache.
    Call this once after deploy if you want near-zero latency on the first
    real request. Does NOT require auth — safe to call publicly.
    """
    try:
        dummy = np.zeros((100, 100, 3), dtype=np.uint8)
        DeepFace.represent(
            img_path=dummy,
            model_name=MODEL_NAME,
            detector_backend="opencv",
            enforce_detection=False,
            align=False,
        )
        return {"status": "warmed", "model": MODEL_NAME}
    except Exception as exc:
        # Non-fatal: warmup is best-effort
        return {"status": "warmup_error", "detail": str(exc)}


# ─── POST /enroll ─────────────────────────────────────────────────────────────
@app.post("/enroll")
async def enroll(
    request: Request,
    image1: UploadFile = File(...),
    image2: UploadFile = File(None),
    image3: UploadFile = File(None),
):
    """
    Receive 1–3 face images, return mean ArcFace 512-dim embedding.
    Used for user registration / re-enrollment.
    """
    verify_secret(request)
    async with face_lock:
        gc.collect()
        embeddings = []

        # On Render (512 MB) use 'ssd' to avoid OOM; elsewhere use configured DETECTOR
        detector_backend = "ssd" if is_render else DETECTOR

        for upload in [image1, image2, image3]:
            if upload is None:
                continue
            raw = await upload.read()
            img = image_from_bytes(raw)
            try:
                emb = get_embedding(img, detector=detector_backend)
                embeddings.append(emb)
            except HTTPException:
                pass  # Skip images where no face was detected

        gc.collect()

        if not embeddings:
            raise HTTPException(
                status_code=400,
                detail="ตรวจไม่พบใบหน้าในรูปที่ส่งมาทั้งหมด กรุณาถ่ายใหม่ในที่แสงสว่าง",
            )

        mean_emb = np.mean(embeddings, axis=0).tolist()
        return {
            "embedding":     mean_emb,
            "dim":           len(mean_emb),
            "faces_detected": len(embeddings),
            "model":         MODEL_NAME,
        }


# ─── POST /extract ────────────────────────────────────────────────────────────
@app.post("/extract")
async def extract(request: Request, image: UploadFile = File(...)):
    """
    Extract embeddings for ALL faces in one photo.
    Used by the pipeline to index event photos.
    Returns list of { embedding, bbox, confidence }.
    """
    verify_secret(request)
    async with face_lock:
        gc.collect()
        raw = await image.read()
        img = image_from_bytes(raw)

        try:
            results = DeepFace.represent(
                img_path=img,
                model_name=MODEL_NAME,
                detector_backend=DETECTOR,
                enforce_detection=False,
                align=True,
            )
        except Exception as e:
            traceback.print_exc()
            gc.collect()
            return {"faces": [], "count": 0, "error": str(e)}

        gc.collect()

        if not results:
            return {"faces": [], "count": 0}

        faces = []
        for r in results:
            conf = r.get("face_confidence", 0.0)
            if conf < 0.5 and conf != 0.0:
                continue
            faces.append({
                "embedding":  r["embedding"],   # 512-dim list
                "bbox":       r["facial_area"], # {x, y, w, h}
                "confidence": conf,
            })

        return {"faces": faces, "count": len(faces)}


# ─── POST /compare ────────────────────────────────────────────────────────────
@app.post("/compare")
async def compare(
    request: Request,
    image1: UploadFile = File(...),
    image2: UploadFile = File(...),
):
    """Compare two face images. For debugging and threshold tuning."""
    verify_secret(request)
    async with face_lock:
        gc.collect()
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
            gc.collect()
            raise HTTPException(status_code=400, detail=str(e))

        gc.collect()
        return {
            "verified":  result["verified"],
            "distance":  result["distance"],   # cosine distance (lower = more similar)
            "threshold": result["threshold"],  # ~0.40 for ArcFace cosine
            "model":     MODEL_NAME,
            "metric":    DISTANCE_METRIC,
        }


# ─── Dev entrypoint ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 7860)))
