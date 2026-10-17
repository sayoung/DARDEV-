import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  EnrollmentCodeResponseSchema,
  KioskSchema,
  Role,
  type KioskEnrollRequest,
  type KioskCreate,
  type Principal,
} from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import {
  KioskService,
  toKioskResponse,
  type KioskPrismaClient,
  type KioskRow,
} from './kiosks.service.js';
import { hashDeviceToken } from './kiosk-secrets.js';

const NOW = new Date('2026-10-17T12:00:00.000Z');
const MANIFEST_VERSION = 'manifest-v3';
const HOTEL_A_ID = '01990000-0000-7000-8000-000000000101';
const HOTEL_B_ID = '01990000-0000-7000-8000-000000000102';
const KIOSK_A_ID = '01990000-0000-7000-8000-000000000301';
const KIOSK_B_ID = '01990000-0000-7000-8000-000000000302';
const HOTEL_DELETED_ID = '01990000-0000-7000-8000-000000000103';

const admin: Principal = {
  userId: '01990000-0000-7000-8000-000000000201',
  role: Role.ADMIN,
  hotelIds: [],
};

const managerHotelA: Principal = {
  userId: '01990000-0000-7000-8000-000000000202',
  role: Role.HOTEL_MANAGER,
  hotelIds: [HOTEL_A_ID],
};

function kioskRow(overrides: Partial<KioskRow> = {}): KioskRow {
  return {
    id: KIOSK_A_ID,
    label: 'Hall principal',
    hotelId: HOTEL_A_ID,
    deviceType: 'TOUCH_AND_HEADSET',
    status: 'ACTIVE',
    enrollmentCode: 'AB12CD34',
    enrollmentExpiresAt: new Date('2026-10-17T13:00:00.000Z'),
    tokenHash: 'sensitive-token-hash',
    lastHeartbeatAt: new Date('2026-10-17T11:59:00.000Z'),
    lastIp: '192.0.2.4',
    appVersion: '1.2.3',
    syncedManifestVersion: MANIFEST_VERSION,
    storageFreeMb: 2048,
    idleTimeoutSeconds: 90,
    deletedAt: null,
    createdAt: new Date('2026-10-01T08:30:00.000Z'),
    updatedAt: new Date('2026-10-17T11:59:00.000Z'),
    ...overrides,
  };
}

function harness(initialRows: KioskRow[] = []): {
  service: KioskService;
  rows: Map<string, KioskRow>;
  selections: Map<string, number>;
  selectionReads: string[];
  hotels: Map<string, Date | null>;
  kioskCreateCalls: unknown[];
  kioskUpdateCalls: unknown[];
} {
  const rows = new Map(initialRows.map((row) => [row.id, row]));
  const selections = new Map<string, number>();
  const selectionReads: string[] = [];
  const hotels = new Map<string, Date | null>([
    [HOTEL_A_ID, null],
    [HOTEL_DELETED_ID, new Date('2026-10-10T00:00:00.000Z')],
  ]);
  const kioskCreateCalls: unknown[] = [];
  const kioskUpdateCalls: unknown[] = [];
  const prisma: KioskPrismaClient = {
    hotel: {
      findFirst: (args) =>
        Promise.resolve(
          hotels.has(args.where.id) && hotels.get(args.where.id) === null
            ? { id: args.where.id }
            : null,
        ),
    },
    kiosk: {
      findMany: (args) => {
        let result = [...rows.values()].filter((row) => row.deletedAt === null);
        if (args.where.hotelId !== undefined) {
          result = result.filter((row) => args.where.hotelId?.in.includes(row.hotelId));
        }
        return Promise.resolve(
          result.sort((left, right) => left.label.localeCompare(right.label)),
        );
      },
      findFirst: (args) => {
        const row = args.where.id === undefined
          ? [...rows.values()].find((candidate) =>
            candidate.deletedAt === null
            && (args.where.tokenHash === undefined || candidate.tokenHash === args.where.tokenHash)
            && (args.where.status === undefined || candidate.status === args.where.status)
            && (args.where.enrollmentCode === undefined || candidate.enrollmentCode === args.where.enrollmentCode)
            && (args.where.enrollmentExpiresAt === undefined
              || (candidate.enrollmentExpiresAt !== null
                && candidate.enrollmentExpiresAt > args.where.enrollmentExpiresAt.gt)),
          )
          : rows.get(args.where.id);
        return Promise.resolve(row?.deletedAt === null ? row : null);
      },
      create: (args) => {
        kioskCreateCalls.push(args);
        return Promise.resolve(
          kioskRow({
            label: args.data.label,
            hotelId: args.data.hotelId,
            deviceType: args.data.deviceType,
            status: args.data.status,
            idleTimeoutSeconds: args.data.idleTimeoutSeconds,
            enrollmentCode: null,
            enrollmentExpiresAt: null,
            tokenHash: null,
            lastHeartbeatAt: null,
            lastIp: null,
            appVersion: null,
            syncedManifestVersion: null,
            storageFreeMb: null,
          }),
        );
      },
      update: (args) => {
        kioskUpdateCalls.push(args);
        const row = rows.get(args.where.id);
        if (row === undefined || row.deletedAt !== null) {
          return Promise.reject(new Error('KIOSK_ROW_MISSING'));
        }
        const updated = { ...row, ...args.data, updatedAt: new Date() };
        rows.set(row.id, updated);
        return Promise.resolve(updated);
      },
      updateMany: (args) => {
        const row = rows.get(args.where.id);
        if (
          row === undefined
          || row.deletedAt !== null
          || row.status !== args.where.status
          || row.enrollmentCode !== args.where.enrollmentCode
          || row.enrollmentExpiresAt === null
          || row.enrollmentExpiresAt <= args.where.enrollmentExpiresAt.gt
        ) {
          return Promise.resolve({ count: 0 });
        }
        rows.set(row.id, { ...row, ...args.data, updatedAt: new Date() });
        return Promise.resolve({ count: 1 });
      },
    },
    selection: {
      findUnique: (args) => {
        selectionReads.push(args.where.hotelId);
        const version = selections.get(args.where.hotelId);
        return Promise.resolve(version === undefined ? null : { version });
      },
    },
  };
  return {
    service: new KioskService(prisma),
    rows,
    selections,
    selectionReads,
    hotels,
    kioskCreateCalls,
    kioskUpdateCalls,
  };
}

const kioskInput: KioskCreate = {
  label: 'Hall principal',
  hotelId: HOTEL_A_ID,
  deviceType: 'TOUCH_AND_HEADSET',
};

describe('KioskService.authenticateDevice', () => {
  it('recherche un kiosque actif par hash du jeton et renvoie son identité', async () => {
    const token = 'device-token';
    const { service } = harness([
      kioskRow({ tokenHash: hashDeviceToken(token) }),
      kioskRow({
        id: KIOSK_B_ID,
        tokenHash: hashDeviceToken('other-token'),
      }),
      kioskRow({
        id: '01990000-0000-7000-8000-000000000303',
        tokenHash: hashDeviceToken('deleted-token'),
        deletedAt: new Date('2026-10-16T00:00:00.000Z'),
      }),
    ]);

    await expect(service.authenticateDevice(token)).resolves.toEqual({
      id: KIOSK_A_ID,
      hotelId: HOTEL_A_ID,
      status: 'ACTIVE',
    });
    await expect(service.authenticateDevice('unknown-token')).resolves.toBeNull();
  });
});

describe('toKioskResponse', () => {
  it('renvoie ONLINE avec heartbeat récent et manifeste synchronisé', () => {
    const response = toKioskResponse(kioskRow(), MANIFEST_VERSION, NOW);

    expect(response.connectionState).toBe('ONLINE');
    expect(response.lastHeartbeatAt).toBe('2026-10-17T11:59:00.000Z');
    expect(response.createdAt).toBe('2026-10-01T08:30:00.000Z');
  });

  it('renvoie DESYNCHRONIZED si le manifeste attendu diffère', () => {
    const response = toKioskResponse(kioskRow(), 'manifest-v4', NOW);

    expect(response.connectionState).toBe('DESYNCHRONIZED');
  });

  it('renvoie PENDING et DISABLED selon le statut', () => {
    expect(
      toKioskResponse(kioskRow({ status: 'PENDING' }), MANIFEST_VERSION, NOW)
        .connectionState,
    ).toBe('PENDING');
    expect(
      toKioskResponse(kioskRow({ status: 'DISABLED' }), MANIFEST_VERSION, NOW)
        .connectionState,
    ).toBe('DISABLED');
  });

  it('renvoie OFFLINE si le heartbeat date de plus de 15 minutes', () => {
    const response = toKioskResponse(
      kioskRow({ lastHeartbeatAt: new Date('2026-10-17T11:44:59.999Z') }),
      MANIFEST_VERSION,
      NOW,
    );

    expect(response.connectionState).toBe('OFFLINE');
  });

  it('valide la réponse et n’expose aucun secret ni adresse IP', () => {
    const response = toKioskResponse(kioskRow(), MANIFEST_VERSION, NOW);

    expect(KioskSchema.parse(response)).toEqual(response);
    expect(Object.keys(response)).not.toContain('tokenHash');
    expect(Object.keys(response)).not.toContain('enrollmentCode');
    expect(Object.keys(response)).not.toContain('enrollmentExpiresAt');
    expect(Object.keys(response)).not.toContain('lastIp');
  });

  it('conserve un heartbeat null', () => {
    const response = toKioskResponse(
      kioskRow({ lastHeartbeatAt: null, status: 'PENDING' }),
      null,
      NOW,
    );

    expect(response.lastHeartbeatAt).toBeNull();
  });
});

describe('KioskService', () => {
  it('crée un kiosque ADMIN en PENDING avec les valeurs par défaut et sans secret', async () => {
    const { service, kioskCreateCalls } = harness();

    const kiosk = await service.create(admin, kioskInput);

    expect(kiosk.status).toBe('PENDING');
    expect(kiosk.connectionState).toBe('PENDING');
    expect(kiosk.idleTimeoutSeconds).toBe(90);
    expect(KioskSchema.parse(kiosk)).toEqual(kiosk);
    expect(kiosk).not.toHaveProperty('tokenHash');
    expect(kiosk).not.toHaveProperty('enrollmentCode');
    expect(kiosk).not.toHaveProperty('lastIp');
    expect(kioskCreateCalls).toHaveLength(1);
    expect(kioskCreateCalls[0]).toEqual({
      data: {
        label: 'Hall principal',
        hotelId: HOTEL_A_ID,
        deviceType: 'TOUCH_AND_HEADSET',
        status: 'PENDING',
        idleTimeoutSeconds: 90,
      },
    });
  });

  it('respecte la valeur idleTimeoutSeconds fournie', async () => {
    const { service } = harness();

    const kiosk = await service.create(admin, {
      ...kioskInput,
      idleTimeoutSeconds: 180,
    });

    expect(kiosk.idleTimeoutSeconds).toBe(180);
  });

  it('refuse un gestionnaire sans créer de kiosque', async () => {
    const { service, kioskCreateCalls } = harness();

    await expect(service.create(managerHotelA, kioskInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(kioskCreateCalls).toHaveLength(0);
  });

  it('rejette un hôtel inconnu avec KIOSK_HOTEL_INVALID', async () => {
    const { service } = harness();

    await expect(
      service.create(admin, {
        ...kioskInput,
        hotelId: '01990000-0000-7000-8000-000000000199',
      }),
    ).rejects.toMatchObject({ response: { error: { code: 'KIOSK_HOTEL_INVALID' } } });
  });

  it('rejette un hôtel supprimé avec KIOSK_HOTEL_INVALID', async () => {
    const { service } = harness();

    await expect(
      service.create(admin, { ...kioskInput, hotelId: HOTEL_DELETED_ID }),
    ).rejects.toMatchObject({ response: { error: { code: 'KIOSK_HOTEL_INVALID' } } });
  });

  it('renvoie 404 si le kiosque appartient à un hôtel hors périmètre', async () => {
    const row = kioskRow({ hotelId: HOTEL_B_ID });
    const { service } = harness([row]);

    await expect(service.get(managerHotelA, row.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('renvoie 404 pour un kiosque inconnu ou supprimé', async () => {
    const deleted = kioskRow({ id: KIOSK_B_ID, deletedAt: new Date() });
    const { service } = harness([deleted]);

    await expect(service.get(admin, 'unknown-kiosk')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.get(admin, deleted.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('compare au numéro de version attendu et signale un kiosque en retard', async () => {
    const row = kioskRow({
      syncedManifestVersion: '2',
      lastHeartbeatAt: new Date(),
    });
    const { service, selections } = harness([row]);
    selections.set(HOTEL_A_ID, 3);

    const kiosk = await service.get(managerHotelA, row.id);

    expect(kiosk.connectionState).toBe('DESYNCHRONIZED');
  });

  it('renvoie une version attendue nulle en l’absence de sélection', async () => {
    const row = kioskRow({
      syncedManifestVersion: '2',
      lastHeartbeatAt: new Date(),
    });
    const { service } = harness([row]);

    const kiosk = await service.get(managerHotelA, row.id);

    expect(kiosk.connectionState).toBe('ONLINE');
    expect(kiosk.syncedManifestVersion).toBe('2');
  });

  it('un gestionnaire de l’hôtel A ne voit pas les kiosques de l’hôtel B', async () => {
    const kioskA = kioskRow({ id: KIOSK_A_ID, hotelId: HOTEL_A_ID, label: 'A' });
    const kioskB = kioskRow({ id: KIOSK_B_ID, hotelId: HOTEL_B_ID, label: 'B' });
    const { service } = harness([kioskA, kioskB]);

    const kiosks = await service.list(managerHotelA);

    expect(kiosks.map((kiosk) => kiosk.id)).toEqual([KIOSK_A_ID]);
    expect(kiosks.some((kiosk) => kiosk.hotelId === HOTEL_B_ID)).toBe(false);
  });

  it('ADMIN voit tous les kiosques', async () => {
    const { service } = harness([
      kioskRow({ id: KIOSK_A_ID, hotelId: HOTEL_A_ID, label: 'A hall' }),
      kioskRow({ id: KIOSK_B_ID, hotelId: HOTEL_B_ID, label: 'B hall' }),
    ]);

    const kiosks = await service.list(admin);

    expect(kiosks.map((kiosk) => kiosk.id)).toEqual([KIOSK_A_ID, KIOSK_B_ID]);
  });

  it('ne renvoie aucun secret ni adresse IP et lit chaque sélection une fois', async () => {
    const { service, selections, selectionReads } = harness([
      kioskRow({ id: KIOSK_A_ID, hotelId: HOTEL_A_ID, label: 'A' }),
      kioskRow({ id: KIOSK_B_ID, hotelId: HOTEL_A_ID, label: 'B' }),
    ]);
    selections.set(HOTEL_A_ID, 3);

    const kiosks = await service.list(admin);

    expect(selectionReads).toEqual([HOTEL_A_ID]);
    for (const kiosk of kiosks) {
      expect(kiosk).not.toHaveProperty('tokenHash');
      expect(kiosk).not.toHaveProperty('enrollmentCode');
      expect(kiosk).not.toHaveProperty('lastIp');
    }
  });

  it('met à jour les seuls champs modifiables et renvoie le kiosque', async () => {
    const { service, kioskUpdateCalls } = harness([kioskRow()]);

    const kiosk = await service.update(admin, KIOSK_A_ID, {
      label: 'Entrée principale',
      idleTimeoutSeconds: 120,
    });

    expect(kiosk.label).toBe('Entrée principale');
    expect(kiosk.idleTimeoutSeconds).toBe(120);
    expect(kioskUpdateCalls[0]).toEqual({
      where: { id: KIOSK_A_ID },
      data: { label: 'Entrée principale', idleTimeoutSeconds: 120 },
    });
  });

  it.each([
    ['update', (service: KioskService) => service.update(managerHotelA, KIOSK_A_ID, {})],
    ['remove', (service: KioskService) => service.remove(managerHotelA, KIOSK_A_ID)],
    ['issueEnrollmentCode', (service: KioskService) => service.issueEnrollmentCode(managerHotelA, KIOSK_A_ID)],
    ['disable', (service: KioskService) => service.disable(managerHotelA, KIOSK_A_ID)],
  ])('%s est réservé à ADMIN', async (_method, invoke) => {
    const { service, kioskUpdateCalls } = harness([kioskRow()]);

    await expect(invoke(service)).rejects.toBeInstanceOf(ForbiddenException);
    expect(kioskUpdateCalls).toHaveLength(0);
  });

  it('supprime logiquement le kiosque', async () => {
    const { service, rows } = harness([kioskRow()]);

    await service.remove(admin, KIOSK_A_ID);

    expect(rows.get(KIOSK_A_ID)?.deletedAt).toBeInstanceOf(Date);
  });

  it('émet un code d’enrôlement conforme expirant dans 60 minutes', async () => {
    const { service, rows, kioskUpdateCalls } = harness([kioskRow({ status: 'ACTIVE' })]);

    const response = await service.issueEnrollmentCode(admin, KIOSK_A_ID);

    expect(EnrollmentCodeResponseSchema.parse(response)).toEqual(response);
    expect(response.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    expect(new Date(response.expiresAt).getTime() - Date.now()).toBeGreaterThanOrEqual(
      60 * 60 * 1000 - 100,
    );
    expect(new Date(response.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(
      60 * 60 * 1000,
    );
    expect(rows.get(KIOSK_A_ID)).toMatchObject({
      status: 'PENDING',
      tokenHash: null,
      enrollmentCode: response.code,
      enrollmentExpiresAt: new Date(response.expiresAt),
    });
    expect(kioskUpdateCalls[0]).toMatchObject({
      where: { id: KIOSK_A_ID },
      data: { status: 'PENDING', tokenHash: null, enrollmentCode: response.code },
    });
  });

  it('désactive le kiosque et révoque les secrets', async () => {
    const { service, rows, kioskUpdateCalls } = harness([kioskRow()]);

    const kiosk = await service.disable(admin, KIOSK_A_ID);

    expect(kiosk.status).toBe('DISABLED');
    expect(rows.get(KIOSK_A_ID)).toMatchObject({
      status: 'DISABLED',
      tokenHash: null,
      enrollmentCode: null,
      enrollmentExpiresAt: null,
    });
    expect(kioskUpdateCalls[0]).toMatchObject({
      data: {
        status: 'DISABLED',
        tokenHash: null,
        enrollmentCode: null,
      },
    });
  });

  it('enrôle le kiosque, stocke uniquement le hash du jeton et mémorise l’IP', async () => {
    const code = 'AB12CD34';
    const { service, rows } = harness([kioskRow({
      status: 'PENDING',
      enrollmentCode: code,
      enrollmentExpiresAt: new Date(Date.now() + 60_000),
      tokenHash: null,
    })]);
    const request: KioskEnrollRequest = {
      code,
      deviceInfo: { userAgent: 'Xplor Kiosk/1.0' },
    };

    const response = await service.enroll(request, '192.0.2.40');

    expect(response.kioskId).toBe(KIOSK_A_ID);
    expect(response.token).toBeTruthy();
    expect(response.token).not.toBe(rows.get(KIOSK_A_ID)?.tokenHash);
    expect(rows.get(KIOSK_A_ID)).toMatchObject({
      status: 'ACTIVE',
      tokenHash: hashDeviceToken(response.token),
      enrollmentCode: null,
      enrollmentExpiresAt: null,
      lastIp: '192.0.2.40',
    });
    expect(response).not.toHaveProperty('deviceInfo');
  });

  it.each([
    ['inconnu', [], 'ZZZZZZZZ'],
    ['expiré', [kioskRow({
      status: 'PENDING',
      enrollmentCode: 'AB12CD34',
      enrollmentExpiresAt: new Date(Date.now() - 1),
      tokenHash: null,
    })], 'AB12CD34'],
    ['déjà utilisé', [kioskRow({
      status: 'ACTIVE',
      enrollmentCode: 'AB12CD34',
      enrollmentExpiresAt: new Date(Date.now() + 60_000),
    })], 'AB12CD34'],
  ])('refuse un code %s avec la même erreur générique', async (_label, rows, code) => {
    const { service } = harness(rows);
    const request: KioskEnrollRequest = {
      code,
      deviceInfo: { userAgent: 'Xplor Kiosk/1.0' },
    };

    await expect(service.enroll(request, null)).rejects.toMatchObject({
      status: 401,
      response: { error: { code: 'KIOSK_ENROLLMENT_INVALID' } },
    });
  });

  it('refuse le second appel avec un code déjà consommé', async () => {
    const { service } = harness([kioskRow({
      status: 'PENDING',
      enrollmentCode: 'AB12CD34',
      enrollmentExpiresAt: new Date(Date.now() + 60_000),
      tokenHash: null,
    })]);
    const request: KioskEnrollRequest = {
      code: 'AB12CD34',
      deviceInfo: { userAgent: 'Xplor Kiosk/1.0' },
    };

    await expect(service.enroll(request, null)).resolves.toMatchObject({ kioskId: KIOSK_A_ID });
    await expect(service.enroll(request, null)).rejects.toMatchObject({
      status: 401,
      response: { error: { code: 'KIOSK_ENROLLMENT_INVALID' } },
    });
  });

  it.each([
    ['inconnu', 'missing-kiosk'],
    ['supprimé', KIOSK_B_ID],
  ])('renvoie KIOSK_NOT_FOUND pour un kiosque %s lors de chaque mutation', async (_label, id) => {
    const initial = id === KIOSK_B_ID ? [kioskRow({ id, deletedAt: new Date() })] : [];
    const { service } = harness(initial);
    const expectNotFound = (promise: Promise<unknown>) =>
      expect(promise).rejects.toMatchObject({
        status: 404,
        response: { error: { code: 'KIOSK_NOT_FOUND' } },
      });

    await expectNotFound(service.update(admin, id, {}));
    await expectNotFound(service.remove(admin, id));
    await expectNotFound(service.issueEnrollmentCode(admin, id));
    await expectNotFound(service.disable(admin, id));
  });
});
