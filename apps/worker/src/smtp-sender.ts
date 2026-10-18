import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

/** Expéditeur fixe en local comme apps/api/src/mail/smtp-mailer.ts (D-45). */
export const MAIL_FROM = 'Xplor <noreply@xplor.local>';

export interface SmtpSenderEnv {
  SMTP_HOST: string;
  SMTP_PORT: number;
}

export interface SmtpSendMailInput {
  to: string;
  subject: string;
  text: string;
}

export interface SmtpTransporter {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<unknown>;
  close(): void;
}

export type CreateTransportFn = (
  options: SMTPTransport.Options,
) => SmtpTransporter;

export function smtpTransportOptions(
  env: SmtpSenderEnv,
): SMTPTransport.Options {
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
  };
}

export interface SmtpSender {
  sendMail(message: SmtpSendMailInput): Promise<void>;
  close(): void;
}

export function createSmtpSender(
  env: SmtpSenderEnv,
  createTransport: CreateTransportFn = nodemailer.createTransport,
): SmtpSender {
  const transport = createTransport(smtpTransportOptions(env));

  return {
    async sendMail(message: SmtpSendMailInput): Promise<void> {
      await transport.sendMail({
        from: MAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    },
    close(): void {
      transport.close();
    },
  };
}
