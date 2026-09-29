import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { LoginRequestSchema, type MeResponse } from '@xplor/shared';
import type { FastifyReply } from 'fastify';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { AuthRejectedError } from './auth.errors.js';
import { AuthService } from './auth.service.js';
import { CsrfGuard } from './csrf.guard.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './session-cookie.js';
import type { SessionRequest } from './session-request.js';
import { SessionGuard } from './session.guard.js';

/** 5 requêtes par minute et par IP (NF-01). Le guard n'est pas global. */
const LOGIN_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Pick<Env, 'NODE_ENV'>,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(LOGIN_THROTTLE)
  @UseGuards(ThrottlerGuard)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<MeResponse> {
    const parsed = LoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    try {
      const result = await this.auth.login(parsed.data);
      reply.setCookie(SESSION_COOKIE_NAME, result.sessionId, this.cookieOptions());
      return result.me;
    } catch (error: unknown) {
      rethrowAsHttp(error);
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard, CsrfGuard)
  async logout(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const sessionId = request.sessionId;
    if (sessionId === undefined) {
      throw new UnauthorizedException();
    }
    await this.auth.logout(sessionId);
    reply.clearCookie(SESSION_COOKIE_NAME, this.cookieOptions());
  }

  @Get('me')
  @UseGuards(SessionGuard)
  async me(@Req() request: SessionRequest): Promise<MeResponse> {
    const userId = request.principal?.userId;
    const csrfToken = request.session?.csrfToken;
    if (userId === undefined || csrfToken === undefined) {
      throw new UnauthorizedException();
    }
    try {
      return await this.auth.me(userId, csrfToken);
    } catch (error: unknown) {
      rethrowAsHttp(error);
    }
  }

  private cookieOptions() {
    return sessionCookieOptions(this.env.NODE_ENV === 'production');
  }
}

function rethrowAsHttp(error: unknown): never {
  if (error instanceof AuthRejectedError) {
    throw new HttpException(
      { statusCode: error.statusCode, code: error.code, message: error.code },
      error.statusCode,
    );
  }
  throw error;
}
