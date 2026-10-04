export function textToHtml(text: string): string {
  if (!text) return '';
  const escaped = escapeHtml(text);
  const paragraphs = escaped.split(/\n\s*\n/);
  return paragraphs.map(p => p.trim()).filter(Boolean).map(p => `<p>${p}</p>`).join('');
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, m => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
}

export function mapLinkHtml(location: { lat: number; lng: number } | null, label: string): string {
  if (!location) return '';
  const lat = escapeHtml(String(location.lat));
  const lng = escapeHtml(String(location.lng));
  const escapedLabel = escapeHtml(label);
  return `<p><a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}" target="_blank" rel="noopener noreferrer">${escapedLabel}</a></p>`;
}
