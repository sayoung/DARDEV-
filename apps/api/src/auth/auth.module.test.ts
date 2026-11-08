import 'reflect-metadata';

import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { ENV } from '../config/config.module.js';
import { AuditService } from '../audit/audit.service.js';
import { MAILER } from '../mail/mailer.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REDIS } from '../redis/redis.module.js';
import { AuthModule, DEFAULT_TEST_TOTP_ENCRYPTION_KEY } from './auth.module.js';
import { PrismaTwoFactorUserRepository } from './prisma-two-factor.user.repository.js';
import {
  TOTP_ENCRYPTION_KEY,
  TWO_FACTOR_USER_REPOSITORY,
  TwoFactorService,
  type TwoFactorUserRepository,
} from './two-factor.service.js';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useValue: { user: { findUnique: () => Promise.resolve(null), update: () => Promise.resolve({}) } },
    },
    {
      provide: REDIS,
      useValue: {
        defineCommand: () => {},
        get: () => Promise.resolve(null),
        set: () => Promise.resolve('OK'),
      },
    },
    {
      provide: MAILER,
      useValue: {
        send: () => Promise.resolve(),
      },
    },
    {
      provide: ENV,
      useValue: {
        NODE_ENV: 'test',
        ADMIN_BASE_URL: 'http://localhost:5173',
      },
    },
  ],
  exports: [PrismaService, REDIS, MAILER, ENV],
})
class MockAuthDependenciesModule {}

const customTotpKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useValue: { user: { findUnique: () => Promise.resolve(null), update: () => Promise.resolve({}) } },
    },
    {
      provide: REDIS,
      useValue: {
        defineCommand: () => {},
        get: () => Promise.resolve(null),
        set: () => Promise.resolve('OK'),
      },
    },
    {
      provide: MAILER,
      useValue: {
        send: () => Promise.resolve(),
      },
    },
    {
      provide: ENV,
      useValue: {
        NODE_ENV: 'test',
        ADMIN_BASE_URL: 'http://localhost:5173',
        TOTP_ENCRYPTION_KEY: customTotpKey,
      },
    },
  ],
  exports: [PrismaService, REDIS, MAILER, ENV],
})
class MockAuthDependenciesWithKeyModule {}

describe('AuthModule wiring', () => {
  it('compile AuthModule sans dépendance circulaire et résout TwoFactorService avec la clé par défaut', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockAuthDependenciesModule, AuthModule],
    }).compile();

    const twoFactorService = moduleRef.get<TwoFactorService>(TwoFactorService);
    expect(twoFactorService).toBeInstanceOf(TwoFactorService);

    const twoFactorRepo = moduleRef.get<TwoFactorUserRepository>(TWO_FACTOR_USER_REPOSITORY);
    expect(twoFactorRepo).toBeInstanceOf(PrismaTwoFactorUserRepository);

    const encryptionKey = moduleRef.get<string>(TOTP_ENCRYPTION_KEY);
    expect(encryptionKey).toBe(DEFAULT_TEST_TOTP_ENCRYPTION_KEY);
  });

  it('résout TOTP_ENCRYPTION_KEY depuis l env lorsqu elle est fournie', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockAuthDependenciesWithKeyModule, AuthModule],
    }).compile();

    const encryptionKey = moduleRef.get<string>(TOTP_ENCRYPTION_KEY);
    expect(encryptionKey).toBe(customTotpKey);

    const twoFactorService = moduleRef.get<TwoFactorService>(TwoFactorService);
    expect(twoFactorService).toBeInstanceOf(TwoFactorService);
  });

  it('résout AuditService via AuditModule importé dans AuthModule (F-91)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockAuthDependenciesModule, AuthModule],
    }).compile();

    const auditService = moduleRef.get<AuditService>(AuditService);
    expect(auditService).toBeInstanceOf(AuditService);
  });
});
