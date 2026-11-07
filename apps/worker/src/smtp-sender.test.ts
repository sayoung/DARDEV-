import { describe, expect, it } from 'vitest';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

import {
  createSmtpSender,
  MAIL_FROM,
  smtpTransportOptions,
  type CreateTransportFn,
  type SmtpSenderEnv,
  type SmtpTransporter,
  type SmtpTransporterAttachment,
} from './smtp-sender.js';

interface SentMailRecord {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: SmtpTransporterAttachment[];
}

function createFakeTransportHarness(config?: {
  sendMailError?: Error;
  createTransportError?: Error;
}): {
  createTransport: CreateTransportFn;
  receivedOptions: SMTPTransport.Options[];
  sentMails: SentMailRecord[];
  getCloseCallCount: () => number;
} {
  const receivedOptions: SMTPTransport.Options[] = [];
  const sentMails: SentMailRecord[] = [];
  let closeCallCount = 0;

  const fakeTransporter: SmtpTransporter = {
    sendMail: (options: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html?: string;
      attachments?: SmtpTransporterAttachment[];
    }): Promise<unknown> => {
      if (config?.sendMailError !== undefined) {
        return Promise.reject(config.sendMailError);
      }
      sentMails.push({
        from: options.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      });
      return Promise.resolve({ messageId: '<test-message-id@xplor.local>' });
    },
    close: (): void => {
      closeCallCount += 1;
    },
  };

  const createTransport: CreateTransportFn = (
    options: SMTPTransport.Options,
  ): SmtpTransporter => {
    if (config?.createTransportError !== undefined) {
      throw config.createTransportError;
    }
    receivedOptions.push(options);
    return fakeTransporter;
  };

  return {
    createTransport,
    receivedOptions,
    sentMails,
    getCloseCallCount: (): number => closeCallCount,
  };
}

describe('smtp-sender (F-54 / F-83)', () => {
  const defaultEnv: SmtpSenderEnv = {
    SMTP_HOST: 'mailpit.local',
    SMTP_PORT: 1025,
  };

  describe('constantes et options de transport', () => {
    it('définit l expéditeur fixe Xplor identique à l API', () => {
      expect(MAIL_FROM).toBe('Xplor <noreply@xplor.local>');
    });

    it('produit les options host/port/secure pour nodemailer', () => {
      const options = smtpTransportOptions({
        SMTP_HOST: 'smtp.xplor.ma',
        SMTP_PORT: 2525,
      });

      expect(options).toEqual({
        host: 'smtp.xplor.ma',
        port: 2525,
        secure: false,
      });
    });
  });

  describe('createSmtpSender avec transport factice', () => {
    it('transmet les options host et port au constructeur de transport', () => {
      const harness = createFakeTransportHarness();
      const env: SmtpSenderEnv = {
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: 8025,
      };

      createSmtpSender(env, harness.createTransport);

      expect(harness.receivedOptions).toHaveLength(1);
      const [firstOption] = harness.receivedOptions;
      expect(firstOption).toEqual({
        host: '127.0.0.1',
        port: 8025,
        secure: false,
      });
    });

    it('transmet tous les champs requis lors de sendMail avec l expéditeur fixe', async () => {
      const harness = createFakeTransportHarness();
      const sender = createSmtpSender(defaultEnv, harness.createTransport);

      await sender.sendMail({
        to: 'admin@xplor.ma',
        subject: '[Xplor] Alerte : 1 kiosque hors ligne',
        text: 'Le kiosque suivant est hors ligne depuis plus de 2 heures :',
      });

      expect(harness.sentMails).toEqual([
        {
          from: 'Xplor <noreply@xplor.local>',
          to: 'admin@xplor.ma',
          subject: '[Xplor] Alerte : 1 kiosque hors ligne',
          text: 'Le kiosque suivant est hors ligne depuis plus de 2 heures :',
          html: undefined,
          attachments: undefined,
        },
      ]);
    });

    it('transmet les champs html et pièces jointes (Buffer) au transport', async () => {
      const harness = createFakeTransportHarness();
      const sender = createSmtpSender(defaultEnv, harness.createTransport);

      const fakePdf = Buffer.from('%PDF-1.4 test buffer');
      await sender.sendMail({
        to: 'manager@hotel.local',
        subject: 'Rapport mensuel',
        text: 'Voici votre rapport',
        html: '<p>Voici votre rapport</p>',
        attachments: [
          {
            filename: 'rapport.pdf',
            content: fakePdf,
            contentType: 'application/pdf',
          },
        ],
      });

      expect(harness.sentMails).toHaveLength(1);
      const sent = harness.sentMails[0];
      expect(sent?.html).toBe('<p>Voici votre rapport</p>');
      expect(sent?.attachments).toEqual([
        {
          filename: 'rapport.pdf',
          content: fakePdf,
          contentType: 'application/pdf',
        },
      ]);
    });

    it('convertit une pièce jointe Uint8Array en Buffer pour le transport', async () => {
      const harness = createFakeTransportHarness();
      const sender = createSmtpSender(defaultEnv, harness.createTransport);

      const uint8 = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);
      await sender.sendMail({
        to: 'manager@hotel.local',
        subject: 'Rapport Uint8',
        text: 'Pièce jointe Uint8',
        attachments: [
          {
            filename: 'doc.pdf',
            content: uint8,
          },
        ],
      });

      expect(harness.sentMails).toHaveLength(1);
      const sent = harness.sentMails[0];
      const attachment = sent?.attachments?.[0];
      expect(attachment?.filename).toBe('doc.pdf');
      expect(attachment?.content).toBeInstanceOf(Buffer);
      expect(attachment?.content.equals(Buffer.from(uint8))).toBe(true);
      expect(attachment?.contentType).toBeUndefined();
    });

    it('transmet plusieurs courriels successivement', async () => {
      const harness = createFakeTransportHarness();
      const sender = createSmtpSender(defaultEnv, harness.createTransport);

      await sender.sendMail({
        to: 'admin1@xplor.ma',
        subject: 'Sujet 1',
        text: 'Corps 1',
      });
      await sender.sendMail({
        to: 'admin2@xplor.ma',
        subject: 'Sujet 2',
        text: 'Corps 2',
      });

      expect(harness.sentMails).toHaveLength(2);
      expect(harness.sentMails[0]?.to).toBe('admin1@xplor.ma');
      expect(harness.sentMails[1]?.to).toBe('admin2@xplor.ma');
    });

    it('délègue la fermeture au transport sous-jacent via close()', () => {
      const harness = createFakeTransportHarness();
      const sender = createSmtpSender(defaultEnv, harness.createTransport);

      expect(harness.getCloseCallCount()).toBe(0);
      sender.close();
      expect(harness.getCloseCallCount()).toBe(1);
    });

    it('propage l erreur lorsque sendMail échoue', async () => {
      const smtpError = new Error('SMTP connection refused on port 1025');
      const harness = createFakeTransportHarness({ sendMailError: smtpError });
      const sender = createSmtpSender(defaultEnv, harness.createTransport);

      await expect(
        sender.sendMail({
          to: 'admin@xplor.ma',
          subject: 'Alerte',
          text: 'Message',
        }),
      ).rejects.toThrow('SMTP connection refused on port 1025');
    });

    it('propage l erreur si createTransport lève à l initialisation', () => {
      const initError = new Error('Configuration transport invalide');
      const harness = createFakeTransportHarness({
        createTransportError: initError,
      });

      expect(() => {
        createSmtpSender(defaultEnv, harness.createTransport);
      }).toThrow('Configuration transport invalide');
    });

    it('instancie nodemailer par défaut et permet d appeler close() sans erreur', () => {
      const sender = createSmtpSender({
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: 1025,
      });

      expect(() => {
        sender.close();
      }).not.toThrow();
    });
  });
});
