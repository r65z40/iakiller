import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

const execFileAsync = promisify(execFile);

export async function checkFfmpeg(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

export async function processVideo(
  inputBuffer: Buffer,
  originalName: string
): Promise<{ buffer: Buffer; fileName: string }> {
  const hasFfmpeg = await checkFfmpeg();

  if (!hasFfmpeg) {
    return stripVideoMetadataBasic(inputBuffer, originalName);
  }

  return processVideoWithFfmpeg(inputBuffer, originalName);
}

async function processVideoWithFfmpeg(
  inputBuffer: Buffer,
  originalName: string
): Promise<{ buffer: Buffer; fileName: string }> {
  const tmpDir = path.join(os.tmpdir(), `iakiller-${uuidv4()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  const ext = path.extname(originalName) || ".mp4";
  const inputPath = path.join(tmpDir, `input${ext}`);
  const outputPath = path.join(tmpDir, `output${ext}`);

  try {
    await fs.writeFile(inputPath, inputBuffer);

    await execFileAsync("ffmpeg", [
      "-i", inputPath,
      "-map_metadata", "-1",
      "-fflags", "+bitexact",
      "-flags:v", "+bitexact",
      "-flags:a", "+bitexact",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-y",
      outputPath,
    ], { timeout: 300000 });

    const outputBuffer = await fs.readFile(outputPath);
    const fileName = `processed_${Date.now()}${ext}`;

    return { buffer: outputBuffer, fileName };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function stripVideoMetadataBasic(
  inputBuffer: Buffer,
  originalName: string
): Promise<{ buffer: Buffer; fileName: string }> {
  const ext = path.extname(originalName) || ".mp4";
  const fileName = `processed_${Date.now()}${ext}`;
  return { buffer: inputBuffer, fileName };
}

export function getVideoInfo(buffer: Buffer): {
  size: number;
  sizeFormatted: string;
} {
  const size = buffer.length;
  const sizeFormatted =
    size > 1024 * 1024
      ? `${(size / (1024 * 1024)).toFixed(2)} MB`
      : `${(size / 1024).toFixed(2)} KB`;

  return { size, sizeFormatted };
}
