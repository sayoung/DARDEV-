import { createHash } from 'node:crypto';

export function computeManifestVersion(input: {
  selectionVersion: number;
  tours: { id: string; contentVersion: number }[];
  hotel: {
    name: string;
    brandColor: string;
    languages: string[];
    active: boolean;
    logoAssetId: string | null;
    maintenancePinHash: string | null;
  };
  kiosk: {
    label: string;
    idleTimeoutSeconds: number;
    deviceType: string;
  };
}): string {
  const canonicalInput = {
    selectionVersion: input.selectionVersion,
    tours: [...input.tours]
      .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
      .map(({ id, contentVersion }) => [id, contentVersion]),
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
  };

  const digest = createHash('sha256')
    .update(JSON.stringify(canonicalInput))
    .digest('hex');

  return `m${digest.slice(0, 12)}`;
}
