import { NextRequest, NextResponse } from "next/server";
import { getAds, getActiveAds, createAd } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  const position = request.nextUrl.searchParams.get("position");
  const activeOnly = request.nextUrl.searchParams.get("active") === "true";

  if (activeOnly) {
    const ads = getActiveAds(position || undefined);
    return NextResponse.json({ ads });
  }

  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  return NextResponse.json({ ads: getAds() });
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const now = new Date().toISOString();

    const ad = createAd({
      id: uuidv4(),
      name: body.name || "Sans nom",
      type: body.type || "banner",
      position: body.position || "header",
      content: body.content || "",
      imageUrl: body.imageUrl || undefined,
      targetUrl: body.targetUrl || undefined,
      active: body.active ?? true,
      impressions: 0,
      clicks: 0,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ ad }, { status: 201 });
  } catch (error) {
    console.error("Create ad error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création" },
      { status: 500 }
    );
  }
}
