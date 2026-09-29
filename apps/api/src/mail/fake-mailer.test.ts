import { describe, expect, it } from 'vitest';

import { FakeMailer } from './fake-mailer.js';

describe('FakeMailer', () => {
  it('keeps sent messages in memory', async () => {
    const mailer = new FakeMailer();
    const first = {
      to: 'a@xplor.local',
      subject: 'Invitation',
      text: 'lien',
      html: '<p>lien</p>',
    };
    const second = {
      to: 'b@xplor.local',
      subject: 'Reset',
      text: 'autre',
      html: '<p>autre</p>',
    };

    await mailer.send(first);
    await mailer.send(second);

    expect(mailer.sent).toEqual([first, second]);
  });
});
