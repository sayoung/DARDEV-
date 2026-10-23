import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Worker } from 'bullmq';

import { boot, type BootFactories } from './main.js';
import { generateFlatDerivatives } from './derivatives/panorama.derivatives.js';
import { generateTiles } from './derivatives/panorama.tiles.js';
import type { KioskOfflineJobHandle } from './kiosk-offline.job.js';
import type { StatsDailyJobHandle } from './stats-daily.job.js';
import type { SmtpSender } from './smtp-sender.js';

describe('boot', () => {
  const validEnv = {
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://xplor:xplor@localhost:5432/xplor',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'xplor',
    S3_SECRET_KEY: 'xplor-dev-secret',
    S3_BUCKET: 'xplor',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
  };

  it("valide l'environnement puis journalise worker prêt, démarre et ferme le worker panorama, le job stats et le job hors-ligne", async () => {
    const messages: string[] = [];

    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    const mockKioskFindMany = vi.fn().mockResolvedValue([]);
    const mockKioskUpdate = vi.fn().mockResolvedValue({ id: 'kiosk-1' });
    const mockUserFindMany = vi.fn().mockResolvedValue([]);
    const mockEventFindMany = vi.fn().mockResolvedValue([]);
    const mockStatsDailyDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockStatsDailyCreateMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockTransaction = vi.fn().mockImplementation(
      async <T>(
        cb: (tx: {
          statsDaily: {
            deleteMany: typeof mockStatsDailyDeleteMany;
            createMany: typeof mockStatsDailyCreateMany;
          };
        }) => Promise<T>,
      ): Promise<T> => {
        return cb({
          statsDaily: {
            deleteMany: mockStatsDailyDeleteMany,
            createMany: mockStatsDailyCreateMany,
          },
        });
      },
    );

    const mockPrisma = {
      $disconnect: mockDisconnect,
      $transaction: mockTransaction,
      event: {
        findMany: mockEventFindMany,
      },
      statsDaily: {
        deleteMany: mockStatsDailyDeleteMany,
        createMany: mockStatsDailyCreateMany,
      },
      kiosk: {
        findMany: mockKioskFindMany,
        update: mockKioskUpdate,
      },
      user: {
        findMany: mockUserFindMany,
      },
    } as unknown as PrismaClient;

    const mockCloseWorker = vi.fn().mockResolvedValue(undefined);
    const mockWorker = {
      close: mockCloseWorker,
    } as unknown as Worker;

    const mockStartWorker = vi.fn<BootFactories['startWorker']>().mockReturnValue(mockWorker);

    const mockCloseStatsDailyJob = vi.fn().mockResolvedValue(undefined);
    const mockStatsDailyJob: StatsDailyJobHandle = {
      close: mockCloseStatsDailyJob,
    };
    const mockStartStatsDailyJob = vi
      .fn<BootFactories['startStatsDailyJob']>()
      .mockResolvedValue(mockStatsDailyJob);

    const mockCloseJob = vi.fn().mockResolvedValue(undefined);
    const mockJob: KioskOfflineJobHandle = {
      close: mockCloseJob,
    };
    const mockStartKioskOfflineJob = vi.fn<BootFactories['startKioskOfflineJob']>().mockResolvedValue(mockJob);

    const mockCloseSender = vi.fn();
    const mockSendMail = vi.fn<SmtpSender['sendMail']>().mockResolvedValue(undefined);
    const mockSender: SmtpSender = {
      sendMail: mockSendMail,
      close: mockCloseSender,
    };
    const mockCreateSmtpSender = vi.fn<NonNullable<BootFactories['createSmtpSender']>>().mockReturnValue(mockSender);

    const shutdown = await boot(
      validEnv,
      (message) => {
        messages.push(message);
      },
      {
        createPrisma: () => mockPrisma,
        startWorker: mockStartWorker,
        startStatsDailyJob: mockStartStatsDailyJob,
        startKioskOfflineJob: mockStartKioskOfflineJob,
        createSmtpSender: mockCreateSmtpSender,
      },
    );

    expect(messages).toEqual(['worker prêt (file panorama, concurrence 2)']);

    // Vérifie le démarrage du worker panorama existant
    expect(mockStartWorker).toHaveBeenCalledTimes(1);
    const workerCall = mockStartWorker.mock.calls[0];
    if (!workerCall) {
      expect.fail('startWorker non appelé');
    }
    const workerArgs = workerCall[0];
    expect(workerArgs.redisUrl).toBe(validEnv.REDIS_URL);
    expect(workerArgs.deps.repo).toBeDefined();
    expect(workerArgs.deps.storage).toBeDefined();
    expect(workerArgs.deps.generateFlat).toBe(generateFlatDerivatives);
    expect(workerArgs.deps.generateTiles).toBe(generateTiles);
    expect(typeof workerArgs.log).toBe('function');

    // Vérifie la création du sender SMTP
    expect(mockCreateSmtpSender).toHaveBeenCalledTimes(1);
    const senderCall = mockCreateSmtpSender.mock.calls[0];
    if (!senderCall) {
      expect.fail('createSmtpSender non appelé');
    }
    expect(senderCall[0].SMTP_HOST).toBe(validEnv.SMTP_HOST);
    expect(senderCall[0].SMTP_PORT).toBe(1025);

    // Vérifie le démarrage du job StatsDaily avec dépôt et redis
    expect(mockStartStatsDailyJob).toHaveBeenCalledTimes(1);
    const statsCall = mockStartStatsDailyJob.mock.calls[0];
    if (!statsCall) {
      expect.fail('startStatsDailyJob non appelé');
    }
    const statsArgs = statsCall[0];
    expect(statsArgs.redisUrl).toBe(validEnv.REDIS_URL);
    expect(typeof statsArgs.log).toBe('function');
    expect(typeof statsArgs.recalculate).toBe('function');

    // Vérifie l'exécution du callback recalculate (avec le dépôt instancié sur prisma)
    const recalculateResult = await statsArgs.recalculate();
    expect(recalculateResult.yesterday.bucketsCount).toBe(0);
    expect(recalculateResult.today.bucketsCount).toBe(0);
    expect(mockEventFindMany).toHaveBeenCalledTimes(2);
    expect(mockStatsDailyDeleteMany).toHaveBeenCalledTimes(2);

    // Vérifie le démarrage du job de surveillance des kiosques hors-ligne
    expect(mockStartKioskOfflineJob).toHaveBeenCalledTimes(1);
    const kioskCall = mockStartKioskOfflineJob.mock.calls[0];
    if (!kioskCall) {
      expect.fail('startKioskOfflineJob non appelé');
    }
    const kioskArgs = kioskCall[0];
    expect(kioskArgs.redisUrl).toBe(validEnv.REDIS_URL);
    expect(typeof kioskArgs.log).toBe('function');
    expect(typeof kioskArgs.check).toBe('function');

    // Vérifie l'exécution du callback check
    const checkResult = await kioskArgs.check();
    expect(checkResult).toEqual({ alerted: [] });
    expect(mockKioskFindMany).toHaveBeenCalledTimes(1);

    // Vérifie l'arrêt propre de toutes les ressources
    await shutdown();

    expect(mockCloseJob).toHaveBeenCalledTimes(1);
    expect(mockCloseStatsDailyJob).toHaveBeenCalledTimes(1);
    expect(mockCloseWorker).toHaveBeenCalledTimes(1);
    expect(mockCloseSender).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);

    const jobOrder = mockCloseJob.mock.invocationCallOrder[0];
    const statsOrder = mockCloseStatsDailyJob.mock.invocationCallOrder[0];
    const workerOrder = mockCloseWorker.mock.invocationCallOrder[0];
    const senderOrder = mockCloseSender.mock.invocationCallOrder[0];
    const disconnectOrder = mockDisconnect.mock.invocationCallOrder[0];

    if (
      jobOrder !== undefined &&
      statsOrder !== undefined &&
      workerOrder !== undefined &&
      senderOrder !== undefined &&
      disconnectOrder !== undefined
    ) {
      expect(jobOrder).toBeLessThan(statsOrder);
      expect(statsOrder).toBeLessThan(workerOrder);
      expect(workerOrder).toBeLessThan(disconnectOrder);
      expect(senderOrder).toBeLessThan(disconnectOrder);
    } else {
      expect.fail("Les fonctions de fermeture n'ont pas toutes été appelées");
    }
  });

  it("exécute le contrôle hors-ligne via check et déclenche l'envoi d'email quand un kiosque est inactif en journée", async () => {
    vi.useFakeTimers();
    const testNow = new Date('2026-10-18T12:00:00.000Z');
    vi.setSystemTime(testNow);

    try {
      const oldHeartbeat = new Date(testNow.getTime() - 3 * 60 * 60 * 1000); // 3h d'inactivité

      const mockDisconnect = vi.fn().mockResolvedValue(undefined);
      const mockKioskFindMany = vi.fn().mockResolvedValue([
        {
          id: 'kiosk-offline-id-1',
          label: 'Kiosque Entrée',
          status: 'ACTIVE',
          lastHeartbeatAt: oldHeartbeat,
          lastOfflineAlertAt: null,
          hotel: { name: 'Hôtel Rabat' },
        },
      ]);
      const mockKioskUpdate = vi.fn().mockResolvedValue({ id: 'kiosk-offline-id-1' });
      const mockUserFindMany = vi.fn().mockResolvedValue([
        { email: 'admin@xplor.ma' },
      ]);

      const mockPrisma = {
        $disconnect: mockDisconnect,
        kiosk: {
          findMany: mockKioskFindMany,
          update: mockKioskUpdate,
        },
        user: {
          findMany: mockUserFindMany,
        },
      } as unknown as PrismaClient;

      const mockCloseWorker = vi.fn().mockResolvedValue(undefined);
      const mockWorker = { close: mockCloseWorker } as unknown as Worker;
      const mockStartWorker = vi.fn<BootFactories['startWorker']>().mockReturnValue(mockWorker);

      const mockCloseStatsDailyJob = vi.fn().mockResolvedValue(undefined);
      const mockStatsDailyJob: StatsDailyJobHandle = { close: mockCloseStatsDailyJob };
      const mockStartStatsDailyJob = vi
        .fn<BootFactories['startStatsDailyJob']>()
        .mockResolvedValue(mockStatsDailyJob);

      const mockCloseJob = vi.fn().mockResolvedValue(undefined);
      const mockJob: KioskOfflineJobHandle = { close: mockCloseJob };
      const mockStartKioskOfflineJob = vi.fn<BootFactories['startKioskOfflineJob']>().mockResolvedValue(mockJob);

      const mockCloseSender = vi.fn();
      const mockSendMail = vi.fn<SmtpSender['sendMail']>().mockResolvedValue(undefined);
      const mockSender: SmtpSender = {
        sendMail: mockSendMail,
        close: mockCloseSender,
      };
      const mockCreateSmtpSender = vi.fn<NonNullable<BootFactories['createSmtpSender']>>().mockReturnValue(mockSender);

      const shutdown = await boot(
        validEnv,
        () => {},
        {
          createPrisma: () => mockPrisma,
          startWorker: mockStartWorker,
          startStatsDailyJob: mockStartStatsDailyJob,
          startKioskOfflineJob: mockStartKioskOfflineJob,
          createSmtpSender: mockCreateSmtpSender,
        },
      );

      const kioskCall = mockStartKioskOfflineJob.mock.calls[0];
      if (!kioskCall) {
        expect.fail('startKioskOfflineJob non appelé');
      }
      const result = await kioskCall[0].check();

      expect(result.alerted).toEqual(['kiosk-offline-id-1']);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const sendMailCall = mockSendMail.mock.calls[0];
      if (!sendMailCall) {
        expect.fail('sendMail non appelé');
      }
      expect(sendMailCall[0].to).toBe('admin@xplor.ma');
      expect(sendMailCall[0].subject).toBe('[Xplor] Alerte : 1 kiosque hors ligne');
      expect(sendMailCall[0].text).toContain('Kiosque Entrée');
      expect(sendMailCall[0].text).toContain('Hôtel Rabat');
      expect(mockKioskUpdate).toHaveBeenCalledTimes(1);
      expect(mockKioskUpdate).toHaveBeenCalledWith({
        where: { id: 'kiosk-offline-id-1' },
        data: { lastOfflineAlertAt: testNow },
      });

      await shutdown();
    } finally {
      vi.useRealTimers();
    }
  });

  it('démarre avec la fabrique createSmtpSender par défaut si non fournie', async () => {
    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    const mockPrisma = {
      $disconnect: mockDisconnect,
      kiosk: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue(undefined),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaClient;

    const mockWorker = { close: vi.fn().mockResolvedValue(undefined) } as unknown as Worker;
    const mockStartWorker = vi.fn<BootFactories['startWorker']>().mockReturnValue(mockWorker);

    const mockCloseStatsDailyJob = vi.fn().mockResolvedValue(undefined);
    const mockStatsDailyJob: StatsDailyJobHandle = { close: mockCloseStatsDailyJob };
    const mockStartStatsDailyJob = vi
      .fn<BootFactories['startStatsDailyJob']>()
      .mockResolvedValue(mockStatsDailyJob);

    const mockJob: KioskOfflineJobHandle = { close: vi.fn().mockResolvedValue(undefined) };
    const mockStartKioskOfflineJob = vi.fn<BootFactories['startKioskOfflineJob']>().mockResolvedValue(mockJob);

    const shutdown = await boot(
      validEnv,
      () => {},
      {
        createPrisma: () => mockPrisma,
        startWorker: mockStartWorker,
        startStatsDailyJob: mockStartStatsDailyJob,
        startKioskOfflineJob: mockStartKioskOfflineJob,
      },
    );

    await expect(shutdown()).resolves.toBeUndefined();
  });

  it('ferme le job StatsDaily, le worker, le sender et déconnecte prisma si startKioskOfflineJob échoue au démarrage', async () => {
    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    const mockPrisma = { $disconnect: mockDisconnect } as unknown as PrismaClient;

    const mockCloseWorker = vi.fn().mockResolvedValue(undefined);
    const mockWorker = { close: mockCloseWorker } as unknown as Worker;
    const mockStartWorker = vi.fn<BootFactories['startWorker']>().mockReturnValue(mockWorker);

    const mockCloseStatsDailyJob = vi.fn().mockResolvedValue(undefined);
    const mockStatsDailyJob: StatsDailyJobHandle = { close: mockCloseStatsDailyJob };
    const mockStartStatsDailyJob = vi
      .fn<BootFactories['startStatsDailyJob']>()
      .mockResolvedValue(mockStatsDailyJob);

    const mockStartKioskOfflineJob = vi.fn<BootFactories['startKioskOfflineJob']>().mockRejectedValue(
      new Error('Erreur connexion Redis job'),
    );

    const mockCloseSender = vi.fn();
    const mockSender: SmtpSender = {
      sendMail: vi.fn().mockResolvedValue(undefined),
      close: mockCloseSender,
    };
    const mockCreateSmtpSender = vi.fn<NonNullable<BootFactories['createSmtpSender']>>().mockReturnValue(mockSender);

    await expect(
      boot(
        validEnv,
        () => {},
        {
          createPrisma: () => mockPrisma,
          startWorker: mockStartWorker,
          startStatsDailyJob: mockStartStatsDailyJob,
          startKioskOfflineJob: mockStartKioskOfflineJob,
          createSmtpSender: mockCreateSmtpSender,
        },
      ),
    ).rejects.toThrow('Erreur connexion Redis job');

    expect(mockCloseStatsDailyJob).toHaveBeenCalledTimes(1);
    expect(mockCloseWorker).toHaveBeenCalledTimes(1);
    expect(mockCloseSender).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('ferme le worker, le sender et déconnecte prisma si startStatsDailyJob échoue au démarrage', async () => {
    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    const mockPrisma = { $disconnect: mockDisconnect } as unknown as PrismaClient;

    const mockCloseWorker = vi.fn().mockResolvedValue(undefined);
    const mockWorker = { close: mockCloseWorker } as unknown as Worker;
    const mockStartWorker = vi.fn<BootFactories['startWorker']>().mockReturnValue(mockWorker);

    const mockStartStatsDailyJob = vi
      .fn<BootFactories['startStatsDailyJob']>()
      .mockRejectedValue(new Error('Erreur démarrage StatsDaily'));

    const mockCloseKioskJob = vi.fn().mockResolvedValue(undefined);
    const mockKioskJob: KioskOfflineJobHandle = { close: mockCloseKioskJob };
    const mockStartKioskOfflineJob = vi
      .fn<BootFactories['startKioskOfflineJob']>()
      .mockResolvedValue(mockKioskJob);

    const mockCloseSender = vi.fn();
    const mockSender: SmtpSender = {
      sendMail: vi.fn().mockResolvedValue(undefined),
      close: mockCloseSender,
    };
    const mockCreateSmtpSender = vi.fn<NonNullable<BootFactories['createSmtpSender']>>().mockReturnValue(mockSender);

    await expect(
      boot(
        validEnv,
        () => {},
        {
          createPrisma: () => mockPrisma,
          startWorker: mockStartWorker,
          startStatsDailyJob: mockStartStatsDailyJob,
          startKioskOfflineJob: mockStartKioskOfflineJob,
          createSmtpSender: mockCreateSmtpSender,
        },
      ),
    ).rejects.toThrow('Erreur démarrage StatsDaily');

    expect(mockStartKioskOfflineJob).not.toHaveBeenCalled();
    expect(mockCloseWorker).toHaveBeenCalledTimes(1);
    expect(mockCloseSender).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('ferme le sender et déconnecte prisma si startWorker échoue au démarrage', async () => {
    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    const mockPrisma = { $disconnect: mockDisconnect } as unknown as PrismaClient;

    const mockStartWorker = vi.fn<BootFactories['startWorker']>().mockImplementation(() => {
      throw new Error('Erreur initialisation worker panorama');
    });

    const mockCloseStatsDailyJob = vi.fn().mockResolvedValue(undefined);
    const mockStatsDailyJob: StatsDailyJobHandle = { close: mockCloseStatsDailyJob };
    const mockStartStatsDailyJob = vi
      .fn<BootFactories['startStatsDailyJob']>()
      .mockResolvedValue(mockStatsDailyJob);

    const mockJob: KioskOfflineJobHandle = { close: vi.fn().mockResolvedValue(undefined) };
    const mockStartKioskOfflineJob = vi.fn<BootFactories['startKioskOfflineJob']>().mockResolvedValue(mockJob);

    const mockCloseSender = vi.fn();
    const mockSender: SmtpSender = {
      sendMail: vi.fn().mockResolvedValue(undefined),
      close: mockCloseSender,
    };
    const mockCreateSmtpSender = vi.fn<NonNullable<BootFactories['createSmtpSender']>>().mockReturnValue(mockSender);

    await expect(
      boot(
        validEnv,
        () => {},
        {
          createPrisma: () => mockPrisma,
          startWorker: mockStartWorker,
          startStatsDailyJob: mockStartStatsDailyJob,
          startKioskOfflineJob: mockStartKioskOfflineJob,
          createSmtpSender: mockCreateSmtpSender,
        },
      ),
    ).rejects.toThrow('Erreur initialisation worker panorama');

    expect(mockStartStatsDailyJob).not.toHaveBeenCalled();
    expect(mockStartKioskOfflineJob).not.toHaveBeenCalled();
    expect(mockCloseSender).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('continue la fermeture du worker, sender et prisma même si le job échoue à la fermeture', async () => {
    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    const mockPrisma = {
      $disconnect: mockDisconnect,
      kiosk: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue(undefined) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;

    const mockCloseWorker = vi.fn().mockResolvedValue(undefined);
    const mockWorker = { close: mockCloseWorker } as unknown as Worker;
    const mockStartWorker = vi.fn<BootFactories['startWorker']>().mockReturnValue(mockWorker);

    const mockCloseStatsDailyJob = vi.fn().mockResolvedValue(undefined);
    const mockStatsDailyJob: StatsDailyJobHandle = { close: mockCloseStatsDailyJob };
    const mockStartStatsDailyJob = vi
      .fn<BootFactories['startStatsDailyJob']>()
      .mockResolvedValue(mockStatsDailyJob);

    const mockCloseJob = vi.fn().mockRejectedValue(new Error('Erreur close job'));
    const mockJob: KioskOfflineJobHandle = { close: mockCloseJob };
    const mockStartKioskOfflineJob = vi.fn<BootFactories['startKioskOfflineJob']>().mockResolvedValue(mockJob);

    const mockCloseSender = vi.fn();
    const mockSender: SmtpSender = {
      sendMail: vi.fn().mockResolvedValue(undefined),
      close: mockCloseSender,
    };
    const mockCreateSmtpSender = vi.fn<NonNullable<BootFactories['createSmtpSender']>>().mockReturnValue(mockSender);

    const shutdown = await boot(
      validEnv,
      () => {},
      {
        createPrisma: () => mockPrisma,
        startWorker: mockStartWorker,
        startStatsDailyJob: mockStartStatsDailyJob,
        startKioskOfflineJob: mockStartKioskOfflineJob,
        createSmtpSender: mockCreateSmtpSender,
      },
    );

    await expect(shutdown()).rejects.toThrow('Erreur close job');

    expect(mockCloseJob).toHaveBeenCalledTimes(1);
    expect(mockCloseStatsDailyJob).toHaveBeenCalledTimes(1);
    expect(mockCloseWorker).toHaveBeenCalledTimes(1);
    expect(mockCloseSender).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('continue la fermeture du worker, sender et prisma même si statsDailyJob échoue à la fermeture', async () => {
    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    const mockPrisma = {
      $disconnect: mockDisconnect,
      kiosk: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue(undefined) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;

    const mockCloseWorker = vi.fn().mockResolvedValue(undefined);
    const mockWorker = { close: mockCloseWorker } as unknown as Worker;
    const mockStartWorker = vi.fn<BootFactories['startWorker']>().mockReturnValue(mockWorker);

    const mockCloseStatsDailyJob = vi.fn().mockRejectedValue(new Error('Erreur close StatsDaily'));
    const mockStatsDailyJob: StatsDailyJobHandle = { close: mockCloseStatsDailyJob };
    const mockStartStatsDailyJob = vi
      .fn<BootFactories['startStatsDailyJob']>()
      .mockResolvedValue(mockStatsDailyJob);

    const mockCloseJob = vi.fn().mockResolvedValue(undefined);
    const mockJob: KioskOfflineJobHandle = { close: mockCloseJob };
    const mockStartKioskOfflineJob = vi.fn<BootFactories['startKioskOfflineJob']>().mockResolvedValue(mockJob);

    const mockCloseSender = vi.fn();
    const mockSender: SmtpSender = {
      sendMail: vi.fn().mockResolvedValue(undefined),
      close: mockCloseSender,
    };
    const mockCreateSmtpSender = vi.fn<NonNullable<BootFactories['createSmtpSender']>>().mockReturnValue(mockSender);

    const shutdown = await boot(
      validEnv,
      () => {},
      {
        createPrisma: () => mockPrisma,
        startWorker: mockStartWorker,
        startStatsDailyJob: mockStartStatsDailyJob,
        startKioskOfflineJob: mockStartKioskOfflineJob,
        createSmtpSender: mockCreateSmtpSender,
      },
    );

    await expect(shutdown()).rejects.toThrow('Erreur close StatsDaily');

    expect(mockCloseJob).toHaveBeenCalledTimes(1);
    expect(mockCloseStatsDailyJob).toHaveBeenCalledTimes(1);
    expect(mockCloseWorker).toHaveBeenCalledTimes(1);
    expect(mockCloseSender).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it("ne journalise pas si l'environnement est invalide", async () => {
    const messages: string[] = [];
    await expect(
      boot({}, (message) => {
        messages.push(message);
      }),
    ).rejects.toThrow(
      'Invalid environment variables: REDIS_URL, DATABASE_URL, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, SMTP_HOST, SMTP_PORT',
    );
    expect(messages).toEqual([]);
  });

  it('refuse de démarrer si STORAGE_PROVIDER est local', async () => {
    const messages: string[] = [];
    await expect(
      boot({ ...validEnv, STORAGE_PROVIDER: 'local' }, (message) => {
        messages.push(message);
      }),
    ).rejects.toThrow(
      'Le worker ne supporte pas STORAGE_PROVIDER=local. Utilisez s3 (pas de stockage disque partagé entre API et worker).',
    );
    expect(messages).toEqual([]);
  });
});
