import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const s = process.env.BETTER_AUTH_SECRET || process.env.APP_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET manquant");
  return s || "dev-only-secret-change-me";
}

export function sign(payload: string): string {
  const mac = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

export function verify(token: string): string | null {
  const [p, mac] = token.split(".");
  if (!p || !mac) return null;
  const payload = Buffer.from(p, "base64url").toString();
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}

/** Jeton de formulaire : lie l'envoi à une carte et à un instant d'affichage (anti-robot). */
export function leadFormToken(cardId: string, now = Date.now()): string {
  return sign(`lead:${cardId}:${now}`);
}

export function checkLeadFormToken(token: unknown, cardId: string, now = Date.now()): "ok" | "too_fast" | "invalid" {
  if (typeof token !== "string" || token.length > 300) return "invalid";
  const payload = verify(token);
  if (!payload) return "invalid";
  const [kind, id, ts] = payload.split(":");
  if (kind !== "lead" || id !== cardId) return "invalid";
  const issued = Number(ts);
  if (!Number.isFinite(issued)) return "invalid";
  const age = now - issued;
  if (age < 2500) return "too_fast";
  if (age > 1000 * 60 * 60 * 24) return "invalid";
  return "ok";
}
