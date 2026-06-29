import { NextRequest, NextResponse } from "next/server";
import { processText } from "@/lib/processors/text";
import { addProcessing, upsertSession } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const { text, options } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Texte requis" }, { status: 400 });
    }

    if (text.length > 50000) {
      return NextResponse.json(
        { error: "Texte trop long (max 50 000 caractères)" },
        { status: 400 }
      );
    }

    const result = processText(text, options);

    const sessionId = request.cookies.get("session_id")?.value || uuidv4();
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    addProcessing({
      id: uuidv4(),
      type: "text",
      sessionId,
      fileSize: text.length,
      processedAt: new Date().toISOString(),
      ip,
      userAgent,
    });

    upsertSession(sessionId, ip, userAgent);

    const response = NextResponse.json(result);

    if (!request.cookies.get("session_id")) {
      response.cookies.set("session_id", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (error) {
    console.error("Text processing error:", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement du texte" },
      { status: 500 }
    );
  }
}
