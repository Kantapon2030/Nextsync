---
title: ShotSync Face API
emoji: 📸
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
---

# ShotSync Face API

DeepFace + ArcFace face recognition service for ShotSync platform.

**ArcFace-powered face enrollment & similarity search API**  
Built with [DeepFace](https://github.com/serengil/deepface) + [FastAPI](https://fastapi.tiangolo.com/), deployed as a Docker Space on Hugging Face.

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | ❌ | Health check — model status, uptime |
| `GET` | `/warmup` | ❌ | Warm model cache with dummy image |
| `POST` | `/enroll` | ✅ | Enroll 1–3 face images → 512-dim ArcFace embedding |
| `POST` | `/extract` | ✅ | Extract all face embeddings from one photo |
| `POST` | `/compare` | ✅ | Compare two faces (debug/threshold tuning) |

✅ = Requires `Authorization: Bearer <FACE_API_SECRET>` header

---

## Space Secrets (set in HF Space Settings → Secrets)

| Secret Name | Description |
|-------------|-------------|
| `FACE_API_SECRET` | API token for all authenticated endpoints |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (e.g. `https://your-app.vercel.app`) |
| `DETECTOR_BACKEND` | *(optional)* Face detector: `retinaface` (default) or `ssd` |

> **Never** commit secret values to this repo. Always use HF Space Secrets.

---

## Model Info

- **Recognition model**: ArcFace (512-dimensional embedding)
- **Default detector**: `retinaface` (high accuracy)
- **Distance metric**: Cosine similarity
- **Recommended threshold**: ≤ 0.40 → same person

The ArcFace model weights (~170 MB) are **pre-baked into the Docker image** at build time,  
so there is no network download on container startup.

---

## Local Development

```bash
# Build image
cd python-service
docker build -t shotsync-face-api .

# Run locally (mirrors HF Spaces environment)
docker run -p 7860:7860 \
  -e FACE_API_SECRET=dev-secret \
  -e ALLOWED_ORIGINS=http://localhost:3000 \
  shotsync-face-api

# Verify
curl http://localhost:7860/health
curl http://localhost:7860/warmup
```

---

## Estimated Build & Runtime

| Metric | Value |
|--------|-------|
| Docker image size | ~3.5–4.5 GB (TF + model weights) |
| First build time | ~15–25 min (on HF CI) |
| Subsequent builds | ~3–5 min (layer cache) |
| Cold-start time | ~10–20 s (TF graph init) |
| RAM usage (idle) | ~1.2 GB |
| RAM usage (under load) | ~2–3 GB |

---

## Architecture

```
Next.js App (Vercel)
       │
       │  HTTPS + Bearer token
       ▼
Hugging Face Spaces (Docker)
  └── FastAPI :7860
        ├── /enroll   → DeepFace ArcFace → 512-dim vector
        ├── /extract  → all faces in photo → list of vectors
        └── /compare  → cosine distance between two faces
                              │
                    stored in Neon PostgreSQL
                    (pgvector for similarity search)
```
