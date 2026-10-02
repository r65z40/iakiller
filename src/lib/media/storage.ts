import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Stockage d'objets. STORAGE_DRIVER=local (défaut) écrit dans ./storage ;
 * STORAGE_DRIVER=s3 utilise n'importe quel service compatible S3 (bucket PRIVÉ :
 * les fichiers sont toujours servis par l'application après contrôle d'accès).
 */
export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

class LocalStorage implements ObjectStorage {
  constructor(private root: string) {}
  private resolve(key: string) {
    if (!/^[A-Za-z0-9/_.-]+$/.test(key) || key.includes("..")) throw new Error("Clé de stockage invalide");
    return path.join(this.root, key);
  }
  async put(key: string, body: Buffer) {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }
  async get(key: string) {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await unlink(this.resolve(key)).catch(() => undefined);
  }
}

class S3Storage implements ObjectStorage {
  private client: S3Client;
  constructor(private bucket: string) {
    this.client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
          : undefined,
    });
  }
  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }
  async get(key: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      return Buffer.from(await res.Body.transformToByteArray());
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let instance: ObjectStorage | null = null;
export function storage(): ObjectStorage {
  if (!instance) {
    if (process.env.STORAGE_DRIVER === "s3") {
      if (!process.env.S3_BUCKET) throw new Error("S3_BUCKET manquant");
      instance = new S3Storage(process.env.S3_BUCKET);
    } else {
      instance = new LocalStorage(path.resolve(process.env.LOCAL_STORAGE_DIR || "./storage"));
    }
  }
  return instance;
}
