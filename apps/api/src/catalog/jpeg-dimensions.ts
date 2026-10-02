import { imageSize } from 'image-size';

export function readImageDimensions(head: Buffer): { width: number; height: number; type: string } | null {
  try {
    const dimensions = imageSize(head);
    
    if (
      typeof dimensions.width !== 'number' ||
      typeof dimensions.height !== 'number' ||
      typeof dimensions.type !== 'string'
    ) {
      return null;
    }

    return {
      width: dimensions.width,
      height: dimensions.height,
      type: dimensions.type,
    };
  } catch {
    return null;
  }
}
