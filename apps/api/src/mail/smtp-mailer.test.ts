import { describe, expect, it } from 'vitest';

import { smtpTransportOptions } from './smtp-mailer.js';

describe('smtpTransportOptions', () => {
  it('targets Mailpit without authentication', () => {
    expect(smtpTransportOptions({ SMTP_HOST: 'localhost', SMTP_PORT: 1025 })).toEqual({
      host: 'localhost',
      port: 1025,
      secure: false,
    });
  });
});
