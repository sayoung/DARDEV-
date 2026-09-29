import {
  ContractType,
  HotelStars,
  KioskDeviceType,
  KioskStatus,
  type PrismaClient,
} from '@prisma/client';

import { SEED_CITIES } from './seed-catalog.js';

/** Compte HOTEL_MANAGER du seed, rattaché à l'hôtel de démonstration. */
export const SEED_MANAGER_EMAIL = 'manager@xplor.local';

/** Hôtel de démonstration à Rabat. Upsert sur un UUID v7 fixe. */
export const SEED_HOTEL = {
  id: '01990000-0000-7000-8000-000000000101',
  name: 'Hôtel Démonstration Rabat',
  stars: HotelStars.FIVE,
  address: '1 avenue de la Démonstration, Rabat',
  phone: '+212537000000',
  email: 'rabat.demo@xplor.local',
  brandColor: '#1F6F8B',
  languages: ['fr', 'ar', 'en'],
  contractType: ContractType.RENTAL,
  contractStart: new Date('2026-01-01T00:00:00.000Z'),
  contractEnd: new Date('2027-01-01T00:00:00.000Z'),
} as const;

/** Sélection vide de l'hôtel de démonstration. */
export const SEED_SELECTION_ID = '01990000-0000-7000-8000-000000000102';

/** Kiosque « Hall principal », en attente d'enrôlement. */
export const SEED_KIOSK = {
  id: '01990000-0000-7000-8000-000000000103',
  label: 'Hall principal',
  deviceType: KioskDeviceType.TOUCH_AND_HEADSET,
  status: KioskStatus.PENDING,
  idleTimeoutSeconds: 90,
} as const;

/**
 * Un hôtel, sa sélection vide, un kiosque et le rattachement du gestionnaire.
 * Une seconde exécution ne duplique pas les lignes.
 */
export async function seedHotels(prisma: PrismaClient): Promise<void> {
  const rabat = SEED_CITIES.find((city) => city.name.fr === 'Rabat');
  if (rabat === undefined) {
    throw new Error('La ville de démonstration Rabat est absente du seed catalogue.');
  }

  const hotel = {
    name: SEED_HOTEL.name,
    stars: SEED_HOTEL.stars,
    cityId: rabat.id,
    address: SEED_HOTEL.address,
    phone: SEED_HOTEL.phone,
    email: SEED_HOTEL.email,
    logoAssetId: null,
    brandColor: SEED_HOTEL.brandColor,
    languages: [...SEED_HOTEL.languages],
    contractType: SEED_HOTEL.contractType,
    contractStart: SEED_HOTEL.contractStart,
    contractEnd: SEED_HOTEL.contractEnd,
    maintenancePinHash: null,
    active: true,
    deletedAt: null,
  };
  await prisma.hotel.upsert({
    where: { id: SEED_HOTEL.id },
    create: { id: SEED_HOTEL.id, ...hotel },
    update: hotel,
  });

  const selection = await prisma.selection.upsert({
    where: { hotelId: SEED_HOTEL.id },
    create: {
      id: SEED_SELECTION_ID,
      hotelId: SEED_HOTEL.id,
      featuredTourId: null,
      attractTourIds: [],
      version: 1,
    },
    update: {
      featuredTourId: null,
      attractTourIds: [],
      version: 1,
    },
  });
  await prisma.selectionItem.deleteMany({ where: { selectionId: selection.id } });

  const kiosk = {
    label: SEED_KIOSK.label,
    hotelId: SEED_HOTEL.id,
    deviceType: SEED_KIOSK.deviceType,
    status: SEED_KIOSK.status,
    idleTimeoutSeconds: SEED_KIOSK.idleTimeoutSeconds,
  };
  await prisma.kiosk.upsert({
    where: { id: SEED_KIOSK.id },
    create: { id: SEED_KIOSK.id, ...kiosk },
    update: kiosk,
  });

  const manager = await prisma.user.findUnique({ where: { email: SEED_MANAGER_EMAIL } });
  if (manager === null) {
    throw new Error(
      `L'utilisateur ${SEED_MANAGER_EMAIL} est absent. Le seed des comptes doit passer avant les hôtels.`,
    );
  }
  await prisma.userHotel.upsert({
    where: {
      userId_hotelId: { userId: manager.id, hotelId: SEED_HOTEL.id },
    },
    create: { userId: manager.id, hotelId: SEED_HOTEL.id },
    update: {},
  });
}
