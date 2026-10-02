import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { readImageDimensions } from './jpeg-dimensions.js';

describe('readImageDimensions', () => {
  it('lit les dimensions d\'un vrai JPEG', async () => {
    // Générer une image de 4096x2048
    const imageBuffer = await sharp({
      create: {
        width: 4096,
        height: 2048,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
      .jpeg()
      .toBuffer();

    // Prendre les 65536 premiers octets (ou moins si l'image est plus petite)
    const head = imageBuffer.subarray(0, 65536);

    const result = readImageDimensions(head);
    
    expect(result).toEqual({
      width: 4096,
      height: 2048,
      type: 'jpg',
    });
  });

  it('renvoie null pour un buffer invalide (aléatoire)', () => {
    const randomBuffer = Buffer.alloc(65536);
    // Remplir de valeurs aléatoires pour simuler un fichier corrompu ou d'un autre type
    for (let i = 0; i < 65536; i++) {
      randomBuffer[i] = Math.floor(Math.random() * 256);
    }

    const result = readImageDimensions(randomBuffer);
    expect(result).toBeNull();
  });

  it('renvoie null pour un buffer vide ou trop court', () => {
    const emptyBuffer = Buffer.alloc(0);
    const result = readImageDimensions(emptyBuffer);
    expect(result).toBeNull();
  });
});
