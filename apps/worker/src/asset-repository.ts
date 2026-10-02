import { PrismaClient, ProcessingStatus, Prisma } from '@prisma/client';

export interface AssetRepository {
  findForProcessing(id: string): Promise<{
    id: string;
    kind: string;
    originalKey: string;
    processingStatus: string;
    derivatives: unknown;
  } | null>;
  markReady(id: string, contentHash: string, derivatives: unknown): Promise<void>;
  markError(id: string, log: string): Promise<void>;
}

export class PrismaAssetRepository implements AssetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findForProcessing(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      select: {
        id: true,
        kind: true,
        originalKey: true,
        processingStatus: true,
        derivatives: true,
      },
    });
    if (!asset) {
      return null;
    }
    return {
      id: asset.id,
      kind: asset.kind,
      originalKey: asset.originalKey,
      processingStatus: asset.processingStatus,
      derivatives: asset.derivatives,
    };
  }

  async markReady(id: string, contentHash: string, derivatives: unknown): Promise<void> {
    await this.prisma.asset.update({
      where: { id },
      data: {
        processingStatus: ProcessingStatus.READY,
        contentHash,
        derivatives: derivatives as Prisma.InputJsonValue,
        processingLog: null,
      },
    });
  }

  async markError(id: string, log: string): Promise<void> {
    await this.prisma.asset.update({
      where: { id },
      data: {
        processingStatus: ProcessingStatus.ERROR,
        processingLog: log,
      },
    });
  }
}
