import sharp from 'sharp';

export interface PanoramaMetadata {
  width: number;
  height: number;
  format: string;
}

export interface DerivativeResult {
  thumbnailBuffer: Buffer;
  metadata: PanoramaMetadata;
}

export async function generatePanoramaDerivatives(
  inputBuffer: Buffer,
): Promise<DerivativeResult> {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();

  const thumbnailBuffer = await image
    .resize({ width: 800, height: 400, fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();

  return {
    thumbnailBuffer,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    },
  };
}
