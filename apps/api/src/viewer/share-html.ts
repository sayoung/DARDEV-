import { type Lang } from '@xplor/shared';
import { dir } from '@xplor/i18n';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderShareHtml(meta: {
  title: string;
  summary: string;
  coverUrl: string | null;
  pageUrl: string;
  lang: Lang;
  webAppUrl: string;
}): string {
  const safeTitle = escapeHtml(meta.title);
  const safeSummary = escapeHtml(meta.summary);
  const safePageUrl = escapeHtml(meta.pageUrl);
  const safeWebAppUrl = escapeHtml(meta.webAppUrl);
  const langDir = dir(meta.lang);

  const ogImage = meta.coverUrl
    ? `\n    <meta property="og:image" content="${escapeHtml(meta.coverUrl)}">`
    : '';

  return `<!DOCTYPE html>
<html lang="${meta.lang}" dir="${langDir}">
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeSummary}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeSummary}">
  <meta property="og:url" content="${safePageUrl}">
  <meta property="og:type" content="website">${ogImage}
  <meta name="twitter:card" content="summary_large_image">
  <meta http-equiv="refresh" content="0;url=${safeWebAppUrl}">
</head>
<body>
  <a href="${safeWebAppUrl}">${safeWebAppUrl}</a>
</body>
</html>`;
}
