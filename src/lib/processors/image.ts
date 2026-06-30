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
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;

  let pipeline = sharp(inputBuffer, { failOn: "none" })
    .rotate()
    .withMetadata({});

  pipeline = pipeline.removeAlpha();

  const scaleDown = 1 - (0.005 + Math.random() * 0.01) * intensity;
  const newW = Math.round(width * scaleDown);
  const newH = Math.round(height * scaleDown);
  pipeline = pipeline.resize(newW, newH, { kernel: "lanczos3" });
  pipeline = pipeline.resize(width, height, { kernel: "lanczos3" });

  if (opts.microCrop) {
    const cropPx = Math.max(1, Math.floor((Math.random() * 4 + 2) * intensity));
    const cropW = Math.max(1, width - cropPx * 2);
    const cropH = Math.max(1, height - cropPx * 2);
    pipeline = pipeline.extract({
      left: cropPx,
      top: cropPx,
      width: cropW,
      height: cropH,
    });
    pipeline = pipeline.resize(width, height, { kernel: "lanczos3" });
  }

  if (opts.colorShift) {
    const brightness = 1 + (Math.random() * 0.08 - 0.04) * intensity;
    const saturation = 1 + (Math.random() * 0.12 - 0.06) * intensity;
    const hue = Math.round((Math.random() * 6 - 3) * intensity);
    pipeline = pipeline.modulate({ brightness, saturation, hue });
  }

  const blurSigma = 0.3 + Math.random() * 0.5 * intensity;
  pipeline = pipeline.blur(blurSigma);

  const sharpenSigma = 0.5 + Math.random() * 0.8 * intensity;
  pipeline = pipeline.sharpen({ sigma: sharpenSigma });

  if (Math.random() < 0.5 * intensity) {
    const gamma = 0.95 + Math.random() * 0.1;
    pipeline = pipeline.gamma(gamma);
  }

  if (opts.addNoise) {
    const noiseStrength = Math.max(3, Math.floor(8 * intensity));
    const noiseBuffer = await generateNoiseOverlay(width, height, noiseStrength);
    pipeline = pipeline.composite([
      {
        input: noiseBuffer,
        blend: "overlay",
        gravity: "centre",
      },
    ]);
  }

  const tempBuf = await pipeline.jpeg({ quality: 75 + Math.floor(Math.random() * 10) }).toBuffer();
  let secondPipeline = sharp(tempBuf, { failOn: "none" });

  let outputBuffer: Buffer;
  const qualityJitter = Math.floor(Math.random() * 8 - 4);

  switch (opts.format) {
    case "png":
      outputBuffer = await secondPipeline
        .png({ compressionLevel: 5 + Math.floor(Math.random() * 4) })
        .toBuffer();
      break;
    case "webp":
      outputBuffer = await secondPipeline
        .webp({ quality: opts.quality + qualityJitter, effort: 4 + Math.floor(Math.random() * 3) })
        .toBuffer();
      break;
    default:
      outputBuffer = await secondPipeline
        .jpeg({
          quality: opts.quality + qualityJitter,
          mozjpeg: Math.random() > 0.5,
          chromaSubsampling: Math.random() > 0.5 ? "4:2:0" : "4:4:4",
        })
        .toBuffer();
  }

  outputBuffer = await sharp(outputBuffer)
    .withMetadata({})
    .toBuffer();

  const outputMeta = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    format: opts.format,
    width: outputMeta.width || width,
    height: outputMeta.height || height,
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
    raw: {
      width: w,
      height: h,
      channels: channels as 3,
    },
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
