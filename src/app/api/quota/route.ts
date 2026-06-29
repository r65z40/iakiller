import { NextRequest, NextResponse } from "next/server";
import { getDailyProcessingCount, getSessionPremiumStatus, getSettings } from "@/lib/db";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get("session_id")?.value;
  if (!sessionId) {
    const settings = getSettings();
    return NextResponse.json({
      used: 0,
      limit: settings.dailyLimitFree,
      remaining: settings.dailyLimitFree,
      isPremium: false,
      noAds: false,
      popupAdEnabled: settings.popupAdEnabled,
    });
  }

  const status = getSessionPremiumStatus(sessionId);
  const used = getDailyProcessingCount(sessionId);
  const settings = getSettings();

  return NextResponse.json({
    used,
    limit: status.dailyLimit,
    remaining: Math.max(0, status.dailyLimit - used),
    isPremium: status.isPremium,
    noAds: status.noAds,
    popupAdEnabled: settings.popupAdEnabled,
  });
}
