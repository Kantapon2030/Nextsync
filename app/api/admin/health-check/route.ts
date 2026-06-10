// app/api/admin/health-check/route.ts
// Proxies a health check to the Python ArcFace microservice and measures response time
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const faceApiUrl = process.env.FACE_API_URL;
    if (!faceApiUrl) {
      return NextResponse.json({
        success: false,
        status: "offline",
        error: "FACE_API_URL is not configured",
        responseTime: null,
      });
    }

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      // Abort if no response within 5 seconds
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${faceApiUrl}/`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.FACE_API_SECRET || ""}`,
        },
      });
      clearTimeout(timeout);

      const responseTime = Date.now() - startTime;
      const json = await res.json().catch(() => ({}));

      return NextResponse.json({
        success: true,
        status: res.ok ? "online" : "degraded",
        responseTime,
        httpStatus: res.status,
        serviceInfo: json,
      });
    } catch (fetchError: any) {
      const responseTime = Date.now() - startTime;
      const isTimeout = fetchError?.name === "AbortError";
      return NextResponse.json({
        success: false,
        status: "offline",
        error: isTimeout ? "Request timed out after 5 seconds" : (fetchError?.message || "Connection failed"),
        responseTime: isTimeout ? responseTime : null,
      });
    }
  } catch (error) {
    console.error("GET health-check error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการตรวจสอบสถานะ" }, { status: 500 });
  }
}
