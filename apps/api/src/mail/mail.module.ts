import { Global, Module } from '@nestjs/common';

import { MAILER } from './mailer.js';
import { SmtpMailer } from './smtp-mailer.js';

@Global()
@Module({
  providers: [SmtpMailer, { provide: MAILER, useExisting: SmtpMailer }],
  exports: [MAILER],
})
export class MailModule {}
