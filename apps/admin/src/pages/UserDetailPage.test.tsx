import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import {
  AdminUserSchema,
  Role,
  type AdminUser,
} from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client.js';
import { getUser, updateUser } from '../api/users.js';
import { i18n } from '../i18n.js';
import { UserDetailPage } from './UserDetailPage.js';

vi.mock('../api/users.js', () => ({
  listUsers: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  setUserHotels: vi.fn(),
}));

const mockUser: AdminUser = AdminUserSchema.parse({
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d01',
  email: 'alice@xplor.test',
  name: 'Alice Martin',
  role: Role.ADMIN,
  active: true,
  totpEnabled: true,
  lastLoginAt: '2026-11-01T14:30:00.000Z',
  uiLang: 'fr',
  hotelIds: [],
});

describe('UserDetailPage', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.history.replaceState(null, '', `/users/${mockUser.id}`);
    await i18n.changeLanguage('fr');
    vi.mocked(getUser).mockReset();
    vi.mocked(updateUser).mockReset();
    vi.mocked(getUser).mockResolvedValue(mockUser);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('charge la fiche utilisateur et affiche les informations dans le formulaire', async () => {
    render(<UserDetailPage userId={mockUser.id} />);

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText(resources.fr.common.loading)).toBeDefined();

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: resources.fr.page.userDetail.title,
      }),
    ).toBeDefined();

    const nameInput = screen.getByLabelText(resources.fr.page.userDetail.fields.name);
    if (nameInput instanceof HTMLInputElement) {
      expect(nameInput.value).toBe(mockUser.name);
    } else {
      throw new Error('nameInput is not an HTMLInputElement');
    }

    const emailInput = screen.getByLabelText(resources.fr.page.userDetail.fields.email);
    if (emailInput instanceof HTMLInputElement) {
      expect(emailInput.value).toBe(mockUser.email);
      expect(emailInput.hasAttribute('disabled')).toBe(true);
    } else {
      throw new Error('emailInput is not an HTMLInputElement');
    }

    const roleSelect = screen.getByLabelText(resources.fr.page.userDetail.fields.role);
    if (roleSelect instanceof HTMLSelectElement) {
      expect(roleSelect.value).toBe(Role.ADMIN);
    } else {
      throw new Error('roleSelect is not an HTMLSelectElement');
    }

    const switchBtn = screen.getByRole('switch');
    expect(switchBtn.getAttribute('aria-checked')).toBe('true');

    const uiLangSelect = screen.getByLabelText(resources.fr.page.userDetail.fields.uiLang);
    if (uiLangSelect instanceof HTMLSelectElement) {
      expect(uiLangSelect.value).toBe('fr');
    } else {
      throw new Error('uiLangSelect is not an HTMLSelectElement');
    }

    const submitBtn = screen.getByRole('button', {
      name: resources.fr.page.userDetail.actions.save,
    });
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    expect(getUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('affiche une erreur de chargement lorsque getUser échoue', async () => {
    vi.mocked(getUser).mockRejectedValueOnce(new Error('Network failure'));

    render(<UserDetailPage userId={mockUser.id} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(resources.fr.page.userDetail.loadError);
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('affiche une erreur lorsque l id de l utilisateur est manquant', async () => {
    window.history.replaceState(null, '', '/users');
    render(<UserDetailPage userId="" />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(resources.fr.page.userDetail.loadError);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('envoie uniquement le nom modifié lorsque seul le nom change', async () => {
    const updatedUser: AdminUser = AdminUserSchema.parse({
      ...mockUser,
      name: 'Alice Martin Smith',
    });
    vi.mocked(updateUser).mockResolvedValueOnce(updatedUser);

    render(<UserDetailPage userId={mockUser.id} />);

    await screen.findByRole('heading', {
      level: 2,
      name: resources.fr.page.userDetail.title,
    });

    const nameInput = screen.getByLabelText(resources.fr.page.userDetail.fields.name);
    const submitBtn = screen.getByRole('button', {
      name: resources.fr.page.userDetail.actions.save,
    });

    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.change(nameInput, { target: { value: 'Alice Martin Smith' } });

    expect(submitBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(mockUser.id, {
        name: 'Alice Martin Smith',
      });
    });

    expect(await screen.findByText(resources.fr.page.userDetail.saveSuccess)).toBeDefined();
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('envoie uniquement le rôle modifié lorsque seul le rôle change', async () => {
    const updatedUser: AdminUser = AdminUserSchema.parse({
      ...mockUser,
      role: Role.EDITOR,
    });
    vi.mocked(updateUser).mockResolvedValueOnce(updatedUser);

    render(<UserDetailPage userId={mockUser.id} />);

    await screen.findByRole('heading', {
      level: 2,
      name: resources.fr.page.userDetail.title,
    });

    const roleSelect = screen.getByLabelText(resources.fr.page.userDetail.fields.role);
    const submitBtn = screen.getByRole('button', {
      name: resources.fr.page.userDetail.actions.save,
    });

    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.change(roleSelect, { target: { value: Role.EDITOR } });

    expect(submitBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(mockUser.id, {
        role: Role.EDITOR,
      });
    });

    expect(await screen.findByText(resources.fr.page.userDetail.saveSuccess)).toBeDefined();
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('envoie uniquement le statut actif modifié lorsque seul le switch change', async () => {
    const updatedUser: AdminUser = AdminUserSchema.parse({
      ...mockUser,
      active: false,
    });
    vi.mocked(updateUser).mockResolvedValueOnce(updatedUser);

    render(<UserDetailPage userId={mockUser.id} />);

    await screen.findByRole('heading', {
      level: 2,
      name: resources.fr.page.userDetail.title,
    });

    const switchBtn = screen.getByRole('switch');
    const submitBtn = screen.getByRole('button', {
      name: resources.fr.page.userDetail.actions.save,
    });

    expect(submitBtn.hasAttribute('disabled')).toBe(true);
    expect(switchBtn.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(switchBtn);

    expect(switchBtn.getAttribute('aria-checked')).toBe('false');
    expect(submitBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(mockUser.id, {
        active: false,
      });
    });

    expect(await screen.findByText(resources.fr.page.userDetail.saveSuccess)).toBeDefined();
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('bascule l état actif en cliquant sur le libellé (un seul basculement)', async () => {
    render(<UserDetailPage userId={mockUser.id} />);

    await screen.findByRole('heading', {
      level: 2,
      name: resources.fr.page.userDetail.title,
    });

    const switchBtn = screen.getByRole('switch');
    expect(switchBtn.getAttribute('aria-checked')).toBe('true');

    const label = screen.getByText(resources.fr.page.userDetail.fields.active);
    fireEvent.click(label);

    expect(switchBtn.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(label);
    expect(switchBtn.getAttribute('aria-checked')).toBe('true');
  });

  it('envoie uniquement la langue d interface modifiée lorsque seule la langue change', async () => {
    const updatedUser: AdminUser = AdminUserSchema.parse({
      ...mockUser,
      uiLang: 'ar',
    });
    vi.mocked(updateUser).mockResolvedValueOnce(updatedUser);

    render(<UserDetailPage userId={mockUser.id} />);

    await screen.findByRole('heading', {
      level: 2,
      name: resources.fr.page.userDetail.title,
    });

    const uiLangSelect = screen.getByLabelText(resources.fr.page.userDetail.fields.uiLang);
    const submitBtn = screen.getByRole('button', {
      name: resources.fr.page.userDetail.actions.save,
    });

    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.change(uiLangSelect, { target: { value: 'ar' } });

    expect(submitBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(mockUser.id, {
        uiLang: 'ar',
      });
    });

    expect(await screen.findByText(resources.fr.page.userDetail.saveSuccess)).toBeDefined();
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('affiche le message traduit pour l erreur 403 (auto-modification interdite)', async () => {
    vi.mocked(updateUser).mockRejectedValueOnce(
      new ApiError(403, 'FORBIDDEN', undefined, 'Action interdite'),
    );

    render(<UserDetailPage userId={mockUser.id} />);

    await screen.findByRole('heading', {
      level: 2,
      name: resources.fr.page.userDetail.title,
    });

    const switchBtn = screen.getByRole('switch');
    fireEvent.click(switchBtn);

    const submitBtn = screen.getByRole('button', {
      name: resources.fr.page.userDetail.actions.save,
    });
    fireEvent.click(submitBtn);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      resources.fr.page.userDetail.errorSelfModification,
    );
  });

  it('affiche le message traduit pour l erreur 409 (dernier administrateur actif)', async () => {
    vi.mocked(updateUser).mockRejectedValueOnce(
      new ApiError(409, 'CONFLICT', undefined, 'Conflit dernier administrateur'),
    );

    render(<UserDetailPage userId={mockUser.id} />);

    await screen.findByRole('heading', {
      level: 2,
      name: resources.fr.page.userDetail.title,
    });

    const switchBtn = screen.getByRole('switch');
    fireEvent.click(switchBtn);

    const submitBtn = screen.getByRole('button', {
      name: resources.fr.page.userDetail.actions.save,
    });
    fireEvent.click(submitBtn);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      resources.fr.page.userDetail.errorLastAdmin,
    );
  });

  it('désactive le bouton pendant la soumission (anti-double envoi)', async () => {
    let resolveUpdate: (user: AdminUser) => void = () => {};
    const pendingPromise = new Promise<AdminUser>((resolve) => {
      resolveUpdate = resolve;
    });
    vi.mocked(updateUser).mockReturnValueOnce(pendingPromise);

    render(<UserDetailPage userId={mockUser.id} />);

    await screen.findByRole('heading', {
      level: 2,
      name: resources.fr.page.userDetail.title,
    });

    const nameInput = screen.getByLabelText(resources.fr.page.userDetail.fields.name);
    fireEvent.change(nameInput, { target: { value: 'Alice Enregistrement' } });

    const submitBtn = screen.getByRole('button', {
      name: resources.fr.page.userDetail.actions.save,
    });
    fireEvent.click(submitBtn);

    expect(
      screen.getByRole('button', {
        name: resources.fr.page.userDetail.actions.saving,
      }).hasAttribute('disabled'),
    ).toBe(true);

    const updatedUser: AdminUser = AdminUserSchema.parse({
      ...mockUser,
      name: 'Alice Enregistrement',
    });
    resolveUpdate(updatedUser);

    await screen.findByText(resources.fr.page.userDetail.saveSuccess);
  });

  it('le bouton retour navigue vers /users', async () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    render(<UserDetailPage userId={mockUser.id} />);

    await screen.findByRole('heading', {
      level: 2,
      name: resources.fr.page.userDetail.title,
    });

    const backBtn = screen.getByRole('button', {
      name: resources.fr.page.userDetail.actions.back,
    });
    fireEvent.click(backBtn);

    expect(pushStateSpy).toHaveBeenCalledWith(null, '', '/users');
    pushStateSpy.mockRestore();
  });

  it('charge l utilisateur depuis l URL lorsque userId n est pas fourni en prop', async () => {
    window.history.replaceState(null, '', `/users/${mockUser.id}`);
    render(<UserDetailPage />);

    await screen.findByRole('heading', {
      level: 2,
      name: resources.fr.page.userDetail.title,
    });
    expect(getUser).toHaveBeenCalledWith(mockUser.id);
  });
});
