import { type Mailer, type MailMessage } from './mailer.js';

/** Conserve les messages envoyés, pour les tests. Aucun SMTP. */
export class FakeMailer implements Mailer {
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push({ ...message });
    return Promise.resolve();
  }
}
