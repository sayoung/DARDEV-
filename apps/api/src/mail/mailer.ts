export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Jeton d'injection. `FakeMailer` le remplace dans les tests. */
export const MAILER = Symbol('MAILER');
