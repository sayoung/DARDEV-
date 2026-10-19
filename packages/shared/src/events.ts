import { z } from 'zod';

/**
 * Types d'événements statistiques collectés (cahier des charges, §5.9, F-80).
 * Aucun champ ne permet d'identifier un voyageur (NF-02, loi 09-08).
 */
export enum EVENT_TYPES {
  SESSION_START = 'SESSION_START',
  SESSION_END = 'SESSION_END',
  TOUR_OPEN = 'TOUR_OPEN',
  SCENE_VIEW = 'SCENE_VIEW',
  HOTSPOT_CLICK = 'HOTSPOT_CLICK',
  AUDIO_PLAY = 'AUDIO_PLAY',
  VR_ENTER = 'VR_ENTER',
  VR_EXIT = 'VR_EXIT',
  QR_SHOWN = 'QR_SHOWN',
  LANG_CHANGE = 'LANG_CHANGE',
}

export const EventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventTypeSchema>;

/**
 * Canaux de diffusion des visites virtuelles (cahier des charges, §5.9).
 */
export enum EVENT_CHANNELS {
  KIOSK = 'KIOSK',
  VR = 'VR',
  WEB = 'WEB',
}

export const EventChannelSchema = z.enum(EVENT_CHANNELS);
export type EventChannel = z.infer<typeof EventChannelSchema>;

/**
 * Schéma d'un événement statistique unitaire (cahier des charges, §5.9, API-04, F-80).
 * - sessionId : UUID généré côté client, non lié à une personne
 * - type : type d'interaction
 * - channel : canal d'interaction (KIOSK, VR, WEB)
 * - tourId, sceneId, hotspotId : UUID facultatifs
 * - lang : code langue (chaîne de 8 caractères max)
 * - durationMs : durée en millisecondes (entier positif ou nul facultatif)
 * - occurredAt : horodatage ISO côté client
 *
 * Conformément à NF-02 (loi 09-08), aucun champ de donnée personnelle
 * (adresse IP, identifiant utilisateur, nom, etc.) n'est collecté.
 */
export const eventSchema = z.object({
  sessionId: z.uuid(),
  type: EventTypeSchema,
  channel: EventChannelSchema,
  tourId: z.uuid().nullable().optional(),
  sceneId: z.uuid().nullable().optional(),
  hotspotId: z.uuid().nullable().optional(),
  lang: z.string().min(1).max(8),
  durationMs: z.number().int().min(0).nullable().optional(),
  occurredAt: z.iso.datetime(),
});

export const EventSchema = eventSchema;
export type Event = z.infer<typeof eventSchema>;

/**
 * Schéma d'un lot d'événements statistiques (API-04, F-80).
 * Reçoit entre 1 et 200 événements par lot.
 */
export const eventsBatchSchema = z.object({
  events: z.array(eventSchema).min(1).max(200),
});

export const EventsBatchSchema = eventsBatchSchema;
export type EventsBatch = z.infer<typeof eventsBatchSchema>;
