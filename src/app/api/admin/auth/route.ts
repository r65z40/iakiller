import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdmin, createAdmin } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      );
    }

    let admin = getAdmin(email);

    if (!admin) {
      const defaultEmail = process.env.ADMIN_EMAIL || "admin@iakiller.com";
      const defaultPassword = process.env.ADMIN_PASSWORD || "admin123";

      if (email === defaultEmail && password === defaultPassword) {
        const hash = await bcrypt.hash(password, 12);
        admin = {
          id: uuidv4(),
          email: defaultEmail,
          passwordHash: hash,
          createdAt: new Date().toISOString(),
        };
        createAdmin(admin);
      } else {
        return NextResponse.json(
          { error: "Identifiants incorrects" },
          { status: 401 }
        );
      }
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Identifiants incorrects" },
        { status: 401 }
      );
    }

    const token = await signToken({ email: admin.email, id: admin.id });

    const response = NextResponse.json({ success: true });
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Erreur d'authentification" },
      { status: 500 }
    );
  }
}
