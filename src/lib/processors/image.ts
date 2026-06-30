import sharp from "sharp";

interface ImageProcessOptions {
  addNoise: boolean;
  colorShift: boolean;
  microCrop: boolean;
  quality: number;
  format: "jpeg" | "png" | "webp";
  intensity: number;
}

const defaultOptions: ImageProcessOptions = {
  addNoise: true,
  colorShift: true,
  microCrop: true,
  quality: 88,
  format: "jpeg",
  intensity: 75,
};

export async function processImage(
  inputBuffer: Buffer,
  options: Partial<ImageProcessOptions> = {}
): Promise<{ buffer: Buffer; format: string; width: number; height: number }> {
  const opts = { ...defaultOptions, ...options };
  const intensity = Math.max(0, Math.min(100, opts.intensity)) / 100;

  const metadata = await sharp(inputBuffer).metadata();
  const origW = metadata.width || 1024;
  const origH = metadata.height || 1024;

  // Step 1: Strip metadata + remove alpha
  let buf = await sharp(inputBuffer, { failOn: "none" })
    .rotate()
    .removeAlpha()
    .toBuffer();

  // Step 2: Resize cycle — downscale then upscale to break pixel-level patterns
  const scaleDown = 1 - (0.005 + Math.random() * 0.01) * intensity;
  const tmpW = Math.max(1, Math.round(origW * scaleDown));
  const tmpH = Math.max(1, Math.round(origH * scaleDown));
  buf = await sharp(buf).resize(tmpW, tmpH, { kernel: "lanczos3" }).toBuffer();
  buf = await sharp(buf).resize(origW, origH, { kernel: "lanczos3" }).toBuffer();

  // Step 3: Micro crop + resize back to original dimensions
  if (opts.microCrop) {
    const cropPx = Math.max(1, Math.floor((Math.random() * 4 + 2) * intensity));
    const cropW = Math.max(1, origW - cropPx * 2);
    const cropH = Math.max(1, origH - cropPx * 2);
    buf = await sharp(buf)
      .extract({ left: cropPx, top: cropPx, width: cropW, height: cropH })
      .toBuffer();
    buf = await sharp(buf).resize(origW, origH, { kernel: "lanczos3" }).toBuffer();
  }

  // Step 4: Color shifts
  if (opts.colorShift) {
    const brightness = 1 + (Math.random() * 0.08 - 0.04) * intensity;
    const saturation = 1 + (Math.random() * 0.12 - 0.06) * intensity;
    const hue = Math.round((Math.random() * 6 - 3) * intensity);
    buf = await sharp(buf).modulate({ brightness, saturation, hue }).toBuffer();
  }

  // Step 5: Blur then sharpen to alter frequency domain
  const blurSigma = Math.max(0.3, 0.3 + Math.random() * 0.5 * intensity);
  buf = await sharp(buf).blur(blurSigma).toBuffer();

  const sharpenSigma = 0.5 + Math.random() * 0.8 * intensity;
  buf = await sharp(buf).sharpen({ sigma: sharpenSigma }).toBuffer();

  // Step 6: Gamma correction
  if (Math.random() < 0.5 * intensity) {
    const gamma = 0.95 + Math.random() * 0.1;
    buf = await sharp(buf).gamma(gamma).toBuffer();
  }

  // Step 7: Noise overlay — get actual dimensions first
  if (opts.addNoise) {
    const curMeta = await sharp(buf).metadata();
    const curW = curMeta.width || origW;
    const curH = curMeta.height || origH;
    const noiseStrength = Math.max(3, Math.floor(8 * intensity));
    const noiseBuffer = await generateNoiseOverlay(curW, curH, noiseStrength);
    buf = await sharp(buf)
      .composite([{ input: noiseBuffer, blend: "overlay" }])
      .toBuffer();
  }

  // Step 8: Double encoding — intermediate JPEG to destroy AI compression artifacts
  buf = await sharp(buf)
    .jpeg({ quality: 72 + Math.floor(Math.random() * 12) })
    .toBuffer();

  // Step 9: Final encoding in requested format
  const qualityJitter = Math.floor(Math.random() * 8 - 4);
  let outputBuffer: Buffer;

  switch (opts.format) {
    case "png":
      outputBuffer = await sharp(buf)
        .png({ compressionLevel: 5 + Math.floor(Math.random() * 4) })
        .toBuffer();
      break;
    case "webp":
      outputBuffer = await sharp(buf)
        .webp({ quality: opts.quality + qualityJitter, effort: 4 + Math.floor(Math.random() * 3) })
        .toBuffer();
      break;
    default:
      outputBuffer = await sharp(buf)
        .jpeg({
          quality: opts.quality + qualityJitter,
          mozjpeg: Math.random() > 0.5,
          chromaSubsampling: Math.random() > 0.5 ? "4:2:0" : "4:4:4",
        })
        .toBuffer();
  }

  const outputMeta = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    format: opts.format,
    width: outputMeta.width || origW,
    height: outputMeta.height || origH,
  };
}

async function generateNoiseOverlay(
  width: number,
  height: number,
  strength: number = 5
): Promise<Buffer> {
  const channels = 3;
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const pixels = w * h * channels;
  const noise = Buffer.alloc(pixels);

  for (let i = 0; i < pixels; i++) {
    const u1 = Math.random();
    const u2 = Math.random();
    const gaussian = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
    noise[i] = Math.max(0, Math.min(255, Math.round(128 + gaussian * strength)));
  }

  return sharp(noise, {
    raw: { width: w, height: h, channels: channels as 3 },
  })
    .png()
    .toBuffer();
}

export function getImageInfo(metadata: sharp.Metadata) {
  return {
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    hasExif: !!metadata.exif,
    hasIcc: !!metadata.icc,
    hasXmp: !!metadata.xmp,
    hasIptc: !!metadata.iptc,
    size: metadata.size,
  };
}
