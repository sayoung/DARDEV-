import {
  KioskManifestSchema,
  type KioskManifest,
  type LocalizedText,
} from '@xplor/shared';

import { computeManifestVersion } from './manifest-version.js';

export interface ManifestBuilderInput {
  kiosk: {
    id: string;
    label: string;
    idleTimeoutSeconds: number;
    deviceType: 'TOUCH_SCREEN' | 'VR_HEADSET' | 'TOUCH_AND_HEADSET';
  };
  hotel: {
    id: string;
    name: string;
    logoUrl: string | null;
    brandColor: string;
    languages: string[];
    active: boolean;
    logoAssetId: string | null;
    maintenancePinHash: string | null;
  };
  selection: {
    version: number;
    featuredTourId: string | null;
    attractTourIds: string[];
    items: {
      tourId: string;
      position: number;
      contentVersion: number;
      sizeBytes: number;
      status: 'DRAFT' | 'PUBLISHED';
      deletedAt: Date | null;
    }[];
  };
  categories: {
    id: string;
    name: LocalizedText;
    icon: string;
    color: string;
  }[];
}

/** Construit le manifeste public du kiosque à partir des lignes chargées par le service. */
export function buildManifest(input: ManifestBuilderInput): KioskManifest {
  const tours = input.selection.items
    .filter((item) => item.status === 'PUBLISHED' && item.deletedAt === null)
    .sort((left, right) => left.position - right.position);
  const tourIds = new Set(tours.map((tour) => tour.tourId));

  return KioskManifestSchema.parse({
    manifestVersion: computeManifestVersion({
      selectionVersion: input.selection.version,
      tours: tours.map(({ tourId, contentVersion }) => ({ id: tourId, contentVersion })),
      hotel: {
        name: input.hotel.name,
        brandColor: input.hotel.brandColor,
        languages: input.hotel.languages,
        active: input.hotel.active,
        logoAssetId: input.hotel.logoAssetId,
        maintenancePinHash: input.hotel.maintenancePinHash,
      },
      kiosk: {
        label: input.kiosk.label,
        idleTimeoutSeconds: input.kiosk.idleTimeoutSeconds,
        deviceType: input.kiosk.deviceType,
      },
    }),
    kiosk: {
      id: input.kiosk.id,
      label: input.kiosk.label,
      idleTimeoutSeconds: input.kiosk.idleTimeoutSeconds,
      deviceType: input.kiosk.deviceType,
    },
    hotel: {
      id: input.hotel.id,
      name: input.hotel.name,
      logoUrl: input.hotel.logoUrl,
      brandColor: input.hotel.brandColor,
      languages: input.hotel.languages,
      serviceActive: input.hotel.active,
      maintenancePinHash: input.hotel.maintenancePinHash,
    },
    selection: {
      featuredTourId:
        input.selection.featuredTourId !== null && tourIds.has(input.selection.featuredTourId)
          ? input.selection.featuredTourId
          : null,
      attractTourIds: input.selection.attractTourIds.filter((id) => tourIds.has(id)),
      tours: tours.map((tour) => ({
        id: tour.tourId,
        contentVersion: tour.contentVersion,
        sizeBytes: tour.sizeBytes,
        url: `/api/v1/tours/${tour.tourId}`,
      })),
    },
    categories: input.categories.map((category) => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
    })),
  });
}
