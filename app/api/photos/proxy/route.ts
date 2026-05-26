import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return new Response("Missing url parameter", { status: 400 });
    }

    // Only allow proxying from R2 domain or Google Drive for security
    const isAllowedDomain = url.includes("r2.dev") || url.includes("google.com") || url.includes("googleapis.com");
    if (!isAllowedDomain) {
      return new Response("Forbidden domain", { status: 403 });
    }

    const res = await fetch(url);
    if (!res.ok) {
      return new Response(`Failed to fetch image: ${res.statusText}`, { status: res.status });
    }

    const blob = await res.blob();
    const contentType = res.headers.get("content-type") || "image/jpeg";

    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("Image proxy error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
