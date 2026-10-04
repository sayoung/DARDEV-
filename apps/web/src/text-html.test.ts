import { describe, it, expect } from 'vitest';
import { textToHtml, mapLinkHtml } from './text-html.js';

describe('textToHtml', () => {
  it('returns empty string for empty input', () => {
    expect(textToHtml('')).toBe('');
  });

  it('escapes HTML characters', () => {
    expect(textToHtml('<script>alert("XSS & co\'s");</script>'))
      .toBe('<p>&lt;script&gt;alert(&quot;XSS &amp; co&#39;s&quot;);&lt;/script&gt;</p>');
  });

  it('splits on empty lines into paragraphs', () => {
    const input = `Paragraph 1

Paragraph 2

Paragraph 3`;
    expect(textToHtml(input)).toBe('<p>Paragraph 1</p><p>Paragraph 2</p><p>Paragraph 3</p>');
  });

  it('handles multiple empty lines and whitespace', () => {
    const input = `  Line 1  \n\n\n  Line 2  `;
    expect(textToHtml(input)).toBe('<p>Line 1</p><p>Line 2</p>');
  });
});

describe('mapLinkHtml', () => {
  it('returns empty string if location is null', () => {
    expect(mapLinkHtml(null, 'Voir')).toBe('');
  });

  it('builds valid HTML link with escaped label', () => {
    const loc = { lat: 48.8584, lng: 2.2945 };
    const label = 'Tour Eiffel & co';
    const html = mapLinkHtml(loc, label);
    expect(html).toBe('<p><a href="https://www.openstreetmap.org/?mlat=48.8584&mlon=2.2945#map=17/48.8584/2.2945" target="_blank" rel="noopener noreferrer">Tour Eiffel &amp; co</a></p>');
  });
});
