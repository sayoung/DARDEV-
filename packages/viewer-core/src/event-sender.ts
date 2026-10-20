/**
 * @file event-sender.ts
 * Expéditeur d'événements statistiques vers l'API Xplor (M7 F-80).
 *
 * Fonctionnalités :
 * - Découpage automatique des événements en paquets de 200 au plus (limite API-04)
 * - Envoi par requête POST {apiBase}/events
 * - Corps au format { events }
 * - En-tête 'Content-Type: application/json'
 * - En-tête 'Authorization: Bearer <jeton>' conditionnel (uniquement si getToken renvoie un jeton)
 * - Option credentials: 'omit', aucun identifiant personnel (NF-02, loi 09-08)
 * - Statut non-2xx ou erreur réseau → lève une Error (reprise par le batcher)
 * - Statut 400 → considéré comme définitif, ne lève pas (évite une boucle infinie de réessais)
 * - Statut 429 → lève une Error (limite de débit atteinte, remise en file)
 */

import type { Event } from '@xplor/shared';

/**
 * Nombre maximal d'événements autorisés par lot d'ingestion (API-04, cahier des charges §5.9).
 */
export const MAX_EVENT_BATCH_SIZE = 200;

/**
 * Options de configuration pour l'expéditeur d'événements statistiques.
 */
export interface EventSenderOptions {
  apiBase: string;
  getToken?: () => string | null;
  fetchFn?: typeof fetch;
}

/**
 * Type de la fonction d'envoi d'événements utilisable par `EventBatcher`.
 */
export type EventSender = (events: Event[]) => Promise<void>;

/**
 * Crée une fonction d'envoi d'événements statistiques vers l'API Xplor.
 *
 * @param options Configuration (apiBase, getToken optionnel, fetchFn personnalisé optionnel).
 * @returns Fonction asynchrone prenant un tableau d'événements et les transmettant par paquets de 200 au plus.
 */
export function createEventSender({
  apiBase,
  getToken,
  fetchFn = fetch,
}: EventSenderOptions): EventSender {
  const normalizedBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
  const endpoint = `${normalizedBase}/events`;

  return async function sendEvents(events: Event[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    for (let i = 0; i < events.length; i += MAX_EVENT_BATCH_SIZE) {
      const chunk = events.slice(i, i + MAX_EVENT_BATCH_SIZE);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (getToken !== undefined) {
        const token = getToken();
        if (typeof token === 'string' && token.trim().length > 0) {
          headers['Authorization'] = `Bearer ${token.trim()}`;
        }
      }

      let response: Response;
      try {
        response = await fetchFn(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ events: chunk }),
          credentials: 'omit',
        });
      } catch (err: unknown) {
        if (err instanceof Error) {
          throw err;
        }
        throw new Error(typeof err === 'string' ? err : 'Network error while sending events');
      }

      if (response.status === 400) {
        // Un code 400 indique une erreur définitive de validation (lot invalide).
        // Ne pas lever d'exception pour éviter une boucle de réessais infinie dans le batcher.
        continue;
      }

      if (!response.ok) {
        const statusText = response.statusText.length > 0 ? ` ${response.statusText}` : '';
        throw new Error(`Failed to send events: HTTP ${String(response.status)}${statusText}`);
      }
    }
  };
}
