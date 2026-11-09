import { dir } from '@xplor/i18n';
import type { Lang } from '@xplor/shared';

const LEGAL_BLOCKS: readonly string[] = [
  'publisher',
  'hosting',
  'privacy',
  'contact',
];

export function renderLegalPage(
  doc: Document,
  root: HTMLElement,
  t: (key: string) => string,
  lang: Lang,
  backHref: string | null
): HTMLElement {
  const direction = dir(lang);
  root.setAttribute('lang', lang);
  root.setAttribute('dir', direction);
  root.lang = lang;
  root.dir = direction;
  root.classList.add('xplor-legal');

  const main = doc.createElement('main');
  main.className = 'xplor-legal';

  const h1 = doc.createElement('h1');
  h1.className = 'xplor-legal-title';
  h1.textContent = t('legal.title');
  main.appendChild(h1);

  for (const block of LEGAL_BLOCKS) {
    const section = doc.createElement('section');
    section.className = `xplor-legal-section xplor-legal-${block}`;

    const h2 = doc.createElement('h2');
    h2.textContent = t(`legal.${block}.title`);
    section.appendChild(h2);

    const p = doc.createElement('p');
    p.textContent = t(`legal.${block}.body`);
    section.appendChild(p);

    main.appendChild(section);
  }

  if (backHref !== null) {
    const backLink = doc.createElement('a');
    backLink.setAttribute('href', backHref);
    backLink.href = backHref;
    backLink.className = 'xplor-legal-back';
    backLink.textContent = t('legal.back');
    main.appendChild(backLink);
  }

  root.replaceChildren(main);
  return main;
}
