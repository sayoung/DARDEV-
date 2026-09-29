import { describe, expect, it } from 'vitest';

import { mailActionLink, renderMail } from './render-mail.js';

const ARABIC = /\p{Script=Arabic}/u;

describe('renderMail', () => {
  const base = 'http://localhost:5173';
  const token = 'tok_en-clair';

  it('includes the invite or reset link', () => {
    const inviteLink = mailActionLink(base, 'invite', token);
    expect(inviteLink).toBe(`${base}/invite/${token}`);
    const invite = renderMail('invite', 'fr', inviteLink);
    expect(invite.text).toContain(inviteLink);
    expect(invite.html).toContain(inviteLink);

    const resetLink = mailActionLink(`${base}/`, 'reset', token);
    expect(resetLink).toBe(`${base}/reset/${token}`);
    const reset = renderMail('reset', 'en', resetLink);
    expect(reset.text).toContain(resetLink);
    expect(reset.html).toContain(resetLink);
  });

  it('renders the Arabic templates in Arabic', () => {
    for (const kind of ['invite', 'reset'] as const) {
      const link = mailActionLink(base, kind, token);
      const mail = renderMail(kind, 'ar', link);
      expect(mail.subject).toMatch(ARABIC);
      expect(mail.text).toMatch(ARABIC);
      expect(mail.html).toMatch(ARABIC);
      expect(mail.text).toContain(link);
      expect(mail.html).toContain(link);
    }
  });
});
