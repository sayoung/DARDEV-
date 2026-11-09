import { cleanup, render, screen, within } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import {
  AuditLogEntrySchema,
  PaginatedAuditLogResponseSchema,
  type AuditLogEntry,
  type PaginatedAuditLogResponse,
} from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listAuditLogs } from '../api/audit.js';
import { i18n } from '../i18n.js';
import { AuditPage } from './AuditPage.js';

vi.mock('../api/audit.js', () => ({
  listAuditLogs: vi.fn(),
}));

const mockEntry1: AuditLogEntry = AuditLogEntrySchema.parse({
  id: '018f3a38-c393-79d2-97b7-5f214f4df7e0',
  userId: '018f3a38-c393-79d2-97b7-5f214f4df7e1',
  kioskId: '018f3a38-c393-79d2-97b7-5f214f4df7e2',
  action: 'tour.publish',
  entityType: 'Tour',
  entityId: '018f3a38-c393-79d2-97b7-5f214f4df7e3',
  diff: { status: { from: 'DRAFT', to: 'PUBLISHED' } },
  ip: '192.168.1.1',
  createdAt: '2026-10-15T10:30:00.000Z',
});

const mockEntry2: AuditLogEntry = AuditLogEntrySchema.parse({
  id: '018f3a38-c393-79d2-97b7-5f214f4df7e4',
  userId: null,
  kioskId: null,
  action: 'auth.login_failed',
  entityType: 'User',
  entityId: null,
  diff: null,
  ip: '192.168.1.2',
  createdAt: '2026-10-16T11:00:00.000Z',
});

const defaultResponse: PaginatedAuditLogResponse =
  PaginatedAuditLogResponseSchema.parse({
    items: [mockEntry1, mockEntry2],
    total: 2,
    page: 1,
    pageSize: 50,
  });

describe('AuditPage', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.history.replaceState(null, '', '/audit');
    await i18n.changeLanguage('fr');
    vi.mocked(listAuditLogs).mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('affiche le titre et le sous-titre de la page', async () => {
    vi.mocked(listAuditLogs).mockResolvedValue(defaultResponse);

    render(<AuditPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: resources.fr.page.audit.title }),
    ).toBeDefined();
    expect(screen.getByText(resources.fr.page.audit.subtitle)).toBeDefined();
    await screen.findByRole('table');
  });

  it('rend le tableau rempli avec les colonnes et les lignes de journal d\'audit', async () => {
    vi.mocked(listAuditLogs).mockResolvedValue(defaultResponse);

    render(<AuditPage />);

    const table = await screen.findByRole('table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (thead === null || tbody === null) {
      throw new Error('Table thead or tbody not found');
    }

    const theadScope = within(thead);
    const tbodyScope = within(tbody);

    expect(theadScope.getByText(resources.fr.page.audit.columns.date)).toBeDefined();
    expect(theadScope.getByText(resources.fr.page.audit.columns.action)).toBeDefined();
    expect(theadScope.getByText(resources.fr.page.audit.columns.entityType)).toBeDefined();
    expect(theadScope.getByText(resources.fr.page.audit.columns.entityId)).toBeDefined();
    expect(theadScope.getByText(resources.fr.page.audit.columns.user)).toBeDefined();

    expect(
      tbodyScope.getByText(
        new Date('2026-10-15T10:30:00.000Z').toLocaleString('fr'),
      ),
    ).toBeDefined();
    expect(tbodyScope.getByText('tour.publish')).toBeDefined();
    expect(tbodyScope.getByText('Tour')).toBeDefined();
    expect(tbodyScope.getByText('018f3a38-c393-79d2-97b7-5f214f4df7e3')).toBeDefined();
    expect(tbodyScope.getByText('018f3a38-c393-79d2-97b7-5f214f4df7e1')).toBeDefined();

    expect(
      tbodyScope.getByText(
        new Date('2026-10-16T11:00:00.000Z').toLocaleString('fr'),
      ),
    ).toBeDefined();
    expect(tbodyScope.getByText('auth.login_failed')).toBeDefined();
    expect(tbodyScope.getByText('User')).toBeDefined();

    const emptyPlaceholders = tbodyScope.getAllByText(
      resources.fr.page.audit.emptyValue,
    );
    expect(emptyPlaceholders).toHaveLength(2);

    expect(listAuditLogs).toHaveBeenCalledTimes(1);
  });

  it('affiche l’état vide lorsqu’aucun événement d’audit n’est présent', async () => {
    const emptyResponse: PaginatedAuditLogResponse =
      PaginatedAuditLogResponseSchema.parse({
        items: [],
        total: 0,
        page: 1,
        pageSize: 50,
      });

    vi.mocked(listAuditLogs).mockResolvedValue(emptyResponse);

    render(<AuditPage />);

    expect(await screen.findByText(resources.fr.page.audit.empty)).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('affiche l’état de chargement pendant l’appel API', () => {
    vi.mocked(listAuditLogs).mockReturnValue(new Promise(() => {}));

    render(<AuditPage />);

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText(resources.fr.common.loading)).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('affiche l’état d’erreur lorsque listAuditLogs échoue', async () => {
    vi.mocked(listAuditLogs).mockRejectedValue(new Error('Network error'));

    render(<AuditPage />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(resources.fr.page.audit.loadError);
    expect(screen.queryByRole('table')).toBeNull();
  });
});
