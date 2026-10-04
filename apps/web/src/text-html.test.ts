import { describe, it, expect } from 'vitest';
import { textToHtml } from './text-html.js';

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
