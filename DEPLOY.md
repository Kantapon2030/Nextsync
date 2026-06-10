# ShotSync - Deployment and Configuration Guide

This guide details how to set up, configure, migrate, and deploy the **ShotSync** platform in local development and production environments.

---

## 1. System Architecture Overview

ShotSync operates on a decoupled AI architecture:
1.  **Next.js Web Application**: Serves the user interfaces for students, photographers, team leaders, and administrators. It performs client-side face detection/recognition (using `face-api.js` client-side ResNet-34) for quick photo queries and registration scans.
2.  **PostgreSQL + pgvector Database**: Neon DB holds user records, photos, and high-dimensional face embeddings.
3.  **Google Drive Storage**: Holds the original high-resolution photos in shared team folders.
4.  **Cloudflare R2 Storage**: Hosts low-latency web-optimized thumbnails (800px and 400px widths).
5.  **Python Pipeline (Google Colab)**: Automates image quality evaluations (focus blur and brightness), detects faces, maps embeddings deterministically into 128-dimensional vectors, and uploads thumbnails to R2.

---

## 2. Environment Configurations

Create a `.env.local` file in the root directory (based on `.env.example`):

```env
# NextAuth Configuration
# Run `openssl rand -base64 32` to generate a secure secret
AUTH_SECRET="your-next-auth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Database Connections (Neon PostgreSQL with pgvector extension)
DATABASE_URL="postgresql://user:password@hostname/dbname?sslmode=require"

# Cloudflare R2 Thumbnail Storage
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
R2_BUCKET_NAME="shotsync-thumbnails"
# R2 Public access domain (e.g. pub-abc.r2.dev or a custom subdomain)
R2_PUBLIC_URL="https://pub-your-id.r2.dev"

# Google Cloud Service Account Credentials
# Client email from your downloaded service account json file
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account-email@project.iam.gserviceaccount.com"
# Private key from the service account json (replace real linebreaks \n with actual string "\n")
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC..."
# Google Drive root parent folder where team folders will be auto-generated
GOOGLE_DRIVE_FOLDER_ID="your-root-folder-id"

# Python ArcFace Microservice (Render.com)
FACE_API_URL="http://localhost:8000"
FACE_API_SECRET="random-secret-for-inter-service-auth"
ALLOWED_ORIGINS="http://localhost:3000,https://shotsync.vercel.app"
```

---

## 3. Database Setup & Migrations

ShotSync uses **Drizzle ORM** for database mapping.

1.  **Enable vector extension**: Make sure your PostgreSQL database has `pgvector` enabled. Neon PostgreSQL supports this natively.
2.  **Generate SQL migration scripts**:
    ```bash
    npm run db:generate
    ```
3.  **Apply migrations directly**:
    ```bash
    npm run db:push
    ```
4.  **Verify Seed Data**:
    Running `db:push` or deploying will configure the central tables. Verify that the 4 color teams (`blue`, `green`, `red`, `yellow`) are seeded in your `teams` table.

---

## 4. Google Drive Service Account Configuration

Photographers upload files through Google Drive. The Next.js web application and Google Colab connect using a Service Account:

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project or select an existing one.
3.  Go to **APIs & Services** > **Library** and search for **Google Drive API**. Click **Enable**.
4.  Go to **IAM & Admin** > **Service Accounts** and click **Create Service Account**.
5.  Follow the wizard. Once created, click on the service account, go to the **Keys** tab, click **Add Key** > **Create New Key**, select **JSON**, and download the key.
6.  Open the JSON key and extract:
    *   `client_email` -> Maps to `GOOGLE_DRIVE_CLIENT_EMAIL`
    *   `private_key` -> Maps to `GOOGLE_DRIVE_PRIVATE_KEY`
7.  **Create a root folder in your personal Google Drive** (e.g., named "ShotSync Photos").
8.  Get its Folder ID from the URL (the letters after `/folders/`). Put this in `GOOGLE_DRIVE_FOLDER_ID`.
9.  **CRITICAL STEP**: Share that root Google Drive folder with your Service Account's email address (`client_email`) with **Editor** permissions.

---

## 5. Cloudflare R2 Bucket Configuration

To store and serve thumbnails quickly:

1.  Log in to the Cloudflare Dashboard.
2.  Go to **R2** > **Create bucket**. Name the bucket `shotsync-thumbnails` (or match `R2_BUCKET_NAME`).
3.  Go to the bucket **Settings** tab.
4.  Under **Public Access**, click **Connect Domain** or enable the **R2.dev subdomain** to get a public URL. Save this under `R2_PUBLIC_URL`.
5.  Under **CORS Policy**, add a policy allowing your website domain (e.g. `http://localhost:3000` or `https://your-domain.vercel.app`) to download files:
    ```json
    [
      {
        "AllowedOrigins": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedHeaders": ["*"],
        "MaxAgeSeconds": 3600
      }
    ]
    ```
6.  Go to R2 homepage > **Manage R2 API Tokens** > **Create API Token**.
7.  Give the token **Edit** permissions. Save the access and secret keys into your environment.

---

## 6. Vercel Deployment

1.  Connect your Git repository containing this project to Vercel.
2.  Add all variables from Section 2 into Vercel's **Environment Variables** settings.
3.  Set the Framework Preset to **Next.js**.
4.  Deploy! Vercel handles the production build and SSL termination automatically.

---

## 7. Running the Colab Pipeline

Refer to the [Pipeline Instructions](pipeline/README.md) to set up and run the AI indexing pipeline in Google Colab. Once the web application is running, a photographer trigger request uploads a JSON trigger to Google Drive. The Colab loop detects it, processes the raw folder, generates R2 thumbnails, and registers face embeddings in Neon PostgreSQL.
