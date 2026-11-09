import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const mockEntry3: AuditLogEntry = AuditLogEntrySchema.parse({
  id: '018f3a38-c393-79d2-97b7-5f214f4df7e5',
  userId: '018f3a38-c393-79d2-97b7-5f214f4df7e1',
  kioskId: null,
  action: 'entity.delete',
  entityType: 'Tour',
  entityId: '018f3a38-c393-79d2-97b7-5f214f4df7e6',
  diff: null,
  ip: '192.168.1.3',
  createdAt: '2026-10-17T09:00:00.000Z',
});

const defaultResponse: PaginatedAuditLogResponse =
  PaginatedAuditLogResponseSchema.parse({
    items: [mockEntry1, mockEntry2],
    total: 2,
    page: 1,
    pageSize: 50,
  });

const page1Response: PaginatedAuditLogResponse =
  PaginatedAuditLogResponseSchema.parse({
    items: [mockEntry1, mockEntry2],
    total: 3,
    page: 1,
    pageSize: 2,
  });

const page2Response: PaginatedAuditLogResponse =
  PaginatedAuditLogResponseSchema.parse({
    items: [mockEntry3],
    total: 3,
    page: 2,
    pageSize: 2,
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
    expect(listAuditLogs).toHaveBeenCalledWith({ page: 1 });
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

  it('désactive le bouton Précédent en page 1 et permet la navigation vers la page 2 lors du clic sur Suivant', async () => {
    vi.mocked(listAuditLogs).mockResolvedValueOnce(page1Response);

    render(<AuditPage />);

    await screen.findByRole('table');

    const prevButton = screen.getByRole('button', {
      name: resources.fr.page.audit.pagination.prev,
    });
    const nextButton = screen.getByRole('button', {
      name: resources.fr.page.audit.pagination.next,
    });

    expect(prevButton.hasAttribute('disabled')).toBe(true);
    expect(nextButton.hasAttribute('disabled')).toBe(false);
    expect(screen.getByText('Page 1 sur 2')).toBeDefined();

    vi.mocked(listAuditLogs).mockResolvedValueOnce(page2Response);
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalledWith({ page: 2 });
    });

    expect(window.location.search).toContain('page=2');
    await within(await screen.findByRole('table')).findByText('entity.delete');

    const prevButtonOnPage2 = screen.getByRole('button', {
      name: resources.fr.page.audit.pagination.prev,
    });
    const nextButtonOnPage2 = screen.getByRole('button', {
      name: resources.fr.page.audit.pagination.next,
    });

    expect(prevButtonOnPage2.hasAttribute('disabled')).toBe(false);
    expect(nextButtonOnPage2.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Page 2 sur 2')).toBeDefined();
  });

  it('permet de revenir à la page 1 via le bouton Précédent depuis la page 2', async () => {
    vi.mocked(listAuditLogs).mockResolvedValueOnce(page2Response);
    window.history.replaceState(null, '', '/audit?page=2');

    render(<AuditPage />);

    await within(await screen.findByRole('table')).findByText('entity.delete');

    const prevButton = screen.getByRole('button', {
      name: resources.fr.page.audit.pagination.prev,
    });
    const nextButton = screen.getByRole('button', {
      name: resources.fr.page.audit.pagination.next,
    });

    expect(prevButton.hasAttribute('disabled')).toBe(false);
    expect(nextButton.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Page 2 sur 2')).toBeDefined();

    vi.mocked(listAuditLogs).mockResolvedValueOnce(page1Response);
    fireEvent.click(prevButton);

    await waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalledWith({ page: 1 });
    });

    expect(window.location.search).toContain('page=1');
    await within(await screen.findByRole('table')).findByText('tour.publish');

    const prevButtonOnPage1 = screen.getByRole('button', {
      name: resources.fr.page.audit.pagination.prev,
    });
    const nextButtonOnPage1 = screen.getByRole('button', {
      name: resources.fr.page.audit.pagination.next,
    });

    expect(prevButtonOnPage1.hasAttribute('disabled')).toBe(true);
    expect(nextButtonOnPage1.hasAttribute('disabled')).toBe(false);
    expect(screen.getByText('Page 1 sur 2')).toBeDefined();
  });

  it('désactive les deux boutons lorsqu’il n’y a qu’une seule page', async () => {
    vi.mocked(listAuditLogs).mockResolvedValueOnce(defaultResponse);

    render(<AuditPage />);

    await screen.findByRole('table');

    const prevButton = screen.getByRole('button', {
      name: resources.fr.page.audit.pagination.prev,
    });
    const nextButton = screen.getByRole('button', {
      name: resources.fr.page.audit.pagination.next,
    });

    expect(prevButton.hasAttribute('disabled')).toBe(true);
    expect(nextButton.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Page 1 sur 1')).toBeDefined();
  });

  it('gère l’erreur lors du changement de page', async () => {
    vi.mocked(listAuditLogs).mockResolvedValueOnce(page1Response);

    render(<AuditPage />);

    await screen.findByRole('table');

    const nextButton = screen.getByRole('button', {
      name: resources.fr.page.audit.pagination.next,
    });

    vi.mocked(listAuditLogs).mockRejectedValueOnce(new Error('Network error on page 2'));
    fireEvent.click(nextButton);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(resources.fr.page.audit.loadError);
  });

  it('garde le champ entityType activé pendant le chargement lors de la frappe de plusieurs caractères', () => {
    vi.mocked(listAuditLogs).mockReturnValue(new Promise(() => {}));

    render(<AuditPage />);

    expect(screen.getByRole('status')).toBeDefined();
    const entityTypeInput = screen.getByTestId('audit-filter-entity-type');
    expect(entityTypeInput.hasAttribute('disabled')).toBe(false);

    fireEvent.change(entityTypeInput, { target: { value: 'T' } });
    expect(entityTypeInput.hasAttribute('disabled')).toBe(false);

    fireEvent.change(entityTypeInput, { target: { value: 'To' } });
    expect(entityTypeInput.hasAttribute('disabled')).toBe(false);

    fireEvent.change(entityTypeInput, { target: { value: 'Tou' } });
    expect(entityTypeInput.hasAttribute('disabled')).toBe(false);

    fireEvent.change(entityTypeInput, { target: { value: 'Tour' } });
    expect(entityTypeInput.hasAttribute('disabled')).toBe(false);

    if (entityTypeInput instanceof HTMLInputElement) {
      expect(entityTypeInput.value).toBe('Tour');
    } else {
      throw new Error('entityTypeInput is not an HTMLInputElement');
    }

    expect(listAuditLogs).toHaveBeenCalledTimes(1);
  });

  it('transmet les filtres action, entityType, from et to à listAuditLogs et les reflète dans l’URL', async () => {
    vi.mocked(listAuditLogs).mockResolvedValue(defaultResponse);

    render(<AuditPage />);

    await screen.findByRole('table');
    expect(listAuditLogs).toHaveBeenCalledWith({ page: 1 });

    const actionSelect = screen.getByTestId('audit-filter-action');
    const entityTypeInput = screen.getByTestId('audit-filter-entity-type');
    const fromInput = screen.getByTestId('audit-filter-from');
    const toInput = screen.getByTestId('audit-filter-to');

    fireEvent.change(actionSelect, { target: { value: 'tour.publish' } });

    await waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalledWith({
        page: 1,
        action: 'tour.publish',
      });
    });
    expect(window.location.search).toContain('action=tour.publish');

    fireEvent.change(entityTypeInput, { target: { value: 'Tour' } });
    fireEvent.keyDown(entityTypeInput, { key: 'Enter' });

    await waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalledWith({
        page: 1,
        action: 'tour.publish',
        entityType: 'Tour',
      });
    });
    expect(window.location.search).toContain('action=tour.publish');
    expect(window.location.search).toContain('entityType=Tour');

    fireEvent.change(fromInput, { target: { value: '2026-10-01' } });

    await waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalledWith({
        page: 1,
        action: 'tour.publish',
        entityType: 'Tour',
        from: '2026-10-01',
      });
    });
    expect(window.location.search).toContain('from=2026-10-01');

    fireEvent.change(toInput, { target: { value: '2026-10-31' } });

    await waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalledWith({
        page: 1,
        action: 'tour.publish',
        entityType: 'Tour',
        from: '2026-10-01',
        to: '2026-10-31',
      });
    });
    expect(window.location.search).toContain('to=2026-10-31');
  });

  it('remet la page à 1 lors d’un changement de filtre', async () => {
    vi.mocked(listAuditLogs).mockResolvedValue(page2Response);
    window.history.replaceState(null, '', '/audit?page=2');

    render(<AuditPage />);

    await within(await screen.findByRole('table')).findByText('entity.delete');
    expect(listAuditLogs).toHaveBeenCalledWith({ page: 2 });

    const actionSelect = screen.getByTestId('audit-filter-action');
    fireEvent.change(actionSelect, { target: { value: 'tour.publish' } });

    await waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalledWith({
        page: 1,
        action: 'tour.publish',
      });
    });
    expect(window.location.search).toContain('action=tour.publish');
    expect(window.location.search).not.toContain('page=2');
  });

  it('met à jour le filtre entityType lors du blur du champ texte', async () => {
    vi.mocked(listAuditLogs).mockResolvedValue(page2Response);
    window.history.replaceState(null, '', '/audit?page=2');

    render(<AuditPage />);

    await within(await screen.findByRole('table')).findByText('entity.delete');

    const entityTypeInput = screen.getByTestId('audit-filter-entity-type');
    fireEvent.change(entityTypeInput, { target: { value: 'Kiosk' } });
    fireEvent.blur(entityTypeInput);

    await waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalledWith({
        page: 1,
        entityType: 'Kiosk',
      });
    });
    expect(window.location.search).toContain('entityType=Kiosk');
    expect(window.location.search).not.toContain('page=2');
  });

  it('initialise les filtres depuis les paramètres de l’URL', async () => {
    vi.mocked(listAuditLogs).mockResolvedValue(defaultResponse);
    window.history.replaceState(
      null,
      '',
      '/audit?page=1&action=tour.publish&entityType=Tour&from=2026-10-01&to=2026-10-31',
    );

    render(<AuditPage />);

    await screen.findByRole('table');

    expect(listAuditLogs).toHaveBeenCalledWith({
      page: 1,
      action: 'tour.publish',
      entityType: 'Tour',
      from: '2026-10-01',
      to: '2026-10-31',
    });

    const actionSelect = screen.getByTestId('audit-filter-action');
    const entityTypeInput = screen.getByTestId('audit-filter-entity-type');
    const fromInput = screen.getByTestId('audit-filter-from');
    const toInput = screen.getByTestId('audit-filter-to');

    if (actionSelect instanceof HTMLSelectElement) {
      expect(actionSelect.value).toBe('tour.publish');
    } else {
      throw new Error('actionSelect is not an HTMLSelectElement');
    }
    if (entityTypeInput instanceof HTMLInputElement) {
      expect(entityTypeInput.value).toBe('Tour');
    } else {
      throw new Error('entityTypeInput is not an HTMLInputElement');
    }
    if (fromInput instanceof HTMLInputElement) {
      expect(fromInput.value).toBe('2026-10-01');
    } else {
      throw new Error('fromInput is not an HTMLInputElement');
    }
    if (toInput instanceof HTMLInputElement) {
      expect(toInput.value).toBe('2026-10-31');
    } else {
      throw new Error('toInput is not an HTMLInputElement');
    }
  });
});
