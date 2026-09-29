import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

import { ENV } from '../config/config.module.js';
import { type Env } from '../config/env.js';
import { type Mailer, type MailMessage } from './mailer.js';

/** Expéditeur fixe en local : Mailpit n'exige pas d'authentification (D-45). */
export const MAIL_FROM = 'Xplor <noreply@xplor.local>';

export function smtpTransportOptions(
  env: Pick<Env, 'SMTP_HOST' | 'SMTP_PORT'>,
): SMTPTransport.Options {
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
  };
}

@Injectable()
export class SmtpMailer implements Mailer, OnModuleDestroy {
  private readonly transport: Transporter;

  constructor(@Inject(ENV) env: Pick<Env, 'SMTP_HOST' | 'SMTP_PORT'>) {
    this.transport = createTransport(smtpTransportOptions(env));
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: MAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  onModuleDestroy(): void {
    this.transport.close();
  }
}
