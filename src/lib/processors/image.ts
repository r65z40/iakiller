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
  const intensity = Math.max(0.2, Math.min(1, opts.intensity / 100));

  const metadata = await sharp(inputBuffer).metadata();
  const origW = metadata.width || 1024;
  const origH = metadata.height || 1024;

  // Step 1: Strip ALL metadata, remove alpha
  let buf = await sharp(inputBuffer, { failOn: "none" })
    .rotate()
    .removeAlpha()
    .toBuffer();

  // Step 2: Aggressive resize cycle — downscale significantly then upscale
  // This destroys pixel-level AI fingerprints by forcing interpolation
  const scale1 = 1 - (0.03 + Math.random() * 0.05) * intensity;
  const w1 = Math.max(16, Math.round(origW * scale1));
  const h1 = Math.max(16, Math.round(origH * scale1));
  buf = await sharp(buf).resize(w1, h1, { kernel: "cubic" }).toBuffer();
  buf = await sharp(buf).resize(origW, origH, { kernel: "lanczos3" }).toBuffer();

  // Step 3: Second resize cycle with different kernel to add more interpolation artifacts
  const scale2 = 1 + (0.02 + Math.random() * 0.03) * intensity;
  const w2 = Math.max(16, Math.round(origW * scale2));
  const h2 = Math.max(16, Math.round(origH * scale2));
  buf = await sharp(buf).resize(w2, h2, { kernel: "lanczos2" }).toBuffer();
  buf = await sharp(buf).resize(origW, origH, { kernel: "lanczos3" }).toBuffer();

  // Step 4: Micro crop + resize back
  if (opts.microCrop) {
    const cropPx = Math.max(2, Math.floor((Math.random() * 6 + 3) * intensity));
    const cropW = Math.max(16, origW - cropPx * 2);
    const cropH = Math.max(16, origH - cropPx * 2);
    buf = await sharp(buf)
      .extract({ left: cropPx, top: cropPx, width: cropW, height: cropH })
      .toBuffer();
    buf = await sharp(buf).resize(origW, origH, { kernel: "lanczos3" }).toBuffer();
  }

  // Step 5: Strong color manipulation
  if (opts.colorShift) {
    const brightness = 1 + (Math.random() * 0.14 - 0.07) * intensity;
    const saturation = 1 + (Math.random() * 0.20 - 0.10) * intensity;
    const hue = Math.round((Math.random() * 10 - 5) * intensity);
    buf = await sharp(buf).modulate({ brightness, saturation, hue }).toBuffer();
  }

  // Step 6: Aggressive blur + sharpen cycle (alters frequency domain heavily)
  const blurSigma = Math.max(0.3, 0.5 + Math.random() * 1.0 * intensity);
  buf = await sharp(buf).blur(blurSigma).toBuffer();

  const sharpenSigma = 0.8 + Math.random() * 1.2 * intensity;
  const sharpenFlat = 0.5 + Math.random() * 1.0 * intensity;
  const sharpenJagged = 0.3 + Math.random() * 0.8 * intensity;
  buf = await sharp(buf).sharpen(sharpenSigma, sharpenFlat, sharpenJagged).toBuffer();

  // Step 7: Second blur+sharpen pass for max intensity
  if (intensity > 0.5) {
    const blur2 = Math.max(0.3, 0.3 + Math.random() * 0.6 * intensity);
    buf = await sharp(buf).blur(blur2).toBuffer();
    buf = await sharp(buf).sharpen(0.6 + Math.random() * 0.5).toBuffer();
  }

  // Step 8: Gamma correction
  const gamma = 0.90 + Math.random() * 0.20;
  buf = await sharp(buf).gamma(gamma).toBuffer();

  // Step 9: Apply strong Gaussian noise overlay
  if (opts.addNoise) {
    const curMeta = await sharp(buf).metadata();
    const curW = curMeta.width || origW;
    const curH = curMeta.height || origH;
    const noiseStrength = Math.max(5, Math.floor(15 * intensity));
    const noiseBuffer = await generateNoiseOverlay(curW, curH, noiseStrength);
    buf = await sharp(buf)
      .composite([{ input: noiseBuffer, blend: "overlay" }])
      .toBuffer();
  }

  // Step 10: First lossy re-encode (destroys AI compression patterns)
  buf = await sharp(buf)
    .jpeg({ quality: 65 + Math.floor(Math.random() * 10), mozjpeg: true })
    .toBuffer();

  // Step 11: Second lossy re-encode at different quality
  buf = await sharp(buf)
    .jpeg({
      quality: 78 + Math.floor(Math.random() * 8),
      mozjpeg: false,
      chromaSubsampling: "4:2:0",
    })
    .toBuffer();

  // Step 12: Slight rotation (non-zero, non-90) to force pixel resampling
  if (intensity > 0.3) {
    const angle = (Math.random() * 0.8 - 0.4) * intensity;
    if (Math.abs(angle) > 0.05) {
      buf = await sharp(buf)
        .rotate(angle, { background: { r: 0, g: 0, b: 0 } })
        .toBuffer();
      // Crop back to original aspect ratio
      const rotMeta = await sharp(buf).metadata();
      const rw = rotMeta.width || origW;
      const rh = rotMeta.height || origH;
      if (rw > origW || rh > origH) {
        const left = Math.floor((rw - origW) / 2);
        const top = Math.floor((rh - origH) / 2);
        buf = await sharp(buf)
          .extract({ left: Math.max(0, left), top: Math.max(0, top), width: Math.min(origW, rw), height: Math.min(origH, rh) })
          .toBuffer();
      }
      buf = await sharp(buf).resize(origW, origH, { kernel: "lanczos3" }).toBuffer();
    }
  }

  // Step 13: Apply a second lighter noise pass
  if (opts.addNoise && intensity > 0.4) {
    const curMeta = await sharp(buf).metadata();
    const curW = curMeta.width || origW;
    const curH = curMeta.height || origH;
    const noiseBuffer2 = await generateNoiseOverlay(curW, curH, Math.max(3, Math.floor(8 * intensity)));
    buf = await sharp(buf)
      .composite([{ input: noiseBuffer2, blend: "soft-light" }])
      .toBuffer();
  }

  // Step 14: Final color tweak — subtle tint
  const tintR = 128 + Math.floor((Math.random() * 12 - 6) * intensity);
  const tintG = 128 + Math.floor((Math.random() * 12 - 6) * intensity);
  const tintB = 128 + Math.floor((Math.random() * 12 - 6) * intensity);
  buf = await sharp(buf).tint({ r: tintR, g: tintG, b: tintB }).toBuffer();

  // Step 15: Undo the tint harshness with a moderate modulate
  buf = await sharp(buf).modulate({ brightness: 1.0, saturation: 1.05 }).toBuffer();

  // Step 16: Third and final lossy encode
  buf = await sharp(buf)
    .jpeg({ quality: 70 + Math.floor(Math.random() * 12), mozjpeg: Math.random() > 0.5 })
    .toBuffer();

  // Step 17: Final output in requested format
  const qualityJitter = Math.floor(Math.random() * 6 - 3);
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
  strength: number = 8
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
