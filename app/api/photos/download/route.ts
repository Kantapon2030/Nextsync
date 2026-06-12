// app/api/photos/download/route.ts
import { auth } from "@/lib/auth";
import { db, photos } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Proxy download endpoint — streams Google Drive / R2 photo to the browser
 * with a proper Content-Disposition: attachment header so the browser saves
 * the file with the correct filename instead of opening it inline.
 *
 * GET /api/photos/download?id=<photoId>
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const photoId = searchParams.get("id");

    if (!photoId) {
      return NextResponse.json(
        { error: "กรุณาระบุ photo ID" },
        { status: 400 }
      );
    }

    // Fetch photo record from DB (auth is checked above)
    const photoRecord = await db
      .select({
        id: photos.id,
        filename: photos.filename,
        driveUrl: photos.driveUrl,
        thumbnailUrl: photos.thumbnailUrl,
        thumbnailSm: photos.thumbnailSm,
        status: photos.status,
      })
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);

    if (!photoRecord[0]) {
      return NextResponse.json(
        { error: "ไม่พบรูปภาพที่ต้องการ" },
        { status: 404 }
      );
    }

    const photo = photoRecord[0];

    // Only serve approved photos to non-admin users
    if (
      photo.status !== "approved" &&
      session.user.role !== "admin" &&
      session.user.role !== "photographer"
    ) {
      return NextResponse.json(
        { error: "ไม่มีสิทธิ์ดาวน์โหลดรูปภาพนี้" },
        { status: 403 }
      );
    }

    // Prefer R2 thumbnail (same-origin, faster), fallback to Drive URL
    const downloadUrl =
      photo.thumbnailUrl || photo.thumbnailSm || photo.driveUrl;

    if (!downloadUrl) {
      return NextResponse.json(
        { error: "ไม่พบ URL สำหรับดาวน์โหลด" },
        { status: 404 }
      );
    }

    // Proxy the file — stream response back to browser
    const upstream = await fetch(downloadUrl, {
      headers: {
        // Pass through accept headers for content negotiation
        Accept: "image/*, */*",
      },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream fetch failed: ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentType =
      upstream.headers.get("Content-Type") || "application/octet-stream";

    // Sanitize filename for Content-Disposition header
    const safeFilename = encodeURIComponent(
      photo.filename || `nextsync_${photo.id}.jpg`
    );

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${safeFilename}`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Photo download error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดาวน์โหลด" },
      { status: 500 }
    );
  }
}
