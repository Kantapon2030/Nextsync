import cv2
import numpy as np
import onnxruntime as ort
import subprocess
from insightface.app import FaceAnalysis


def normalize(vector):
    value = np.asarray(vector, dtype=np.float32)
    norm = np.linalg.norm(value)
    return value if norm == 0 else value / norm


def detect_gpu_memory_mb() -> int:
    try:
        output = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            text=True,
            timeout=5,
        )
        return int(output.splitlines()[0].strip())
    except Exception:
        return 0


def adaptive_batch_size(device: str, memory_mb: int = 0) -> int:
    if "CUDA" not in device:
        return 1
    if memory_mb and memory_mb < 5000:
        return 4
    return 8


class FaceEngine:
    def __init__(self, model_name="buffalo_l", min_score=0.65):
        available = ort.get_available_providers()
        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if "CUDAExecutionProvider" in available else ["CPUExecutionProvider"]
        self.device = providers[0]
        self.gpu_memory_mb = detect_gpu_memory_mb() if self.device == "CUDAExecutionProvider" else 0
        self.batch_size = adaptive_batch_size(self.device, self.gpu_memory_mb)
        self.min_score = min_score
        self.app = FaceAnalysis(name=model_name, providers=providers)
        self.app.prepare(ctx_id=0 if self.device == "CUDAExecutionProvider" else -1, det_size=(640, 640))

    def extract(self, image_bytes):
        image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("invalid_image")
        height, width = image.shape[:2]
        faces = []
        for face in self.app.get(image):
            score = float(face.det_score)
            if score < self.min_score:
                continue
            bbox = [float(x) for x in face.bbox]
            face_width = max(0.0, bbox[2] - bbox[0])
            quality = min(1.0, score * min(1.0, face_width / 120.0))
            vector = normalize(face.normed_embedding)
            faces.append({"vector": "[" + ",".join(map(str, vector.tolist())) + "]", "bbox": bbox, "score": score, "quality": quality})
        return image, width, height, faces
