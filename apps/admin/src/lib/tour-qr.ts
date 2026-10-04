import QRCode from 'qrcode';

export function shareUrl(webBaseUrl: string, shareToken: string, params?: Record<string, string>): string {
  const base = webBaseUrl.replace(/\/+$/, '');
  const url = new URL(`${base}/v/${shareToken}`);
  
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }
  }
  
  return url.toString();
}

export async function tourQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 2 });
}
