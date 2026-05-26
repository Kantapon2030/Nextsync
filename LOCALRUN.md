# Nextsync — Local Running Guide (LOCALRUN.md)

Welcome to **Nextsync**! This guide details how to set up, configure, migrate, and run the Nextsync photo-matching platform in your local development environment.

---

## Prerequisites

Before running the application, make sure you have the following installed on your machine:
1. **Node.js**: Version 18.x or later (LTS recommended)
2. **npm**: Version 9.x or later
3. **PostgreSQL**: A local instance or a Neon cloud database URL

---

## 1. Local Environment Setup

To configure your environment variables, run the interactive setup script:

```bash
npm run setup
```

This script will guide you through setting up your `.env.local` file and prompt you for the necessary keys, including:
- **`DATABASE_URL`**: Your PostgreSQL connection string.
- **`GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`**: Required for student Google OAuth sign-in.
- **`R2_*` variables**: Cloudflare R2 bucket configurations for photo thumbnails.
- **`GOOGLE_SERVICE_ACCOUNT_EMAIL` & `GOOGLE_PRIVATE_KEY`**: Service account keys to sync photos to Google Drive.
- **`PHOTOGRAPHER_INVITE_CODE`**: Secret registration code required for photographer sign-up.

---

## 2. Database Schema & Seed Setup

Nextsync uses **Drizzle ORM** for database interaction. Once your database is ready and configured in `.env.local`, run:

### A. Push Schema to Database
This command updates your database tables to match the Nextsync single-color-team schema (removing teams table, role `team_leader`, and `team_color` fields):

```bash
npm run db:push
```

### B. Seed the System Administrator User
To generate the default system administrator (configured as `ADMIN_STUDENT_ID` and `ADMIN_PASSWORD` in your `.env.local`), run:

```bash
npm run seed:admin
```

---

## 3. Running the Development Server

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 4. Photographer & Admin Testing Flows

### Photographer Upload Test
1. Access the photographer registration page at `/auth/photographer` (or click "เข้าสู่ระบบช่างภาพที่นี่" from the login page).
2. Click the "สมัครสมาชิก" tab.
3. Sign up by entering your details and the **Photographer Invite Code** defined in your `.env.local`.
4. Once registered and logged in, you will be redirected to the upload dashboard.
5. Drag and drop or browse to queue photos.
6. Click **เริ่มอัปโหลดทั้งหมด** to upload the files.
7. Once all uploads are complete, click **⚡ ประมวลผลรูปชุดนี้** to trigger the matching pipeline.

### Admin Reject Queue and Config
1. Log in with the Administrator Student ID (default `00000`) and Admin Password.
2. Navigate to the Admin Dashboard (or go directly to `/admin/dashboard`).
3. View stats, quality reports, and recent activities.
4. Navigate to `/admin/reject-queue` to approve/reject photos flagged by the quality filter.
5. Navigate to `/admin/config` to dynamically configure thresholds (such as blur score, minimum brightness, and cosine face similarity distance).
