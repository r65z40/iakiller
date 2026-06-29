import { NextRequest, NextResponse } from "next/server";
import { getPremiumKeys, createPremiumKey, deletePremiumKey } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

function generateKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = [];
  for (let s = 0; s < 4; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return segments.join("-");
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return NextResponse.json({ keys: getPremiumKeys() });
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const key = createPremiumKey({
    id: uuidv4(),
    key: generateKey(),
    label: body.label || "Premium Key",
    dailyLimit: body.dailyLimit || 100,
    noAds: body.noAds ?? true,
    active: true,
    usedBy: [],
    createdAt: new Date().toISOString(),
    expiresAt: body.expiresAt || undefined,
  });

  return NextResponse.json({ key }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await request.json();
  const deleted = deletePremiumKey(id);
  return NextResponse.json({ deleted });
}
