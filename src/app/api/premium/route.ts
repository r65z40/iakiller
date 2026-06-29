import { NextRequest, NextResponse } from "next/server";
import { activatePremiumForSession, upsertSession } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json();
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Key required" }, { status: 400 });
    }

    let sessionId = request.cookies.get("session_id")?.value;
    const isHttps = request.headers.get("x-forwarded-proto") === "https" || request.url.startsWith("https");

    if (!sessionId) {
      sessionId = uuidv4();
      upsertSession(sessionId);
    }

    const success = activatePremiumForSession(sessionId, key.trim());
    if (!success) {
      return NextResponse.json({ error: "Invalid or expired key" }, { status: 400 });
    }

    const response = NextResponse.json({ success: true });

    if (!request.cookies.get("session_id")) {
      response.cookies.set("session_id", sessionId, {
        httpOnly: true,
        secure: isHttps,
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
      });
    }

    return response;
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
