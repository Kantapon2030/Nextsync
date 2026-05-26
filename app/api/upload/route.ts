// app/api/upload/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Direct browser upload is disabled. Please upload via the Google Drive folder links." },
    { status: 405 }
  );
}
