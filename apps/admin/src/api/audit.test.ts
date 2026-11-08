import {
  type AuditLogEntry,
  type AuditLogQuery,
  type PaginatedAuditLogResponse,
} from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listAuditLogs } from './audit.js';
import { clearCsrfToken, resetIsRedirectingForTests } from './client.js';

const sampleEntry: AuditLogEntry = {
  id: '018f3a38-c393-79d2-97b7-5f214f4df7e0',
  userId: '018f3a38-c393-79d2-97b7-5f214f4df7e1',
  kioskId: '018f3a38-c393-79d2-97b7-5f214f4df7e2',
  action: 'tour.publish',
  entityType: 'Tour',
  entityId: '018f3a38-c393-79d2-97b7-5f214f4df7e3',
  diff: { status: { from: 'DRAFT', to: 'PUBLISHED' } },
  ip: '192.168.1.1',
  createdAt: '2026-10-15T10:30:00.000Z',
};

const sampleAuditPage: PaginatedAuditLogResponse = {
  items: [sampleEntry],
  total: 1,
  page: 1,
  pageSize: 50,
};

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: string | null;
}

function lastCall(): RecordedCall | undefined {
  const call = fetchMock.mock.calls.at(-1);
  if (call === undefined) {
    return undefined;
  }
  const [input, init] = call;
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const method = init?.method ?? 'GET';
  const headers = new Headers(init?.headers);
  const body = typeof init?.body === 'string' ? init.body : null;
  return { url, method, headers, body };
}

describe('Client API du journal d audit (apps/admin/src/api/audit.ts)', () => {
  beforeEach(() => {
    clearCsrfToken();
    resetIsRedirectingForTests();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listAuditLogs', () => {
    it('construit la query string complète quand tous les paramètres sont fournis', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, sampleAuditPage));

      const query: AuditLogQuery = {
        page: 2,
        pageSize: 25,
        action: 'tour.publish',
        entityType: 'Tour',
        userId: '018f3a38-c393-79d2-97b7-5f214f4df7e1',
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-31T23:59:59.999Z',
      };

      await listAuditLogs(query);

      const call = lastCall();
      expect(call).toBeDefined();
      if (call === undefined) {
        return;
      }
      expect(call.method).toBe('GET');
      const url = new URL(call.url, 'http://localhost');
      expect(url.pathname).toBe('/api/v1/admin/audit');
      expect(url.searchParams.get('page')).toBe('2');
      expect(url.searchParams.get('pageSize')).toBe('25');
      expect(url.searchParams.get('action')).toBe('tour.publish');
      expect(url.searchParams.get('entityType')).toBe('Tour');
      expect(url.searchParams.get('userId')).toBe('018f3a38-c393-79d2-97b7-5f214f4df7e1');
      expect(url.searchParams.get('from')).toBe('2026-10-01T00:00:00.000Z');
      expect(url.searchParams.get('to')).toBe('2026-10-31T23:59:59.999Z');
    });

    it('omet strictement les paramètres absents ou undefined de la query string', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, sampleAuditPage));

      await listAuditLogs({
        page: 3,
        action: 'kiosk.create',
      });

      const call = lastCall();
      expect(call).toBeDefined();
      if (call === undefined) {
        return;
      }
      expect(call.method).toBe('GET');
      const url = new URL(call.url, 'http://localhost');
      expect(url.pathname).toBe('/api/v1/admin/audit');
      expect(url.searchParams.get('page')).toBe('3');
      expect(url.searchParams.get('action')).toBe('kiosk.create');
      expect(url.searchParams.has('pageSize')).toBe(false);
      expect(url.searchParams.has('entityType')).toBe(false);
      expect(url.searchParams.has('userId')).toBe(false);
      expect(url.searchParams.has('from')).toBe(false);
      expect(url.searchParams.has('to')).toBe(false);
    });

    it('valide et parse une réponse conforme au schéma PaginatedAuditLogResponseSchema', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, sampleAuditPage));

      const result = await listAuditLogs();

      expect(result).toEqual(sampleAuditPage);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe(sampleEntry.id);
      expect(result.items[0]?.action).toBe('tour.publish');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);

      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, {
          items: [{ id: 'not-a-uuid', action: 'invalid.action' }],
          total: 1,
          page: 1,
          pageSize: 50,
        }),
      );

      await expect(listAuditLogs()).rejects.toThrow();
    });
  });
});
