// lib/faceApi.ts
// Client library for the ArcFace Python microservice (DeepFace / FastAPI)
// All face operations (enroll + extract) go through this service for consistent 512-dim embeddings.

const FACE_API_URL = process.env.FACE_API_URL ?? "http://localhost:8000";
const FACE_API_SECRET = process.env.FACE_API_SECRET ?? "";

/** Optional auth header for inter-service requests */
function authHeaders(): Record<string, string> {
  if (!FACE_API_SECRET) return {};
  return { Authorization: `Bearer ${FACE_API_SECRET}` };
}

// ── Enroll ──────────────────────────────────────────────────────────────────
/**
 * Send 1–3 face image Files to the Python service.
 * Returns the 512-dim mean ArcFace embedding for DB storage.
 * Throws if no face is detected in any image.
 */
export async function enrollFace(imageFiles: File[]): Promise<number[]> {
  const form = new FormData();
  imageFiles.forEach((f, i) => {
    // Python service expects image1, image2, image3
    form.append(`image${i + 1}`, f);
  });

  let res: Response;
  try {
    res = await fetch(`${FACE_API_URL}/enroll`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
  } catch (e: any) {
    throw new Error(`ไม่สามารถเชื่อมต่อ Face API ได้: ${e.message}`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail ?? "Face enrollment failed");
  }

  const data = await res.json();

  if (data.dim !== 512) {
    throw new Error(
      `Face API returned unexpected embedding dimension: ${data.dim} (expected 512)`
    );
  }

  return data.embedding as number[];
}

// ── Extract ──────────────────────────────────────────────────────────────────
/**
 * Send one event photo (Buffer) to the Python service.
 * Returns all faces found in that image with their embeddings + bboxes.
 * Used by the pipeline to build the photo face search index.
 */
export async function extractFaces(
  imageBuffer: Buffer,
  filename: string
): Promise<{
  faces: Array<{
    embedding: number[];
    bbox: { x: number; y: number; w: number; h: number };
    confidence: number;
  }>;
}> {
  const form = new FormData();
  form.append(
    "image",
    new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" }),
    filename
  );

  try {
    const res = await fetch(`${FACE_API_URL}/extract`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });

    if (!res.ok) {
      console.warn(`[faceApi] /extract returned ${res.status} for ${filename}`);
      return { faces: [] };
    }

    const data = await res.json();
    return { faces: data.faces ?? [] };
  } catch (e: any) {
    console.warn(`[faceApi] /extract request failed for ${filename}: ${e.message}`);
    return { faces: [] };
  }
}
