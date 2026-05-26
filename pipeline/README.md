# ShotSync Photo Processing Pipeline

This directory contains the Python pipeline designed to run in Google Colab (or any GPU/CPU server environment) to process raw athlete photos from Google Drive, perform AI-based quality checks, detect and index faces, and upload compressed thumbnails to Cloudflare R2.

## Directory Structure

*   `01_quality_filter.py`: Evaluates focus blur (OpenCV Laplacian variance) and brightness (HSV V-channel). Rejects images failing the thresholds.
*   `02_face_index.py`: Uses `InsightFace` to locate faces and extract embeddings. Projects 512-dimensional InsightFace descriptors into 128-dimensional vectors to match the browser-side `face-api.js` space.
*   `03_thumbnail_gen.py`: Generates downscaled thumbnails (800px and 400px widths) and uploads them to Cloudflare R2.
*   `run_pipeline.py`: Main CLI script matching photographer trigger files (`trigger_*.json`) inside team folders, running the quality-checking, indexing, thumbnail generation, and database insertions.
*   `run_all.ipynb`: The Google Colab Jupyter Notebook orchestrating the entire run flow.
*   `requirements.txt`: Python package dependency list.

## Setup Instructions

### Option 1: Running in Google Colab (Recommended)

1.  Open [Google Colab](https://colab.research.google.com/).
2.  Upload `run_all.ipynb`, `run_pipeline.py`, `01_quality_filter.py`, `02_face_index.py`, `03_thumbnail_gen.py`, and `requirements.txt` to your Colab workspace file system.
3.  Upload your Google Cloud Service Account JSON file as `service-account.json` to the same folder.
4.  Open `run_all.ipynb` in Colab.
5.  Run **Step 1: Install Dependencies** to download the pre-compiled packages.
6.  Edit **Step 2** with your database connection URL (`DATABASE_URL`) and Cloudflare R2 bucket details.
7.  Run **Step 3** to run a single execution for a specific team color, or run **Step 4** to start a daemon poll listener.

### Option 2: Running Locally

If running locally on your computer/server:

1.  Install Python 3.10+ and virtualenv.
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Configure your environment variables:
    ```bash
    export DATABASE_URL="postgresql://username:password@hostname:5432/shotsync"
    export R2_ACCOUNT_ID="your-cloudflare-account-id"
    export R2_ACCESS_KEY_ID="your-access-key-id"
    export R2_SECRET_ACCESS_KEY="your-secret-access-key"
    export R2_BUCKET_NAME="shotsync-thumbnails"
    export R2_PUBLIC_URL="https://pub-your-id.r2.dev"
    ```
4.  Run the pipeline command:
    ```bash
    python run_pipeline.py path/to/service-account.json blue
    ```

## Quality Rejection Reasons

If a photo fails checks, it is written to the database under status `rejected` with one of the following reasons:
*   `blur`: The Laplacian focus score was lower than the configured minimum threshold (default: `80.0`).
*   `dark`: Average image value was below the minimum threshold (default: `0.12`).
*   `bright`: Average image value was above the maximum threshold (default: `0.88`).
*   `no_face`: No faces were detected in the image at the configured minimum confidence.
