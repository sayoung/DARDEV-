import {
  EnrollmentCodeResponseSchema,
  KioskCreateSchema,
  KioskListResponseSchema,
  KioskSchema,
  type EnrollmentCodeResponse,
  type Kiosk,
  type KioskCreate,
  type KioskListResponse,
} from '@xplor/shared';
import { requestJson } from './client.js';

export async function listKiosks(): Promise<KioskListResponse> {
  return requestJson('/api/v1/admin/kiosks', KioskListResponseSchema);
}

export async function createKiosk(input: KioskCreate): Promise<Kiosk> {
  return requestJson('/api/v1/admin/kiosks', KioskSchema, {
    method: 'POST',
    body: JSON.stringify(KioskCreateSchema.parse(input)),
  });
}

export async function issueEnrollmentCode(id: string): Promise<EnrollmentCodeResponse> {
  return requestJson(`/api/v1/admin/kiosks/${id}/enrollment-code`, EnrollmentCodeResponseSchema, {
    method: 'POST',
  });
}

export async function disableKiosk(id: string): Promise<Kiosk> {
  return requestJson(`/api/v1/admin/kiosks/${id}/disable`, KioskSchema, {
    method: 'POST',
  });
}

export async function forceSyncKiosk(id: string): Promise<void> {
  return requestJson(`/api/v1/admin/kiosks/${id}/force-sync`, null, {
    method: 'POST',
  });
}

export async function deleteKiosk(id: string): Promise<void> {
  return requestJson(`/api/v1/admin/kiosks/${id}`, null, {
    method: 'DELETE',
  });
}
