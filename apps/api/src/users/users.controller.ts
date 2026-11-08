import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  AdminUserListQuerySchema,
  InviteUserRequestSchema,
  SetUserHotelsRequestSchema,
  UpdateAdminUserRequestSchema,
  type AdminUser,
  type AdminUserListQuery,
  type InviteUserResponse,
  type PaginatedAdminUsersResponse,
  type Principal,
} from '@xplor/shared';
import { z } from 'zod';

import { canManageUsers } from '../auth/access-policy.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { parseResourceId } from '../catalog/catalog-http.js';
import { UsersAdminService } from './users-admin.service.js';
import { EmailTakenError } from './users.errors.js';
import { UsersService } from './users.service.js';

export type UsersOperations = Pick<UsersService, 'invite'>;

export type UsersAdminOperations = Pick<
  UsersAdminService,
  'list' | 'get' | 'update' | 'setHotels'
>;

const UNIMPLEMENTED_USERS_ADMIN: UsersAdminOperations = {
  list: () => Promise.reject(new Error('UsersAdminService non configuré')),
  get: () => Promise.reject(new Error('UsersAdminService non configuré')),
  update: () => Promise.reject(new Error('UsersAdminService non configuré')),
  setHotels: () => Promise.reject(new Error('UsersAdminService non configuré')),
};

function requireCanManageUsers(request: SessionRequest): Principal {
  const principal = request.principal;
  if (principal === undefined) {
    throw new UnauthorizedException();
  }
  if (!canManageUsers(principal)) {
    throw new ForbiddenException();
  }
  return principal;
}

function parseQueryNumber(value: unknown): unknown {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : Number.NaN;
  }
  return value;
}

export function parseAdminUserListQuery(query: unknown): AdminUserListQuery {
  if (query === undefined || query === null) {
    const parsedDefault = AdminUserListQuerySchema.safeParse({});
    if (!parsedDefault.success) {
      throw new BadRequestException();
    }
    return parsedDefault.data;
  }

  if (typeof query !== 'object' || Array.isArray(query)) {
    throw new BadRequestException();
  }

  const recordResult = z.record(z.string(), z.unknown()).safeParse(query);
  if (!recordResult.success) {
    throw new BadRequestException();
  }
  const raw = recordResult.data;
  const normalized: Record<string, unknown> = {};

  if (raw.page !== undefined) {
    normalized.page = parseQueryNumber(raw.page);
  }
  if (raw.pageSize !== undefined) {
    normalized.pageSize = parseQueryNumber(raw.pageSize);
  }
  if (raw.role !== undefined) {
    normalized.role = raw.role;
  }
  if (raw.active !== undefined) {
    normalized.active = raw.active;
  }
  if (raw.q !== undefined) {
    normalized.q = raw.q;
  }

  const parsed = AdminUserListQuerySchema.safeParse(normalized);
  if (!parsed.success) {
    throw new BadRequestException();
  }
  return parsed.data;
}

@Controller('admin/users')
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly users: UsersOperations,
    @Inject(UsersAdminService)
    @Optional()
    private readonly usersAdmin: UsersAdminOperations = UNIMPLEMENTED_USERS_ADMIN,
  ) {}

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

  @Get()
  @UseGuards(SessionGuard)
  async list(
    @Req() request: SessionRequest,
    @Query() query: unknown,
  ): Promise<PaginatedAdminUsersResponse> {
    requireCanManageUsers(request);
    const validQuery = parseAdminUserListQuery(query);
    return await this.usersAdmin.list(validQuery);
  }

  @Get(':id')
  @UseGuards(SessionGuard)
  async get(
    @Req() request: SessionRequest,
    @Param('id') id: string,
  ): Promise<AdminUser> {
    requireCanManageUsers(request);
    const userId = parseResourceId(id);
    return await this.usersAdmin.get(userId);
  }

  @Patch(':id')
  @UseGuards(SessionGuard, CsrfGuard)
  async update(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<AdminUser> {
    const principal = requireCanManageUsers(request);
    const userId = parseResourceId(id);
    const parsed = UpdateAdminUserRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return await this.usersAdmin.update(principal.userId, userId, parsed.data);
  }

  @Put(':id/hotels')
  @UseGuards(SessionGuard, CsrfGuard)
  async setHotels(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<AdminUser> {
    requireCanManageUsers(request);
    const userId = parseResourceId(id);
    const parsed = SetUserHotelsRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return await this.usersAdmin.setHotels(userId, parsed.data.hotelIds);
  }
}
