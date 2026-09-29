import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InviteUserRequestSchema, type InviteUserResponse } from '@xplor/shared';

import { canManageUsers } from '../auth/access-policy.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { EmailTakenError } from './users.errors.js';
import { UsersService } from './users.service.js';

@Controller('admin/users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Post('invitations')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, CsrfGuard)
  async invite(@Req() request: SessionRequest, @Body() body: unknown): Promise<InviteUserResponse> {
    const principal = request.principal;
    if (principal === undefined || !canManageUsers(principal)) {
      throw new ForbiddenException();
    }
    const parsed = InviteUserRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    try {
      return await this.users.invite(parsed.data);
    } catch (error: unknown) {
      if (error instanceof EmailTakenError) {
        throw new HttpException(
          { statusCode: error.statusCode, code: error.code, message: error.code },
          error.statusCode,
        );
      }
      throw error;
    }
  }
}
