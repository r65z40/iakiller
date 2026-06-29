import { NextRequest, NextResponse } from "next/server";
import { processImage } from "@/lib/processors/image";
import { addProcessing, upsertSession, getDailyProcessingCount, getSessionPremiumStatus } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("session_id")?.value || uuidv4();
    const status = getSessionPremiumStatus(sessionId);
    const dailyCount = getDailyProcessingCount(sessionId);

    if (dailyCount >= status.dailyLimit) {
      return NextResponse.json(
        { error: "LIMIT_REACHED", limit: status.dailyLimit, isPremium: status.isPremium },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const optionsStr = formData.get("options") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 20 MB)" }, { status: 400 });
    }

    const options = optionsStr ? JSON.parse(optionsStr) : {};
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await processImage(buffer, options);

    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    addProcessing({
      id: uuidv4(),
      type: "image",
      sessionId,
      fileName: file.name,
      fileSize: file.size,
      processedAt: new Date().toISOString(),
      ip,
      userAgent,
    });

    upsertSession(sessionId, ip, userAgent);

    const contentType =
      result.format === "png"
        ? "image/png"
        : result.format === "webp"
        ? "image/webp"
        : "image/jpeg";

    const isHttps = request.headers.get("x-forwarded-proto") === "https" || request.url.startsWith("https");
    const response = new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="iakiller_${Date.now()}.${result.format}"`,
        "X-Process-Info": JSON.stringify({
          width: result.width,
          height: result.height,
          format: result.format,
        }),
      },
    });

    if (!request.cookies.get("session_id")) {
      response.cookies.set("session_id", sessionId, {
        httpOnly: true,
        secure: isHttps,
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (error) {
    console.error("Image processing error:", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement de l'image" },
      { status: 500 }
    );
  }
}
