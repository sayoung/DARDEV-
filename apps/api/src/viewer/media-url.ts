import { PanoramaDerivativesSchema } from '@xplor/shared';

export function mediaUrl(base: string, key: string): string {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanKey = key.replace(/^\/+/, '');
  
  const encodedKey = cleanKey
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  return `${cleanBase}/${encodedKey}`;
}

export function panoramaUrls(base: string, derivatives: unknown) {
  const parsed = PanoramaDerivativesSchema.safeParse(derivatives);
  
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')} : ${i.message}`).join(', ');
    throw new Error(`Format des dérivés invalide : ${issues}`);
  }

  const data = parsed.data;

  return {
    preview: mediaUrl(base, data.preview),
    web: mediaUrl(base, data.web),
    thumb: mediaUrl(base, data.thumb),
    tiles: {
      width: data.tileGrid.cols * data.tileGrid.size,
      cols: data.tileGrid.cols,
      rows: data.tileGrid.rows,
      baseUrl: mediaUrl(base, data.tilesPrefix) + '{col}_{row}.jpg',
    },
  };
}
