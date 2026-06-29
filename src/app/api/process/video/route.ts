import { NextRequest, NextResponse } from "next/server";
import { processVideo } from "@/lib/processors/video";
import { addProcessing, upsertSession } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 100 MB)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await processVideo(buffer, file.name);

    const sessionId = request.cookies.get("session_id")?.value || uuidv4();
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    addProcessing({
      id: uuidv4(),
      type: "video",
      sessionId,
      fileName: file.name,
      fileSize: file.size,
      processedAt: new Date().toISOString(),
      ip,
      userAgent,
    });

    upsertSession(sessionId, ip, userAgent);

    const response = new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });

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
    console.error("Video processing error:", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement de la vidéo" },
      { status: 500 }
    );
  }
}
