import { forwardRef, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuditController } from './audit.controller.js';
import { AuditQueryService } from './audit-query.service.js';
import { AuditService } from './audit.service.js';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [AuditController],
  providers: [AuditService, AuditQueryService],
  exports: [AuditService, AuditQueryService],
})
export class AuditModule {}
