import { KioskManifestSchema, type KioskManifest } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { resolveScreen } from './screen-state.js';

function createManifest(overrides: { serviceActive?: boolean } = {}): KioskManifest {
  return KioskManifestSchema.parse({
    manifestVersion: 'v1',
    kiosk: {
      id: '00000000-0000-4000-8000-000000000001',
      label: 'Borne Hall Réception',
      idleTimeoutSeconds: 90,
      deviceType: 'TOUCH_SCREEN',
    },
    hotel: {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Hôtel Rabat Salé',
      logoUrl: null,
      brandColor: '#6958A5',
      languages: ['fr'],
      serviceActive: overrides.serviceActive ?? true,
      maintenancePinHash: null,
    },
    selection: {
      featuredTourId: null,
      attractTourIds: [],
      tours: [],
    },
    categories: [],
  });
}

describe('resolveScreen', () => {
  describe('priorité 1 : non enrôlé → ENROLL', () => {
    it("renvoie ENROLL lorsque le kiosque n'est pas enrôlé, sans manifeste et non désactivé", () => {
      expect(
        resolveScreen({
          enrolled: false,
          disabled: false,
          manifest: null,
        }),
      ).toBe('ENROLL');
    });

    it("renvoie ENROLL même si le kiosque est marqué désactivé mais pas encore enrôlé", () => {
      expect(
        resolveScreen({
          enrolled: false,
          disabled: true,
          manifest: null,
        }),
      ).toBe('ENROLL');
    });

    it("renvoie ENROLL même si un manifeste existe déjà mais que l'appareil est marqué non enrôlé", () => {
      const activeManifest = createManifest({ serviceActive: true });
      expect(
        resolveScreen({
          enrolled: false,
          disabled: false,
          manifest: activeManifest,
        }),
      ).toBe('ENROLL');
    });

    it('renvoie ENROLL en priorité absolue quel que soit l’état disabled et le manifeste', () => {
      const inactiveManifest = createManifest({ serviceActive: false });
      expect(
        resolveScreen({
          enrolled: false,
          disabled: true,
          manifest: inactiveManifest,
        }),
      ).toBe('ENROLL');
    });
  });

  describe('priorité 2 : disabled ou serviceActive === false → UNAVAILABLE', () => {
    it('renvoie UNAVAILABLE si le kiosque enrôlé est désactivé et sans manifeste', () => {
      expect(
        resolveScreen({
          enrolled: true,
          disabled: true,
          manifest: null,
        }),
      ).toBe('UNAVAILABLE');
    });

    it('renvoie UNAVAILABLE si le kiosque enrôlé est désactivé même avec un service hôtel actif', () => {
      const activeManifest = createManifest({ serviceActive: true });
      expect(
        resolveScreen({
          enrolled: true,
          disabled: true,
          manifest: activeManifest,
        }),
      ).toBe('UNAVAILABLE');
    });

    it('renvoie UNAVAILABLE si le kiosque enrôlé est désactivé avec un service hôtel inactif', () => {
      const inactiveManifest = createManifest({ serviceActive: false });
      expect(
        resolveScreen({
          enrolled: true,
          disabled: true,
          manifest: inactiveManifest,
        }),
      ).toBe('UNAVAILABLE');
    });

    it('renvoie UNAVAILABLE si le kiosque est actif mais que le contrat hôtel est suspendu (serviceActive === false)', () => {
      const inactiveManifest = createManifest({ serviceActive: false });
      expect(
        resolveScreen({
          enrolled: true,
          disabled: false,
          manifest: inactiveManifest,
        }),
      ).toBe('UNAVAILABLE');
    });
  });

  describe('priorité 3 : pas de manifeste → LOADING', () => {
    it('renvoie LOADING lorsque le kiosque est enrôlé, actif mais sans manifeste', () => {
      expect(
        resolveScreen({
          enrolled: true,
          disabled: false,
          manifest: null,
        }),
      ).toBe('LOADING');
    });
  });

  describe('priorité 4 : sinon → HOME', () => {
    it('renvoie HOME lorsque le kiosque est enrôlé, actif et dispose d’un manifeste au service actif', () => {
      const activeManifest = createManifest({ serviceActive: true });
      expect(
        resolveScreen({
          enrolled: true,
          disabled: false,
          manifest: activeManifest,
        }),
      ).toBe('HOME');
    });
  });
});
