import { NextRequest, NextResponse } from "next/server";
import { getSessions, getProcessings } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

  const { sessions, total } = getSessions(limit, offset);
  const recentProcessings = getProcessings(100);

  return NextResponse.json({
    sessions,
    total,
    recentProcessings: recentProcessings.slice(0, 20),
  });
}
