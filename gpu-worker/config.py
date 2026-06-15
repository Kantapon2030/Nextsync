import os
import socket
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Config:
    database_url: str = os.environ["DATABASE_URL"]
    worker_id: str = os.getenv("WORKER_ID", f"{socket.gethostname()}-gpu")
    model_name: str = os.getenv("FACE_MODEL", "buffalo_l")
    model_version: str = os.getenv("FACE_MODEL_VERSION", "buffalo_l-v1")
    lease_seconds: int = int(os.getenv("WORKER_LEASE_SECONDS", "300"))
    idle_seconds: float = float(os.getenv("WORKER_IDLE_SECONDS", "2"))
    min_face_score: float = float(os.getenv("MIN_FACE_SCORE", "0.65"))
    drive_email: str = os.environ["GOOGLE_SERVICE_ACCOUNT_EMAIL"]
    drive_key: str = os.environ["GOOGLE_PRIVATE_KEY"].replace("\\n", "\n")
    r2_endpoint: str = os.getenv("R2_ENDPOINT", f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com")
    r2_access_key: str = os.environ["R2_ACCESS_KEY_ID"]
    r2_secret_key: str = os.environ["R2_SECRET_ACCESS_KEY"]
    r2_bucket: str = os.environ["R2_BUCKET_NAME"]
    r2_public_url: str = os.environ["R2_PUBLIC_URL"].rstrip("/")
