import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use /api/admin/events/[id]/sync" },
    { status: 410 }
  );
}
