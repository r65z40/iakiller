import { NextResponse } from "next/server";
import { getProcessingStats, getSessionStats, getAds } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const processingStats = getProcessingStats();
  const sessionStats = getSessionStats();
  const ads = getAds();

  const totalImpressions = ads.reduce((sum, a) => sum + a.impressions, 0);
  const totalClicks = ads.reduce((sum, a) => sum + a.clicks, 0);

  return NextResponse.json({
    processings: processingStats,
    sessions: sessionStats,
    ads: {
      total: ads.length,
      active: ads.filter((a) => a.active).length,
      totalImpressions,
      totalClicks,
      ctr: totalImpressions > 0
        ? ((totalClicks / totalImpressions) * 100).toFixed(2)
        : "0",
    },
  });
}
