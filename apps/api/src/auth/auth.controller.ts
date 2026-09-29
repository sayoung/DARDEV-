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
import {
  AcceptInviteRequestSchema,
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  ResetPasswordRequestSchema,
  type MeResponse,
} from '@xplor/shared';
import type { FastifyReply } from 'fastify';
import type { ZodError } from 'zod';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { AuthRejectedError, AuthRequestError, PASSWORD_INVALID } from './auth.errors.js';
import { AuthService } from './auth.service.js';
import { CsrfGuard } from './csrf.guard.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './session-cookie.js';
import type { SessionRequest } from './session-request.js';
import { SessionGuard } from './session.guard.js';

/** 5 requêtes par minute et par IP (NF-01). Le guard n'est pas global. */
const FIVE_PER_MINUTE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Pick<Env, 'NODE_ENV'>,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(FIVE_PER_MINUTE)
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
  @HttpCode(HttpStatus.NO_CONTENT)
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

  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(FIVE_PER_MINUTE)
  @UseGuards(ThrottlerGuard)
  async forgotPassword(@Body() body: unknown): Promise<void> {
    const parsed = ForgotPasswordRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    try {
      await this.auth.forgotPassword(parsed.data.email);
    } catch {
      // 202 dans tous les cas : un échec d'envoi ne doit pas révéler que le compte existe.
    }
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() body: unknown): Promise<void> {
    const parsed = ResetPasswordRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw passwordSchemaError(parsed.error);
    }
    try {
      await this.auth.resetPassword(parsed.data.token, parsed.data.password);
    } catch (error: unknown) {
      rethrowAsHttp(error);
    }
  }

  @Post('invite/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(FIVE_PER_MINUTE)
  @UseGuards(ThrottlerGuard)
  async acceptInvite(@Body() body: unknown): Promise<void> {
    const parsed = AcceptInviteRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw passwordSchemaError(parsed.error);
    }
    try {
      await this.auth.acceptInvite(parsed.data.token, parsed.data.password);
    } catch (error: unknown) {
      rethrowAsHttp(error);
    }
  }

  private cookieOptions() {
    return sessionCookieOptions(this.env.NODE_ENV === 'production');
  }
}

function rethrowAsHttp(error: unknown): never {
  if (error instanceof AuthRejectedError || error instanceof AuthRequestError) {
    throw new HttpException(
      { statusCode: error.statusCode, code: error.code, message: error.code },
      error.statusCode,
    );
  }
  throw error;
}

function passwordSchemaError(error: ZodError): HttpException {
  const passwordIssue = error.issues.some((issue) => issue.path[0] === 'password');
  if (passwordIssue) {
    return new HttpException(
      { statusCode: 400, code: PASSWORD_INVALID, message: PASSWORD_INVALID },
      HttpStatus.BAD_REQUEST,
    );
  }
  return new BadRequestException();
}
