import { resources } from '@xplor/i18n';
import type { Lang } from '@xplor/shared';

export type MailKind = 'invite' | 'reset';

export type RenderedMail = {
  subject: string;
  text: string;
  html: string;
};

const LINK_PLACEHOLDER = '{link}';

/** Lien absolu : `ADMIN_BASE_URL` + `/invite/<token>` ou `/reset/<token>`. */
export function mailActionLink(adminBaseUrl: string, kind: MailKind, token: string): string {
  const base = adminBaseUrl.replace(/\/+$/, '');
  const path = kind === 'invite' ? '/invite/' : '/reset/';
  return `${base}${path}${token}`;
}

/** Sujet et corps dans la langue du destinataire. Le lien remplace `{link}`. */
export function renderMail(kind: MailKind, lang: Lang, link: string): RenderedMail {
  const template = resources[lang].mail[kind];
  return {
    subject: template.subject,
    text: template.text.replaceAll(LINK_PLACEHOLDER, link),
    html: template.html.replaceAll(LINK_PLACEHOLDER, escapeHtml(link)),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
