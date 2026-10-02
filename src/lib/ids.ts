import { randomBytes, createHash } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Identifiant aléatoire (base62). 20 caractères ≈ 119 bits. */
export function newId(length = 20): string {
  const bytes = randomBytes(length * 2);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    const b = bytes[i];
    if (b < 248) out += ALPHABET[b % 62];
  }
  return out.length === length ? out : newId(length);
}

/** Jeton public non devinable (QR code, invitations). */
export function newToken(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
