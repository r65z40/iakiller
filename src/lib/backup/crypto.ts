import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Chiffrement des sauvegardes : AES-256-GCM (authentifié), une clé de 32 octets fournie
 * en base64 dans BACKUP_ENCRYPTION_KEY. Format : "CBK1" | iv (12) | tag (16) | données.
 * La clé n'est jamais stockée avec les sauvegardes : seule son empreinte courte l'est,
 * pour signaler une mauvaise clé à la restauration.
 */
const MAGIC = Buffer.from("CBK1");

export function backupKeyFromEnv(): Buffer | null {
  const raw = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY doit contenir 32 octets encodés en base64 (openssl rand -base64 32).");
  return key;
}

export function keyFingerprint(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function encrypt(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

export function decrypt(data: Buffer, key: Buffer): Buffer {
  if (data.length < 32 || !data.subarray(0, 4).equals(MAGIC)) throw new Error("Fichier de sauvegarde chiffré invalide.");
  const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(4, 16));
  decipher.setAuthTag(data.subarray(16, 32));
  return Buffer.concat([decipher.update(data.subarray(32)), decipher.final()]);
}
