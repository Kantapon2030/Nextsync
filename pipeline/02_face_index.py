#!/usr/bin/env python3
# pipeline/02_face_index.py
# Calls the local or deployed Face API service (ArcFace 512-dim) for face indexing.

import io
import os
import requests
import psycopg2
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload


def get_db_connection():
    """Establish a connection to the PostgreSQL database."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is missing")
    return psycopg2.connect(database_url)


def get_gdrive_service(service_account_json_path):
    """Authenticate with Google Drive using a Service Account JSON file."""
    scopes = ["https://www.googleapis.com/auth/drive.readonly"]
    creds = service_account.Credentials.from_service_account_file(
        service_account_json_path, scopes=scopes
    )
    return build("drive", "v3", credentials=creds)


def download_file_from_drive(service, file_id, local_path):
    """Download a file from Google Drive to a local path."""
    request = service.files().get_media(fileId=file_id)
    fh = io.FileIO(local_path, "wb")
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    fh.close()


def index_photo_faces(image_path: str, _face_app=None):
    """
    Detect faces and extract 512-dim ArcFace embeddings by calling the face-api service.
    
    Returns: list of dicts with {bbox, embedding, confidence, face_index}
    """
    face_api_url = os.environ.get("FACE_API_URL", "http://127.0.0.1:8000")
    face_api_secret = os.environ.get("FACE_API_SECRET", "dev-secret-key-change-this-in-prod")
    
    headers = {}
    if face_api_secret:
        headers["Authorization"] = f"Bearer {face_api_secret}"
        
    try:
        with open(image_path, "rb") as f:
            files = {"image": (os.path.basename(image_path), f, "image/jpeg")}
            res = requests.post(f"{face_api_url}/extract", headers=headers, files=files, timeout=45)
            
        if res.status_code != 200:
            print(f"[face_index] Face API returned status {res.status_code} for {os.path.basename(image_path)}: {res.text}")
            return []
            
        data = res.json()
        
        # If there's an error key in the JSON response
        if "error" in data and data["error"]:
            print(f"[face_index] Face API error for {os.path.basename(image_path)}: {data['error']}")
            return []
            
        faces = data.get("faces", [])
        results = []
        for i, face in enumerate(faces):
            results.append({
                "face_index": i,
                "bbox": face["bbox"],
                "embedding": face["embedding"],     # 512-dim ArcFace embedding
                "confidence": face.get("confidence", 0.99),
            })
        return results
    except Exception as e:
        print(f"[face_index] Failed to connect to Face API at {face_api_url}: {e}")
        return []
