import type { KioskStatus } from '@xplor/shared';
import { shouldAlertKioskOffline } from './kiosk-offline-alert.js';

/**
 * Données d'un kiosque nécessaires pour l'évaluation de son état hors-ligne (F-54).
 */
export interface KioskOfflineCandidate {
  id: string;
  label: string;
  hotelName: string;
  status: KioskStatus;
  lastHeartbeatAt: Date | null;
  lastOfflineAlertAt: Date | null;
}

/**
 * Message d'alerte envoyé par courriel à un administrateur.
 */
export interface KioskOfflineMailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Dépendances injectées pour la vérification périodique des kiosques hors-ligne.
 */
export interface KioskOfflineCheckDeps {
  listKiosks(): Promise<KioskOfflineCandidate[]>;
  listAdminEmails(): Promise<string[]>;
  sendMail(mail: KioskOfflineMailMessage): Promise<void>;
  markAlerted(kioskId: string, at: Date): Promise<void>;
}

/**
 * Résultat du contrôle listant les identifiants des kiosques pour lesquels une alerte a été envoyée.
 */
export interface KioskOfflineCheckResult {
  alerted: string[];
}

/**
 * Formate la date de dernier heartbeat au format ISO 8601 pour le courriel.
 */
export function formatKioskHeartbeatIso(date: Date | null): string {
  if (date === null) {
    return 'inconnu';
  }
  return date.toISOString();
}

/**
 * Construit le sujet et le corps textuel du courriel d'alerte en français.
 */
export function buildKioskOfflineEmail(kiosks: readonly KioskOfflineCandidate[]): {
  subject: string;
  text: string;
} {
  const count = kiosks.length;
  const subject =
    count === 1
      ? '[Xplor] Alerte : 1 kiosque hors ligne'
      : `[Xplor] Alerte : ${String(count)} kiosques hors ligne`;

  const lines = kiosks.map((kiosk) => {
    const heartbeatIso = formatKioskHeartbeatIso(kiosk.lastHeartbeatAt);
    return `- Kiosque : ${kiosk.label} | Hôtel : ${kiosk.hotelName} | Dernier heartbeat : ${heartbeatIso}`;
  });

  const intro =
    count === 1
      ? 'Le kiosque suivant est hors ligne depuis plus de 2 heures :'
      : 'Les kiosques suivants sont hors ligne depuis plus de 2 heures :';

  const text = `${intro}\n\n${lines.join('\n')}\n`;

  return { subject, text };
}

/**
 * Exécute la vérification des kiosques hors-ligne (F-54).
 *
 * 1. Récupère les kiosques et filtre ceux qui doivent être alertés via `shouldAlertKioskOffline`.
 * 2. Si aucun kiosque n'est à alerter, retourne `{ alerted: [] }`.
 * 3. Récupère la liste des adresses courriel des ADMIN.
 * 4. Si aucun ADMIN n'existe, ne rien envoyer ni marquer et retourner `{ alerted: [] }`.
 * 5. Envoie un courriel par ADMIN listant les kiosques à alerter.
 *    Si `sendMail` échoue, l'erreur remonte immédiatement et `markAlerted` n'est pas appelé.
 * 6. Appelle `markAlerted(kiosk.id, now)` pour chaque kiosque alerté.
 * 7. Retourne `{ alerted: string[] }` avec les IDs des kiosques alertés.
 */
export async function runKioskOfflineCheck(
  deps: KioskOfflineCheckDeps,
  now: Date,
): Promise<KioskOfflineCheckResult> {
  const kiosks = await deps.listKiosks();

  const kiosksToAlert = kiosks.filter((kiosk) =>
    shouldAlertKioskOffline(
      {
        status: kiosk.status,
        lastHeartbeatAt: kiosk.lastHeartbeatAt,
        lastAlertAt: kiosk.lastOfflineAlertAt,
      },
      now,
    ),
  );

  if (kiosksToAlert.length === 0) {
    return { alerted: [] };
  }

  const adminEmails = await deps.listAdminEmails();
  if (adminEmails.length === 0) {
    return { alerted: [] };
  }

  const { subject, text } = buildKioskOfflineEmail(kiosksToAlert);

  for (const to of adminEmails) {
    await deps.sendMail({ to, subject, text });
  }

  for (const kiosk of kiosksToAlert) {
    await deps.markAlerted(kiosk.id, now);
  }

  return {
    alerted: kiosksToAlert.map((kiosk) => kiosk.id),
  };
}
