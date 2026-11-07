import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { readDatabaseUrlTest } from './global-setup.js';

const prisma = new PrismaClient({
  datasourceUrl: readDatabaseUrlTest(),
  errorFormat: 'minimal',
});

afterAll(async () => {
  await prisma.$disconnect();
});

it('migrate deploy crée les tables utilisateurs, le modèle de contenu et les modèles hôteliers', async () => {
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `;
  const tableNames = tables.map((row) => row.table_name);

  expect(tableNames).toEqual(
    expect.arrayContaining([
      'User',
      'UserToken',
      'City',
      'Category',
      'Asset',
      'Tour',
      'TourCategory',
      'Scene',
      'Hotspot',
      'Hotel',
      'Selection',
      'SelectionItem',
      'Kiosk',
      'UserHotel',
      'AuditLog',
    ]),
  );

  const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
    SELECT typname
    FROM pg_type
    WHERE typtype = 'e'
      AND typnamespace = (
        SELECT oid FROM pg_namespace WHERE nspname = 'public'
      )
  `;
  const enumNames = enums.map((row) => row.typname);

  expect(enumNames).toEqual(
    expect.arrayContaining([
      'Role',
      'UserTokenType',
      'HotelStars',
      'ContractType',
      'KioskDeviceType',
      'KioskStatus',
    ]),
  );
});

describe('modèle Prisma AuditLog (§5, F-91)', () => {
  it('contient les colonnes, contraintes et index attendus pour AuditLog', async () => {
    const columns = await prisma.$queryRaw<
      Array<{ column_name: string; data_type: string; is_nullable: string }>
    >`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'AuditLog'
    `;
    const colMap = new Map(columns.map((c) => [c.column_name, c]));

    expect(colMap.get('id')).toEqual({
      column_name: 'id',
      data_type: 'uuid',
      is_nullable: 'NO',
    });
    expect(colMap.get('userId')).toEqual({
      column_name: 'userId',
      data_type: 'uuid',
      is_nullable: 'YES',
    });
    expect(colMap.get('kioskId')).toEqual({
      column_name: 'kioskId',
      data_type: 'uuid',
      is_nullable: 'YES',
    });
    expect(colMap.get('action')).toEqual({
      column_name: 'action',
      data_type: 'text',
      is_nullable: 'NO',
    });
    expect(colMap.get('entityType')).toEqual({
      column_name: 'entityType',
      data_type: 'text',
      is_nullable: 'NO',
    });
    expect(colMap.get('entityId')).toEqual({
      column_name: 'entityId',
      data_type: 'text',
      is_nullable: 'YES',
    });
    expect(colMap.get('diff')).toEqual({
      column_name: 'diff',
      data_type: 'jsonb',
      is_nullable: 'YES',
    });
    expect(colMap.get('ip')).toEqual({
      column_name: 'ip',
      data_type: 'text',
      is_nullable: 'YES',
    });
    expect(colMap.get('createdAt')).toEqual({
      column_name: 'createdAt',
      data_type: 'timestamp without time zone',
      is_nullable: 'NO',
    });

    const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'AuditLog'
    `;
    const indexNames = indexes.map((i) => i.indexname);

    expect(indexNames).toContain('AuditLog_createdAt_idx');
    expect(indexNames).toContain('AuditLog_entityType_entityId_idx');
    expect(indexNames).toContain('AuditLog_action_idx');
  });

  it('permet la création d’une entrée d’audit et gère onDelete SetNull pour user et kiosk', async () => {
    const city = await prisma.city.create({
      data: {
        name: { fr: 'Rabat' },
        region: 'Rabat-Salé-Kénitra',
        lat: 34.020882,
        lng: -6.84165,
      },
    });

    const hotel = await prisma.hotel.create({
      data: {
        name: 'Hôtel Test Audit',
        stars: 'FIVE',
        cityId: city.id,
        address: 'Avenue Mohammed V',
        phone: '+212537000000',
        email: 'audit@hotel.ma',
        brandColor: '#6958A5',
        contractType: 'RENTAL',
        contractStart: new Date(),
        contractEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      },
    });

    const user = await prisma.user.create({
      data: {
        email: `audit-test-${Date.now().toString()}@xplor.local`,
        name: 'Admin Audit Test',
        passwordHash: 'dummyhash',
        role: 'ADMIN',
      },
    });

    const kiosk = await prisma.kiosk.create({
      data: {
        label: 'Kiosque Audit Test',
        hotelId: hotel.id,
        deviceType: 'TOUCH_SCREEN',
      },
    });

    const log = await prisma.auditLog.create({
      data: {
        userId: user.id,
        kioskId: kiosk.id,
        action: 'TOUR_PUBLISH',
        entityType: 'Tour',
        entityId: 'tour-123',
        diff: { before: { status: 'DRAFT' }, after: { status: 'PUBLISHED' } },
        ip: '192.168.1.100',
      },
    });

    expect(log.id).toBeDefined();
    expect(log.action).toBe('TOUR_PUBLISH');
    expect(log.entityType).toBe('Tour');
    expect(log.entityId).toBe('tour-123');
    expect(log.diff).toEqual({ before: { status: 'DRAFT' }, after: { status: 'PUBLISHED' } });
    expect(log.ip).toBe('192.168.1.100');
    expect(log.userId).toBe(user.id);
    expect(log.kioskId).toBe(kiosk.id);
    expect(log.createdAt).toBeInstanceOf(Date);

    // Relations inverses
    const userWithLogs = await prisma.user.findUnique({
      where: { id: user.id },
      include: { auditLogs: true },
    });
    expect(userWithLogs?.auditLogs.map((l) => l.id)).toContain(log.id);

    const kioskWithLogs = await prisma.kiosk.findUnique({
      where: { id: kiosk.id },
      include: { auditLogs: true },
    });
    expect(kioskWithLogs?.auditLogs.map((l) => l.id)).toContain(log.id);

    // Test onDelete: SetNull pour User
    await prisma.user.delete({ where: { id: user.id } });
    const logAfterUserDelete = await prisma.auditLog.findUnique({ where: { id: log.id } });
    expect(logAfterUserDelete?.userId).toBeNull();
    expect(logAfterUserDelete?.kioskId).toBe(kiosk.id);

    // Test onDelete: SetNull pour Kiosk
    await prisma.kiosk.delete({ where: { id: kiosk.id } });
    const logAfterKioskDelete = await prisma.auditLog.findUnique({ where: { id: log.id } });
    expect(logAfterKioskDelete?.kioskId).toBeNull();

    // Test création avec champs optionnels omis
    const minimalLog = await prisma.auditLog.create({
      data: {
        action: 'AUTH_FAILED',
        entityType: 'User',
      },
    });
    expect(minimalLog.id).toBeDefined();
    expect(minimalLog.action).toBe('AUTH_FAILED');
    expect(minimalLog.entityType).toBe('User');
    expect(minimalLog.userId).toBeNull();
    expect(minimalLog.kioskId).toBeNull();
    expect(minimalLog.entityId).toBeNull();
    expect(minimalLog.diff).toBeNull();
    expect(minimalLog.ip).toBeNull();
    expect(minimalLog.createdAt).toBeInstanceOf(Date);

    // Nettoyage
    await prisma.auditLog.deleteMany({ where: { id: { in: [log.id, minimalLog.id] } } });
    await prisma.hotel.delete({ where: { id: hotel.id } });
    await prisma.city.delete({ where: { id: city.id } });
  });
});
