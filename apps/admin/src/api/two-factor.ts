import {
  TwoFactorCodeBodySchema,
  TwoFactorSetupResponseSchema,
  type TwoFactorCodeBody,
  type TwoFactorSetupResponse,
} from '@xplor/shared';
import { requestJson } from './client.js';

export async function beginTwoFactorSetup(): Promise<TwoFactorSetupResponse> {
  return requestJson('/api/v1/auth/2fa/setup', TwoFactorSetupResponseSchema, {
    method: 'POST',
  });
}

export async function confirmTwoFactor(code: string | TwoFactorCodeBody): Promise<void> {
  const payload = typeof code === 'string' ? { code } : code;
  const body = TwoFactorCodeBodySchema.parse(payload);
  return requestJson('/api/v1/auth/2fa/confirm', null, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function disableTwoFactor(code: string | TwoFactorCodeBody): Promise<void> {
  const payload = typeof code === 'string' ? { code } : code;
  const body = TwoFactorCodeBodySchema.parse(payload);
  return requestJson('/api/v1/auth/2fa/disable', null, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
