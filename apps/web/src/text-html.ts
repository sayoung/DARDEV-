export function textToHtml(text: string): string {
  if (!text) return '';
  const escaped = text.replace(/[&<>"']/g, m => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
  const paragraphs = escaped.split(/\n\s*\n/);
  return paragraphs.map(p => p.trim()).filter(Boolean).map(p => `<p>${p}</p>`).join('');
}
