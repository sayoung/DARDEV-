import sharp from 'sharp';

export interface FlatDerivatives {
  preview: Buffer;
  web: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

export async function generateFlatDerivatives(input: Buffer): Promise<FlatDerivatives> {
  const metadata = await sharp(input).metadata();

  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error("Les dimensions de l'image (largeur et hauteur) sont introuvables.");
  }

  const preview = await sharp(input)
    .resize({ width: 512, height: 256, fit: 'fill' })
    .jpeg({ quality: 70 })
    .toBuffer();

  const web = await sharp(input)
    .resize({ width: 4096, height: 2048 })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  const extractWidth = Math.round(width / 4);
  const extractHeight = Math.round((extractWidth * 225) / 400);
  const extractLeft = Math.round((width - extractWidth) / 2);
  const extractTop = Math.round((height - extractHeight) / 2);

  const thumb = await sharp(input)
    .extract({ width: extractWidth, height: extractHeight, left: extractLeft, top: extractTop })
    .resize({ width: 400, height: 225 })
    .jpeg({ quality: 80 })
    .toBuffer();

  return { preview, web, thumb, width, height };
}
