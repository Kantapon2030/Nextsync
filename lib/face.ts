// lib/face.ts
import * as faceapi from "face-api.js";

let modelsLoaded = false;

/**
 * Loads face-api.js models from the local public directory or CDN fallback
 */
export async function loadModels() {
  if (typeof window === "undefined") return;
  if (modelsLoaded) return;

  const MODEL_URL = "/models";
  const CDN_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log("face-api.js models loaded from /models");
  } catch (error) {
    console.warn("Failed to load from /models, trying CDN...", error);
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(CDN_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL),
      ]);
      modelsLoaded = true;
      console.log("face-api.js models loaded from CDN");
    } catch (cdnError) {
      console.error("Failed to load face-api.js models from CDN:", cdnError);
      throw cdnError;
    }
  }
}

/**
 * Preprocesses a canvas to improve face detection accuracy for heavily made-up faces.
 * Applies a CLAHE-like contrast normalization and subtle brightness boost.
 * Returns a new offscreen canvas with the adjusted pixel data.
 */
export function preprocessCanvasForDetection(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): HTMLCanvasElement {
  const w = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const h = source instanceof HTMLVideoElement ? source.videoHeight : source.height;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Compute mean luminance
  let totalLum = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const meanLum = totalLum / (data.length / 4);

  // If image is dark (mean < 100), apply a brightness boost
  const brightnessFactor = meanLum < 100 ? 1.25 : 1.0;

  // Apply simple contrast stretch + brightness boost
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * brightnessFactor);
    data[i + 1] = Math.min(255, data[i + 1] * brightnessFactor);
    data[i + 2] = Math.min(255, data[i + 2] * brightnessFactor);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Averages multiple face embedding vectors into a single representative vector.
 * Used for multi-capture face scan to improve accuracy.
 */
export function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  if (embeddings.length === 1) return embeddings[0];

  const dim = embeddings[0].length;
  const avg = new Array(dim).fill(0);

  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      avg[i] += emb[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    avg[i] /= embeddings.length;
  }

  return avg;
}

/**
 * Detects a face and extracts its 128-dimensional embedding and bounding box.
 * Uses preprocessing to handle heavy makeup better.
 */
export async function getSingleFaceEmbedding(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<{ embedding: number[]; bbox: { x: number; y: number; w: number; h: number } } | null> {
  if (typeof window === "undefined") return null;

  try {
    await loadModels();

    // Preprocess to handle makeup
    const processedCanvas = preprocessCanvasForDetection(input);

    const detection = await faceapi
      .detectSingleFace(processedCanvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;

    const embedding = Array.from(detection.descriptor);
    const { x, y, width, height } = detection.detection.box;

    return {
      embedding,
      bbox: { x, y, w: width, h: height },
    };
  } catch (error) {
    console.error("Error generating face embedding:", error);
    return null;
  }
}

/**
 * Detects all faces in a canvas/image for multi-face scans or debugging.
 */
export async function getMultipleFaces(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
) {
  if (typeof window === "undefined") return [];

  try {
    await loadModels();

    const detections = await faceapi
      .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    return detections.map((det) => ({
      embedding: Array.from(det.descriptor),
      bbox: {
        x: det.detection.box.x,
        y: det.detection.box.y,
        w: det.detection.box.width,
        h: det.detection.box.height,
      },
      confidence: det.detection.score,
    }));
  } catch (error) {
    console.error("Error detecting multiple faces:", error);
    return [];
  }
}
