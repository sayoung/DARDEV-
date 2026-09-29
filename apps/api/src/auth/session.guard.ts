import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Principal } from '@xplor/shared';

import { readSessionId } from './session-cookie.js';
import type { SessionRequest } from './session-request.js';
import { SESSION_STORE, type SessionStore } from './session-store.js';
import { USER_LOOKUP, type UserLookup } from './user-lookup.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    @Inject(USER_LOOKUP) private readonly users: UserLookup,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const sessionId = readSessionId(request);
    if (sessionId === null) {
      throw new UnauthorizedException();
    }
    const session = await this.sessions.get(sessionId);
    if (!session) {
      throw new UnauthorizedException();
    }
    const user = await this.users.findById(session.userId);
    if (!user || !user.active) {
      throw new UnauthorizedException();
    }
    await this.sessions.touch(sessionId);
    const principal: Principal = {
      userId: user.id,
      role: user.role,
      // UserHotel arrive au jalon M1 : aucun hôtel n'est rattaché pour l'instant.
      hotelIds: [],
    };
    request.principal = principal;
    request.session = session;
    request.sessionId = sessionId;
    return true;
  }
}
