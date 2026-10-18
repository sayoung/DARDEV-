import { describe, expect, it } from 'vitest';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

import {
  createSmtpSender,
  MAIL_FROM,
  smtpTransportOptions,
  type CreateTransportFn,
  type SmtpSenderEnv,
  type SmtpTransporter,
} from './smtp-sender.js';

interface SentMailRecord {
  from: string;
  to: string;
  subject: string;
  text: string;
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
    }): Promise<unknown> => {
      if (config?.sendMailError !== undefined) {
        return Promise.reject(config.sendMailError);
      }
      sentMails.push({
        from: options.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
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

describe('smtp-sender (F-54)', () => {
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
        },
      ]);
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
