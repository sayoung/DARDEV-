import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import {
  AdminUserSchema,
  PaginatedAdminUsersResponseSchema,
  Role,
  type AdminUser,
  type PaginatedAdminUsersResponse,
} from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listUsers } from '../api/users.js';
import { i18n } from '../i18n.js';
import { UsersPage } from './UsersPage.js';

vi.mock('../api/users.js', () => ({
  listUsers: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  setUserHotels: vi.fn(),
}));

const mockUser1: AdminUser = AdminUserSchema.parse({
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d01',
  email: 'alice@xplor.test',
  name: 'Alice Martin',
  role: Role.ADMIN,
  active: true,
  totpEnabled: true,
  lastLoginAt: '2026-11-01T14:30:00.000Z',
  uiLang: 'fr',
  hotelIds: [
    '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d11',
    '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d12',
  ],
});

const mockUser2: AdminUser = AdminUserSchema.parse({
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d02',
  email: 'karim@xplor.test',
  name: 'Karim Idrissi',
  role: Role.HOTEL_MANAGER,
  active: false,
  totpEnabled: false,
  lastLoginAt: null,
  uiLang: 'fr',
  hotelIds: [],
});

const defaultResponse: PaginatedAdminUsersResponse =
  PaginatedAdminUsersResponseSchema.parse({
    items: [mockUser1, mockUser2],
    total: 2,
    page: 1,
    pageSize: 20,
  });

describe('UsersPage', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.history.replaceState(null, '', '/users');
    await i18n.changeLanguage('fr');
    vi.mocked(listUsers).mockReset();
    vi.mocked(listUsers).mockResolvedValue(defaultResponse);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('rend les colonnes et les lignes de données des utilisateurs', async () => {
    render(<UsersPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: resources.fr.page.users.title }),
    ).toBeDefined();

    const table = await screen.findByRole('table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (thead === null || tbody === null) {
      throw new Error('Table thead or tbody not found');
    }

    const theadScope = within(thead);
    const tbodyScope = within(tbody);

    expect(tbodyScope.getByText('Alice Martin')).toBeDefined();
    expect(tbodyScope.getByText('alice@xplor.test')).toBeDefined();
    expect(tbodyScope.getByText(resources.fr.auth.role.ADMIN)).toBeDefined();
    expect(tbodyScope.getByText(resources.fr.page.users.status.active)).toBeDefined();
    expect(tbodyScope.getByText(resources.fr.page.users.twoFactor.enabled)).toBeDefined();
    expect(
      tbodyScope.getByText(
        new Date('2026-11-01T14:30:00.000Z').toLocaleString('fr'),
      ),
    ).toBeDefined();
    expect(tbodyScope.getByText('2')).toBeDefined();

    expect(tbodyScope.getByText('Karim Idrissi')).toBeDefined();
    expect(tbodyScope.getByText('karim@xplor.test')).toBeDefined();
    expect(tbodyScope.getByText(resources.fr.auth.role.HOTEL_MANAGER)).toBeDefined();
    expect(tbodyScope.getByText(resources.fr.page.users.status.inactive)).toBeDefined();
    expect(tbodyScope.getByText(resources.fr.page.users.twoFactor.disabled)).toBeDefined();
    expect(tbodyScope.getByText(resources.fr.page.users.never)).toBeDefined();
    expect(tbodyScope.getByText('0')).toBeDefined();

    expect(theadScope.getByText(resources.fr.page.users.columns.name)).toBeDefined();
    expect(theadScope.getByText(resources.fr.page.users.columns.email)).toBeDefined();
    expect(theadScope.getByText(resources.fr.page.users.columns.role)).toBeDefined();
    expect(theadScope.getByText(resources.fr.page.users.columns.active)).toBeDefined();
    expect(theadScope.getByText(resources.fr.page.users.columns.twoFactor)).toBeDefined();
    expect(theadScope.getByText(resources.fr.page.users.columns.lastLogin)).toBeDefined();
    expect(theadScope.getByText(resources.fr.page.users.columns.hotels)).toBeDefined();

    expect(listUsers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      role: undefined,
      active: undefined,
      q: undefined,
    });
  });

  it('affiche un lien vers la fiche de chaque utilisateur dans chaque ligne et navigue au clic', async () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    render(<UsersPage />);

    const linkAlice = await screen.findByRole('link', { name: 'Alice Martin' });
    expect(linkAlice.getAttribute('href')).toBe(`/users/${mockUser1.id}`);

    const linkKarim = screen.getByRole('link', { name: 'Karim Idrissi' });
    expect(linkKarim.getAttribute('href')).toBe(`/users/${mockUser2.id}`);

    fireEvent.click(linkAlice);
    expect(pushStateSpy).toHaveBeenCalledWith(null, '', `/users/${mockUser1.id}`);
    pushStateSpy.mockRestore();
  });

  it('filtre par rôle et relance listUsers avec role', async () => {
    render(<UsersPage />);

    await screen.findByText('Alice Martin');
    expect(listUsers).toHaveBeenCalledTimes(1);

    const roleSelect = screen.getByLabelText(resources.fr.page.users.filters.role);
    fireEvent.change(roleSelect, { target: { value: Role.ADMIN } });

    await waitFor(() => {
      expect(listUsers).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        role: Role.ADMIN,
        active: undefined,
        q: undefined,
      });
    });

    expect(window.location.search).toContain('role=ADMIN');

    fireEvent.change(roleSelect, { target: { value: '' } });

    await waitFor(() => {
      expect(listUsers).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        role: undefined,
        active: undefined,
        q: undefined,
      });
    });

    expect(window.location.search).not.toContain('role=');
  });

  it('filtre par statut actif et relance listUsers avec active', async () => {
    render(<UsersPage />);

    await screen.findByText('Alice Martin');

    const statusSelect = screen.getByLabelText(resources.fr.page.users.filters.status);
    fireEvent.change(statusSelect, { target: { value: 'true' } });

    await waitFor(() => {
      expect(listUsers).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        role: undefined,
        active: true,
        q: undefined,
      });
    });

    expect(window.location.search).toContain('active=true');

    fireEvent.change(statusSelect, { target: { value: 'false' } });

    await waitFor(() => {
      expect(listUsers).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        role: undefined,
        active: false,
        q: undefined,
      });
    });
  });

  it('recherche par q et relance listUsers avec q', async () => {
    render(<UsersPage />);

    await screen.findByText('Alice Martin');

    const searchInput = screen.getByLabelText(resources.fr.page.users.filters.search);
    const submitButton = screen.getByRole('button', {
      name: resources.fr.page.users.filters.submit,
    });

    fireEvent.change(searchInput, { target: { value: 'alice' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(listUsers).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        role: undefined,
        active: undefined,
        q: 'alice',
      });
    });

    expect(window.location.search).toContain('q=alice');
  });

  it('gère la pagination précédent / suivant et met à jour l’URL', async () => {
    const page1Response: PaginatedAdminUsersResponse =
      PaginatedAdminUsersResponseSchema.parse({
        items: [mockUser1],
        total: 35,
        page: 1,
        pageSize: 20,
      });

    const page2Response: PaginatedAdminUsersResponse =
      PaginatedAdminUsersResponseSchema.parse({
        items: [mockUser2],
        total: 35,
        page: 2,
        pageSize: 20,
      });

    vi.mocked(listUsers).mockResolvedValueOnce(page1Response);

    render(<UsersPage />);

    await screen.findByText('Alice Martin');

    const prevButton = screen.getByRole('button', {
      name: resources.fr.page.users.pagination.prev,
    });
    const nextButton = screen.getByRole('button', {
      name: resources.fr.page.users.pagination.next,
    });

    expect(prevButton.hasAttribute('disabled')).toBe(true);
    expect(nextButton.hasAttribute('disabled')).toBe(false);

    expect(screen.getByText('Page 1 sur 2')).toBeDefined();

    vi.mocked(listUsers).mockResolvedValueOnce(page2Response);
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(listUsers).toHaveBeenCalledWith({
        page: 2,
        pageSize: 20,
        role: undefined,
        active: undefined,
        q: undefined,
      });
    });

    expect(window.location.search).toContain('page=2');
    await screen.findByText('Karim Idrissi');

    const prevButtonOnPage2 = screen.getByRole('button', {
      name: resources.fr.page.users.pagination.prev,
    });
    const nextButtonOnPage2 = screen.getByRole('button', {
      name: resources.fr.page.users.pagination.next,
    });

    expect(prevButtonOnPage2.hasAttribute('disabled')).toBe(false);
    expect(nextButtonOnPage2.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Page 2 sur 2')).toBeDefined();

    vi.mocked(listUsers).mockResolvedValueOnce(page1Response);
    fireEvent.click(prevButtonOnPage2);

    await waitFor(() => {
      expect(window.location.search).toContain('page=1');
      expect(listUsers).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 20,
        role: undefined,
        active: undefined,
        q: undefined,
      });
    });
  });

  it('affiche l’état vide lorsqu’aucun utilisateur n’est trouvé', async () => {
    const emptyResponse: PaginatedAdminUsersResponse =
      PaginatedAdminUsersResponseSchema.parse({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

    vi.mocked(listUsers).mockResolvedValue(emptyResponse);

    render(<UsersPage />);

    expect(await screen.findByText(resources.fr.page.users.empty)).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('affiche l’état de chargement pendant l’appel API et désactive les filtres', () => {
    vi.mocked(listUsers).mockReturnValue(new Promise(() => {}));

    render(<UsersPage />);

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText(resources.fr.common.loading)).toBeDefined();

    const roleSelect = screen.getByLabelText(resources.fr.page.users.filters.role);
    const statusSelect = screen.getByLabelText(resources.fr.page.users.filters.status);
    const searchInput = screen.getByLabelText(resources.fr.page.users.filters.search);
    const submitButton = screen.getByRole('button', {
      name: resources.fr.page.users.filters.submit,
    });

    expect(roleSelect.hasAttribute('disabled')).toBe(true);
    expect(statusSelect.hasAttribute('disabled')).toBe(true);
    expect(searchInput.hasAttribute('disabled')).toBe(true);
    expect(submitButton.hasAttribute('disabled')).toBe(true);
  });

  it('affiche l’état d’erreur lorsque listUsers échoue', async () => {
    vi.mocked(listUsers).mockRejectedValue(new Error('Network error'));

    render(<UsersPage />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(resources.fr.page.users.loadError);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('initialise les filtres depuis les paramètres d’URL', async () => {
    window.history.replaceState(
      null,
      '',
      '/users?role=HOTEL_MANAGER&active=true&q=karim&page=2',
    );

    render(<UsersPage />);

    await waitFor(() => {
      expect(listUsers).toHaveBeenCalledWith({
        page: 2,
        pageSize: 20,
        role: Role.HOTEL_MANAGER,
        active: true,
        q: 'karim',
      });
    });

    const roleSelect = screen.getByLabelText(
      resources.fr.page.users.filters.role,
    );
    const statusSelect = screen.getByLabelText(
      resources.fr.page.users.filters.status,
    );
    const searchInput = screen.getByLabelText(
      resources.fr.page.users.filters.search,
    );

    if (roleSelect instanceof HTMLSelectElement) {
      expect(roleSelect.value).toBe(Role.HOTEL_MANAGER);
    } else {
      throw new Error('roleSelect is not an HTMLSelectElement');
    }

    if (statusSelect instanceof HTMLSelectElement) {
      expect(statusSelect.value).toBe('true');
    } else {
      throw new Error('statusSelect is not an HTMLSelectElement');
    }

    if (searchInput instanceof HTMLInputElement) {
      expect(searchInput.value).toBe('karim');
    } else {
      throw new Error('searchInput is not an HTMLInputElement');
    }
  });
});
