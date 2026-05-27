#!/usr/bin/env python3
# pipeline/run_pipeline.py
# Quality filter REMOVED — all photos are approved automatically.
# Optimized with concurrent processing via ThreadPoolExecutor.

import os
import sys
import json
import uuid
import threading
import psycopg2
from psycopg2.extras import execute_values
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import importlib
_face_index = importlib.import_module("02_face_index")
get_db_connection = _face_index.get_db_connection
get_gdrive_service = _face_index.get_gdrive_service
download_file_from_drive = _face_index.download_file_from_drive
index_photo_faces = _face_index.index_photo_faces

_thumbnail_gen = importlib.import_module("03_thumbnail_gen")
get_r2_client = _thumbnail_gen.get_r2_client
create_and_upload_thumbnails = _thumbnail_gen.create_and_upload_thumbnails


def get_config(conn):
    """Load face recognition settings from DB (quality filter settings removed)."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT min_face_confidence, face_similarity_dist FROM filter_config WHERE id = 1 LIMIT 1"
    )
    row = cursor.fetchone()
    cursor.close()
    return {
        "min_face_confidence": float(row[0]) if row and row[0] is not None else 0.50,
        "face_similarity_dist": float(row[1]) if row and row[1] is not None else 0.42,
    }


def get_processed_file_ids(conn):
    """Return set of drive_file_ids already in the database."""
    cursor = conn.cursor()
    cursor.execute("SELECT drive_file_id FROM photos")
    rows = cursor.fetchall()
    cursor.close()
    return set(r[0] for r in rows)


# Thread-local DB connections for concurrent processing
_thread_local = threading.local()

def get_thread_conn(database_url):
    if not hasattr(_thread_local, "conn") or _thread_local.conn.closed:
        _thread_local.conn = psycopg2.connect(database_url)
    return _thread_local.conn


def process_single_photo(
    database_url, gdrive_service, r2_client,
    file_info, config,
    season_id, event_id, timeslot,
    log_callback=None
):
    """
    Process one photo:
    1. Download from Drive
    2. Create thumbnails → upload R2
    3. Insert as APPROVED (no quality filter)
    4. Detect faces → insert embeddings for Face Search
    """
    file_id = file_info["id"]
    filename = file_info["name"]
    file_size = int(file_info.get("size", 0))
    drive_url = file_info.get("webViewLink", f"https://drive.google.com/open?id={file_id}")

    def log(msg):
        if log_callback:
            log_callback(msg)
        else:
            print(msg)

    local_temp_path = f"temp_{file_id}.jpg"
    try:
        download_file_from_drive(gdrive_service, file_id, local_temp_path)

        import cv2
        img = cv2.imread(local_temp_path)
        if img is None:
            log(f"⚠️ Cannot decode {filename}, skipping")
            return False
        h, w = img.shape[:2]

        # Generate thumbnails & upload to R2
        photo_uuid = str(uuid.uuid4())
        thumbnail_url, thumbnail_sm = create_and_upload_thumbnails(local_temp_path, photo_uuid, r2_client)

        # Face indexing (for Face Search — does NOT affect approval)
        try:
            faces_results = index_photo_faces(local_temp_path)
            min_conf = config.get("min_face_confidence", 0.50)
            # Keep all detected faces regardless of confidence (index them all)
            approved_faces = [f for f in faces_results if f.get("confidence", 1.0) >= min_conf]
            face_count = len(approved_faces)
        except Exception as face_err:
            log(f"⚠️ Face detection failed for {filename}: {face_err}")
            approved_faces = []
            face_count = 0

        # Insert photo as APPROVED
        conn = get_thread_conn(database_url)
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO photos (
                id, event_id, season_id, timeslot, drive_file_id, drive_url,
                thumbnail_url, thumbnail_sm, filename, file_size, width, height,
                face_count, status, processed_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'approved', NOW())
            ON CONFLICT (drive_file_id) DO NOTHING""",
            (
                photo_uuid, event_id, season_id, timeslot, file_id, drive_url,
                thumbnail_url, thumbnail_sm, filename, file_size, w, h, face_count
            )
        )

        # Insert face embeddings
        for face in approved_faces:
            embed_str = f"[{','.join(map(str, face['embedding']))}]"
            cursor.execute(
                """INSERT INTO photo_face_embeddings
                   (photo_id, embedding, face_index, bbox_x, bbox_y, bbox_w, bbox_h, confidence)
                   VALUES (%s, %s::vector, %s, %s, %s, %s, %s, %s)""",
                (
                    photo_uuid,
                    embed_str,
                    face.get("face_index", 0),
                    face["bbox"]["x"],
                    face["bbox"]["y"],
                    face["bbox"]["w"],
                    face["bbox"]["h"],
                    face.get("confidence", 0.99),
                )
            )

        conn.commit()
        cursor.close()
        log(f"✅ {filename} → approved ({face_count} faces indexed)")
        return True

    except Exception as e:
        log(f"❌ Error processing {filename}: {e}")
        try:
            conn = get_thread_conn(database_url)
            conn.rollback()
        except:
            pass
        return False
    finally:
        if os.path.exists(local_temp_path):
            os.remove(local_temp_path)


def run_pipeline(service_account_path, folder_id=None, workers=4, log_callback=None, stop_event=None, event_id=None, timeslot=None):
    """
    Main pipeline:
    - Scan Drive folder for trigger JSON files (or process directly if event_id is specified)
    - Process all images concurrently with ThreadPoolExecutor
    """
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is missing")

    def log(msg):
        if log_callback:
            log_callback(msg)
        else:
            print(msg)

    log("🔗 Connecting to database...")
    conn = get_db_connection()

    log("🔗 Connecting to Google Drive...")
    gdrive_service = get_gdrive_service(service_account_path)

    log("🔗 Connecting to Cloudflare R2...")
    r2_client = get_r2_client()

    if not folder_id:
        folder_id = os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "")
    if not folder_id:
        log("❌ No Google Drive Folder ID configured.")
        conn.close()
        return {"processed": 0, "errors": 0}

    # Extract folder ID if a full URL is provided
    folder_id = folder_id.strip()
    if "drive.google.com" in folder_id or "/" in folder_id:
        import re
        m = re.search(r"/folders/([a-zA-Z0-9-_]+)", folder_id)
        if m:
            extracted_id = m.group(1)
            log(f"ℹ️ Extracted folder ID from URL: {extracted_id}")
            folder_id = extracted_id
        else:
            m2 = re.search(r"[?&]id=([a-zA-Z0-9-_]+)", folder_id)
            if m2:
                extracted_id = m2.group(1)
                log(f"ℹ️ Extracted folder ID from URL parameter: {extracted_id}")
                folder_id = extracted_id
            else:
                parts = [p.strip() for p in folder_id.split("/") if p.strip()]
                for part in reversed(parts):
                    if len(part) >= 15 and re.match(r"^[a-zA-Z0-9-_]+$", part):
                        log(f"ℹ️ Extracted folder ID from URL segment: {part}")
                        folder_id = part
                        break

    log(f"📁 Scanning Drive folder {folder_id}...")
    
    # Try to find trigger files anyway for cleanup/sync purposes
    trigger_files = []
    try:
        results = gdrive_service.files().list(
            q=f"'{folder_id}' in parents and name contains 'trigger_' and mimeType = 'application/json' and trashed = false",
            fields="files(id, name)"
        ).execute()
        trigger_files = results.get("files", [])
    except Exception as e:
        log(f"⚠️ Error scanning for trigger files: {e}")

    # If no event_id was passed, try to parse from the first trigger file
    if not event_id:
        if not trigger_files:
            log("ℹ️ No trigger file found. Pipeline idle.")
            conn.close()
            return {"processed": 0, "errors": 0}

        t_file = trigger_files[0]
        local_trigger_path = f"temp_{t_file['id']}.json"
        try:
            download_file_from_drive(gdrive_service, t_file["id"], local_trigger_path)
            with open(local_trigger_path, "r", encoding="utf-8") as f:
                trigger_data = json.load(f)
            event_id = trigger_data.get("eventId", "day1")
            timeslot = trigger_data.get("timeslot", None)
            log(f"📋 Trigger file found: eventId={event_id}, timeslot={timeslot}")
        except Exception as e:
            log(f"⚠️ Error reading trigger, using defaults: {e}")
            event_id = "day1"
        finally:
            if os.path.exists(local_trigger_path):
                os.remove(local_trigger_path)
    else:
        log(f"📋 Direct processing mode: eventId={event_id}, timeslot={timeslot}")

    # Resolve season_id
    season_id = "default"
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT season_id FROM events WHERE id = %s", (event_id,))
        row = cursor.fetchone()
        if row:
            season_id = row[0]
        cursor.close()
    except Exception as e:
        log(f"⚠️ Could not resolve season_id: {e}")

    config = get_config(conn)
    log(f"⚙️  Config: face_confidence={config['min_face_confidence']}")

    # Get already-processed IDs
    processed_ids = get_processed_file_ids(conn)

    # List images
    image_results = gdrive_service.files().list(
        q=f"'{folder_id}' in parents and (mimeType = 'image/jpeg' or mimeType = 'image/png') and trashed = false",
        fields="files(id, name, size, webViewLink)",
        pageSize=1000
    ).execute()

    all_images = image_results.get("files", [])
    new_images = [f for f in all_images if f["id"] not in processed_ids]
    log(f"📷 {len(new_images)} new images to process (total: {len(all_images)})")

    conn.close()  # Main conn closed; threads use their own

    success_count = 0
    error_count = 0

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                process_single_photo,
                database_url, gdrive_service, r2_client,
                file_info, config,
                season_id, event_id, timeslot,
                log_callback
            ): file_info
            for file_info in new_images
        }

        for future in as_completed(futures):
            if stop_event and stop_event.is_set():
                log("⏹ Pipeline stopped by user.")
                executor.shutdown(wait=False, cancel_futures=True)
                break
            try:
                result = future.result()
                if result:
                    success_count += 1
                else:
                    error_count += 1
            except Exception as e:
                log(f"❌ Unexpected error: {e}")
                error_count += 1

    # Rename trigger files
    main_conn = get_db_connection()
    for t_file in trigger_files:
        new_name = f"processed_{t_file['name']}"
        try:
            gdrive_service.files().update(
                fileId=t_file["id"],
                body={"name": new_name}
            ).execute()
            log(f"📝 Renamed trigger: {t_file['name']} → {new_name}")
        except Exception as e:
            log(f"⚠️ Could not rename trigger: {e}")

    # Update event photoCount
    try:
        cursor = main_conn.cursor()
        cursor.execute(
            "UPDATE events SET photo_count = (SELECT COUNT(*) FROM photos WHERE event_id = %s AND status = 'approved') WHERE id = %s",
            (event_id, event_id)
        )
        main_conn.commit()
        cursor.close()
    except Exception as e:
        log(f"⚠️ Could not update photo_count: {e}")
    finally:
        main_conn.close()

    log(f"\n✅ Done! {success_count} approved, {error_count} errors.")
    return {"processed": success_count, "errors": error_count}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_pipeline.py <service_account_json> [folder_id] [workers]")
        sys.exit(1)

    sa_path = sys.argv[1]
    f_id = sys.argv[2] if len(sys.argv) >= 3 else None
    num_workers = int(sys.argv[3]) if len(sys.argv) >= 4 else 4

    run_pipeline(sa_path, f_id, workers=num_workers)
