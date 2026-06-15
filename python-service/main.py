import os
import time

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from insightface.app import FaceAnalysis

MODEL = "buffalo_l"
MODEL_VERSION = "buffalo_l-v1"
SECRET = os.getenv("FACE_API_SECRET", "")
STARTED = time.time()
face_app = FaceAnalysis(name=MODEL, providers=["CPUExecutionProvider"])
face_app.prepare(ctx_id=-1, det_size=(640, 640))

app = FastAPI(title="ShotSync InsightFace API", version="4.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


def verify(request: Request):
    if SECRET and request.headers.get("Authorization") != f"Bearer {SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def decode(raw: bytes):
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image")
    return image


def normalized(value):
    value = np.asarray(value, dtype=np.float32)
    return value / max(float(np.linalg.norm(value)), 1e-12)


def quality(face):
    width = max(0.0, float(face.bbox[2] - face.bbox[0]))
    return min(1.0, float(face.det_score) * min(1.0, width / 120.0))


def largest_face(image):
    faces = face_app.get(image)
    if not faces:
        raise HTTPException(status_code=400, detail="No face detected")
    face = max(faces, key=lambda item: (item.bbox[2] - item.bbox[0]) * (item.bbox[3] - item.bbox[1]))
    if quality(face) < 0.55:
        raise HTTPException(status_code=400, detail="Face quality is too low")
    return face


@app.get("/")
@app.get("/status")
def status():
    return {
        "status": "ok",
        "model": MODEL,
        "model_version": MODEL_VERSION,
        "detector": "insightface-retinaface",
        "uptime_seconds": int(time.time() - STARTED),
    }


@app.post("/enroll")
async def enroll(request: Request, image1: UploadFile = File(...), image2: UploadFile = File(None), image3: UploadFile = File(None)):
    verify(request)
    templates = []
    for upload in (image1, image2, image3):
        if upload is None:
            continue
        face = largest_face(decode(await upload.read()))
        templates.append({"embedding": normalized(face.normed_embedding).tolist(), "quality": quality(face)})
    centroid = normalized(np.mean([item["embedding"] for item in templates], axis=0)).tolist()
    return {"templates": templates, "centroid": centroid, "dim": 512, "model": MODEL, "model_version": MODEL_VERSION}


@app.post("/extract")
async def extract(request: Request, image: UploadFile = File(...)):
    verify(request)
    faces = []
    for face in face_app.get(decode(await image.read())):
        if float(face.det_score) < 0.65:
            continue
        x1, y1, x2, y2 = [float(value) for value in face.bbox]
        faces.append({
            "embedding": normalized(face.normed_embedding).tolist(),
            "bbox": {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1},
            "confidence": float(face.det_score),
            "quality": quality(face),
        })
    return {"faces": faces, "count": len(faces), "model_version": MODEL_VERSION}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "7860")))
