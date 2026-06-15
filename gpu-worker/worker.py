import io
import logging
import signal
import time

import boto3
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from PIL import Image

from config import Config
from db import QueueDB
from face_engine import FaceEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
LOG = logging.getLogger("shotsync-worker")


class Worker:
    def __init__(self, config=None):
        self.config = config or Config()
        self.db = QueueDB(self.config.database_url, self.config.worker_id, self.config.lease_seconds)
        self.engine = FaceEngine(self.config.model_name, self.config.min_face_score)
        credentials = service_account.Credentials.from_service_account_info(
            {"client_email": self.config.drive_email, "private_key": self.config.drive_key, "token_uri": "https://oauth2.googleapis.com/token"},
            scopes=["https://www.googleapis.com/auth/drive.readonly"],
        )
        self.drive = build("drive", "v3", credentials=credentials, cache_discovery=False)
        self.r2 = boto3.client("s3", endpoint_url=self.config.r2_endpoint, aws_access_key_id=self.config.r2_access_key, aws_secret_access_key=self.config.r2_secret_key)
        self.running = True
        self.processed = 0
        self.failed = 0

    def download(self, file_id):
        output = io.BytesIO()
        request = self.drive.files().get_media(fileId=file_id)
        downloader = MediaIoBaseDownload(output, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return output.getvalue()

    def thumbnails(self, task, image_bytes):
        urls = []
        with Image.open(io.BytesIO(image_bytes)) as source:
            source = source.convert("RGB")
            for size, suffix in [(800, "lg"), (400, "sm")]:
                image = source.copy()
                image.thumbnail((size, size))
                output = io.BytesIO()
                image.save(output, "WEBP", quality=84, method=4)
                key = f"thumbnails/{task['event_id']}/{task['photo_id']}-{suffix}.webp"
                self.r2.put_object(Bucket=self.config.r2_bucket, Key=key, Body=output.getvalue(), ContentType="image/webp", CacheControl="public,max-age=31536000,immutable")
                urls.append(f"{self.config.r2_public_url}/{key}")
        return urls

    def process(self, task):
        self.db.stage(task["id"], task["photo_id"], "downloading")
        raw = self.download(task["drive_file_id"])
        self.db.stage(task["id"], task["photo_id"], "thumbnailing")
        thumbnail_url, thumbnail_sm = self.thumbnails(task, raw)
        self.db.stage(task["id"], task["photo_id"], "face_indexing")
        _, width, height, faces = self.engine.extract(raw)
        self.db.complete(task, {"thumbnail_url": thumbnail_url, "thumbnail_sm": thumbnail_sm, "width": width, "height": height, "model_version": self.config.model_version}, faces)

    def run(self):
        signal.signal(signal.SIGINT, lambda *_: setattr(self, "running", False))
        if hasattr(signal, "SIGTERM"):
            signal.signal(signal.SIGTERM, lambda *_: setattr(self, "running", False))
        while self.running:
            status = self.db.heartbeat(
                "online", self.engine.device, self.engine.batch_size,
                gpu_memory_mb=self.engine.gpu_memory_mb,
                processed=self.processed, failed=self.failed,
            )
            if status == "paused":
                time.sleep(self.config.idle_seconds)
                continue
            task = self.db.claim()
            if not task:
                if status == "draining":
                    break
                time.sleep(self.config.idle_seconds)
                continue
            try:
                LOG.info("processing photo_id=%s task_id=%s", task["photo_id"], task["id"])
                self.process(task)
                self.processed += 1
            except Exception as exc:
                LOG.exception("failed photo_id=%s task_id=%s", task["photo_id"], task["id"])
                self.failed += 1
                self.db.fail(task, type(exc).__name__, str(exc))


if __name__ == "__main__":
    Worker().run()
