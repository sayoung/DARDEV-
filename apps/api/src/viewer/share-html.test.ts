import { describe, it, expect } from 'vitest';
import { renderShareHtml } from './share-html.js';

describe('renderShareHtml', () => {
  it('génère les balises requises avec une image de couverture', () => {
    const html = renderShareHtml({
      title: 'Ma visite',
      summary: 'Un résumé',
      coverUrl: 'https://example.com/cover.jpg',
      pageUrl: 'https://example.com/share',
      lang: 'fr',
      webAppUrl: 'https://example.com/v/123'
    });

    expect(html).toContain('<html lang="fr" dir="ltr">');
    expect(html).toContain('<title>Ma visite</title>');
    expect(html).toContain('<meta name="description" content="Un résumé">');
    expect(html).toContain('<meta property="og:title" content="Ma visite">');
    expect(html).toContain('<meta property="og:description" content="Un résumé">');
    expect(html).toContain('<meta property="og:url" content="https://example.com/share">');
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).toContain('<meta property="og:image" content="https://example.com/cover.jpg">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<meta http-equiv="refresh" content="0;url=https://example.com/v/123">');
    expect(html).toContain('<a href="https://example.com/v/123">');
  });

  it('génère sans og:image si aucune image n\'est fournie', () => {
    const html = renderShareHtml({
      title: 'Ma visite',
      summary: 'Un résumé',
      coverUrl: null,
      pageUrl: 'https://example.com/share',
      lang: 'ar',
      webAppUrl: 'https://example.com/v/123'
    });

    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).not.toContain('og:image');
  });

  it('échappe correctement les caractères spéciaux dans le titre et les autres champs', () => {
    const html = renderShareHtml({
      title: '<script>alert("XSS")</script> & "titre" \'!',
      summary: '<>""&&',
      coverUrl: 'https://a.com/?b="&c',
      pageUrl: 'https://a.com/p',
      lang: 'en',
      webAppUrl: 'https://a.com/v'
    });

    expect(html).toContain('<title>&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt; &amp; &quot;titre&quot; &#39;!</title>');
    expect(html).toContain('content="&lt;&gt;&quot;&quot;&amp;&amp;"');
    expect(html).toContain('content="https://a.com/?b=&quot;&amp;c"');
  });
});
