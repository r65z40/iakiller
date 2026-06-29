import sharp from "sharp";

interface ImageProcessOptions {
  addNoise: boolean;
  colorShift: boolean;
  microCrop: boolean;
  quality: number;
  format: "jpeg" | "png" | "webp";
}

const defaultOptions: ImageProcessOptions = {
  addNoise: true,
  colorShift: true,
  microCrop: true,
  quality: 88,
  format: "jpeg",
};

export async function processImage(
  inputBuffer: Buffer,
  options: Partial<ImageProcessOptions> = {}
): Promise<{ buffer: Buffer; format: string; width: number; height: number }> {
  const opts = { ...defaultOptions, ...options };

  const metadata = await sharp(inputBuffer).metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;

  let pipeline = sharp(inputBuffer, { failOn: "none" })
    .rotate()
    .removeAlpha();

  if (opts.microCrop) {
    const cropPx = Math.max(1, Math.floor(Math.random() * 3) + 1);
    pipeline = pipeline.extract({
      left: cropPx,
      top: cropPx,
      width: Math.max(1, width - cropPx * 2),
      height: Math.max(1, height - cropPx * 2),
    });
  }

  if (opts.colorShift) {
    const brightness = 1 + (Math.random() * 0.04 - 0.02);
    const saturation = 1 + (Math.random() * 0.06 - 0.03);
    pipeline = pipeline.modulate({ brightness, saturation });
  }

  if (opts.addNoise) {
    const noiseBuffer = await generateNoiseOverlay(
      opts.microCrop ? width - 6 : width,
      opts.microCrop ? height - 6 : height
    );
    pipeline = pipeline.composite([
      {
        input: noiseBuffer,
        blend: "soft-light",
      },
    ]);
  }

  let outputBuffer: Buffer;

  switch (opts.format) {
    case "png":
      outputBuffer = await pipeline
        .png({ compressionLevel: 6 + Math.floor(Math.random() * 3) })
        .toBuffer();
      break;
    case "webp":
      outputBuffer = await pipeline
        .webp({ quality: opts.quality + Math.floor(Math.random() * 5 - 2) })
        .toBuffer();
      break;
    default:
      outputBuffer = await pipeline
        .jpeg({
          quality: opts.quality + Math.floor(Math.random() * 5 - 2),
          mozjpeg: true,
        })
        .toBuffer();
  }

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
  height: number
): Promise<Buffer> {
  const channels = 3;
  const pixels = width * height * channels;
  const noise = Buffer.alloc(pixels);

  for (let i = 0; i < pixels; i++) {
    noise[i] = 128 + Math.floor(Math.random() * 6 - 3);
  }

  return sharp(noise, {
    raw: {
      width: Math.max(1, width),
      height: Math.max(1, height),
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
