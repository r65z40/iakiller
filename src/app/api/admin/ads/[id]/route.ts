import { NextRequest, NextResponse } from "next/server";
import { getAd, updateAd, deleteAd } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const ad = getAd(id);
  if (!ad) {
    return NextResponse.json({ error: "Publicité non trouvée" }, { status: 404 });
  }

  return NextResponse.json({ ad });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const updated = updateAd(id, body);

  if (!updated) {
    return NextResponse.json({ error: "Publicité non trouvée" }, { status: 404 });
  }

  return NextResponse.json({ ad: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = deleteAd(id);

  if (!deleted) {
    return NextResponse.json({ error: "Publicité non trouvée" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
