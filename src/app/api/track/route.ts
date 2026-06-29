import { NextRequest, NextResponse } from "next/server";
import { incrementAdImpressions, incrementAdClicks } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { type, adId } = await request.json();

    if (type === "ad_impression" && adId) {
      incrementAdImpressions(adId);
    } else if (type === "ad_click" && adId) {
      incrementAdClicks(adId);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
