from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from deepface import DeepFace
import numpy as np
import cv2
import os

app = FastAPI(title="Nextsync Face API", version="2.0.0")

ALLOWED_ORIGINS = [
    os.getenv("NEXTJS_URL", "http://localhost:3000"),
    "http://localhost:3000",
    "http://localhost:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

MODEL_NAME = "ArcFace"        # 512-dim, best accuracy
DETECTOR = "retinaface"       # Best for angled/makeup faces
DISTANCE_METRIC = "cosine"


def image_from_bytes(file_bytes: bytes) -> np.ndarray:
    """Convert raw bytes → BGR numpy array."""
    arr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="ไม่สามารถอ่านไฟล์รูปได้ กรุณาส่งไฟล์ภาพที่ถูกต้อง")
    return img


def get_embedding(img: np.ndarray) -> list:
    """Extract ArcFace embedding from image (returns largest face)."""
    try:
        results = DeepFace.represent(
            img_path=img,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR,
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
    image1: UploadFile = File(...),
    image2: UploadFile = File(None),
    image3: UploadFile = File(None),
):
    """
    Receive 1–3 face images, return mean ArcFace 512-dim embedding.
    Used for user registration/re-enrollment.
    """
    embeddings = []

    for upload in [image1, image2, image3]:
        if upload is None:
            continue
        raw = await upload.read()
        img = image_from_bytes(raw)
        try:
            emb = get_embedding(img)
            embeddings.append(emb)
        except HTTPException:
            pass  # Skip images where no face detected

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
async def extract(image: UploadFile = File(...)):
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
        return {"faces": [], "count": 0, "error": str(e)}

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
    image1: UploadFile = File(...),
    image2: UploadFile = File(...),
):
    """Compare two face images. For debugging and threshold tuning."""
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
