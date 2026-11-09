import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import {
  AdminUserSchema,
  ContractType,
  HotelResponseSchema,
  HotelStars,
  Role,
  type AdminUser,
  type HotelListResponse,
  type HotelResponse,
} from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client.js';
import { listHotels } from '../api/hotels.js';
import { getUser, setUserHotels, updateUser } from '../api/users.js';
import { i18n } from '../i18n.js';
import { UserDetailPage } from './UserDetailPage.js';

vi.mock('../api/hotels.js', () => ({
  listHotels: vi.fn(),
  getHotelSelection: vi.fn(),
  saveHotelSelection: vi.fn(),
}));

vi.mock('../api/users.js', () => ({
  listUsers: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  setUserHotels: vi.fn(),
}));

const hotelAtlas: HotelResponse = HotelResponseSchema.parse({
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d10',
  name: 'Hôtel Atlas Marrakech',
  stars: HotelStars.FIVE,
  cityId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d20',
  address: 'Boulevard Mohammed V',
  phone: '+212522000000',
  email: 'contact@atlas.test',
  brandColor: '#6958A5',
  contractType: ContractType.RENTAL,
  contractStart: '2026-01-01T00:00:00.000Z',
  contractEnd: '2027-01-01T00:00:00.000Z',
  active: true,
  languages: ['fr'],
  hasMaintenancePin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const hotelSahara: HotelResponse = HotelResponseSchema.parse({
  id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d11',
  name: 'Hôtel Sahara Agadir',
  stars: HotelStars.FOUR,
  cityId: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d20',
  address: 'Avenue Hassan II',
  phone: '+212522000001',
  email: 'contact@sahara.test',
  brandColor: '#6958A5',
  contractType: ContractType.SALE,
  contractStart: '2026-01-01T00:00:00.000Z',
  contractEnd: '2027-01-01T00:00:00.000Z',
  active: true,
  languages: ['fr', 'en'],
  hasMaintenancePin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const mockHotels: HotelListResponse = [hotelAtlas, hotelSahara];

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
    vi.mocked(setUserHotels).mockReset();
    vi.mocked(listHotels).mockReset();
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(listHotels).mockResolvedValue(mockHotels);
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

  it('la section hôtels est cachée pour un EDITOR et listHotels n est pas appelé', async () => {
    const editorUser: AdminUser = AdminUserSchema.parse({
      ...mockUser,
      id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d02',
      email: 'editor@xplor.test',
      name: 'Bob Editor',
      role: Role.EDITOR,
    });
    vi.mocked(getUser).mockResolvedValueOnce(editorUser);

    render(<UserDetailPage userId={editorUser.id} />);

    await screen.findByRole('heading', {
      level: 2,
      name: resources.fr.page.userDetail.title,
    });

    expect(screen.queryByText(resources.fr.page.userDetail.hotels.title)).toBeNull();
    expect(listHotels).not.toHaveBeenCalled();
  });

  it('pour un HOTEL_MANAGER, les cases sont pré-cochées d après hotelIds', async () => {
    const managerUser: AdminUser = AdminUserSchema.parse({
      ...mockUser,
      id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d03',
      email: 'manager@xplor.test',
      name: 'Claire Manager',
      role: Role.HOTEL_MANAGER,
      hotelIds: [hotelAtlas.id],
    });
    vi.mocked(getUser).mockResolvedValueOnce(managerUser);
    vi.mocked(listHotels).mockResolvedValueOnce(mockHotels);

    render(<UserDetailPage userId={managerUser.id} />);

    await screen.findByRole('heading', {
      level: 2,
      name: resources.fr.page.userDetail.title,
    });

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: resources.fr.page.userDetail.hotels.title,
      }),
    ).toBeDefined();

    expect(listHotels).toHaveBeenCalledTimes(1);

    const hotel1Checkbox = await screen.findByLabelText(hotelAtlas.name);
    const hotel2Checkbox = await screen.findByLabelText(hotelSahara.name);

    if (
      hotel1Checkbox instanceof HTMLInputElement &&
      hotel2Checkbox instanceof HTMLInputElement
    ) {
      expect(hotel1Checkbox.checked).toBe(true);
      expect(hotel2Checkbox.checked).toBe(false);
    } else {
      throw new Error('Checkboxes are not HTMLInputElements');
    }
  });

  it('cocher et décocher puis cliquer Enregistrer les hôtels appelle setUserHotels avec la liste cochée et met à jour la fiche', async () => {
    const managerUser: AdminUser = AdminUserSchema.parse({
      ...mockUser,
      id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d03',
      email: 'manager@xplor.test',
      name: 'Claire Manager',
      role: Role.HOTEL_MANAGER,
      hotelIds: [hotelAtlas.id],
    });
    const updatedUser: AdminUser = AdminUserSchema.parse({
      ...managerUser,
      hotelIds: [hotelSahara.id],
    });

    vi.mocked(getUser).mockResolvedValueOnce(managerUser);
    vi.mocked(listHotels).mockResolvedValueOnce(mockHotels);
    vi.mocked(setUserHotels).mockResolvedValueOnce(updatedUser);

    render(<UserDetailPage userId={managerUser.id} />);

    await screen.findByRole('heading', {
      level: 3,
      name: resources.fr.page.userDetail.hotels.title,
    });

    const hotel1Checkbox = await screen.findByLabelText(hotelAtlas.name);
    const hotel2Checkbox = await screen.findByLabelText(hotelSahara.name);

    // Décocher hotel 1
    fireEvent.click(hotel1Checkbox);
    // Cocher hotel 2
    fireEvent.click(hotel2Checkbox);

    if (
      hotel1Checkbox instanceof HTMLInputElement &&
      hotel2Checkbox instanceof HTMLInputElement
    ) {
      expect(hotel1Checkbox.checked).toBe(false);
      expect(hotel2Checkbox.checked).toBe(true);
    } else {
      throw new Error('Checkboxes are not HTMLInputElements');
    }

    const saveHotelsBtn = screen.getByRole('button', {
      name: resources.fr.page.userDetail.hotels.actions.save,
    });
    fireEvent.click(saveHotelsBtn);

    await waitFor(() => {
      expect(setUserHotels).toHaveBeenCalledWith(managerUser.id, [hotelSahara.id]);
    });

    expect(
      await screen.findByText(resources.fr.page.userDetail.hotels.saveSuccess),
    ).toBeDefined();

    if (
      hotel1Checkbox instanceof HTMLInputElement &&
      hotel2Checkbox instanceof HTMLInputElement
    ) {
      expect(hotel1Checkbox.checked).toBe(false);
      expect(hotel2Checkbox.checked).toBe(true);
    } else {
      throw new Error('Checkboxes are not HTMLInputElements');
    }
  });

  it('affiche le message traduit de rôle incompatible lors d une ApiError 422', async () => {
    const managerUser: AdminUser = AdminUserSchema.parse({
      ...mockUser,
      id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d03',
      email: 'manager@xplor.test',
      name: 'Claire Manager',
      role: Role.HOTEL_MANAGER,
      hotelIds: [hotelAtlas.id],
    });

    vi.mocked(getUser).mockResolvedValueOnce(managerUser);
    vi.mocked(listHotels).mockResolvedValueOnce(mockHotels);
    vi.mocked(setUserHotels).mockRejectedValueOnce(
      new ApiError(422, 'UNPROCESSABLE_ENTITY', undefined, 'Rôle incompatible'),
    );

    render(<UserDetailPage userId={managerUser.id} />);

    await screen.findByRole('heading', {
      level: 3,
      name: resources.fr.page.userDetail.hotels.title,
    });

    const saveHotelsBtn = screen.getByRole('button', {
      name: resources.fr.page.userDetail.hotels.actions.save,
    });
    fireEvent.click(saveHotelsBtn);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      resources.fr.page.userDetail.hotels.errorIncompatibleRole,
    );
  });

  it('affiche le message traduit d hôtel inconnu lors d une ApiError 400', async () => {
    const managerUser: AdminUser = AdminUserSchema.parse({
      ...mockUser,
      id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d03',
      email: 'manager@xplor.test',
      name: 'Claire Manager',
      role: Role.HOTEL_MANAGER,
      hotelIds: [hotelAtlas.id],
    });

    vi.mocked(getUser).mockResolvedValueOnce(managerUser);
    vi.mocked(listHotels).mockResolvedValueOnce(mockHotels);
    vi.mocked(setUserHotels).mockRejectedValueOnce(
      new ApiError(400, 'BAD_REQUEST', undefined, 'Hôtel inconnu'),
    );

    render(<UserDetailPage userId={managerUser.id} />);

    await screen.findByRole('heading', {
      level: 3,
      name: resources.fr.page.userDetail.hotels.title,
    });

    const saveHotelsBtn = screen.getByRole('button', {
      name: resources.fr.page.userDetail.hotels.actions.save,
    });
    fireEvent.click(saveHotelsBtn);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      resources.fr.page.userDetail.hotels.errorUnknownHotel,
    );
  });

  it('désactive le bouton Enregistrer les hôtels pendant la soumission (anti-double envoi)', async () => {
    const managerUser: AdminUser = AdminUserSchema.parse({
      ...mockUser,
      id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d03',
      role: Role.HOTEL_MANAGER,
      hotelIds: [],
    });
    let resolveSetHotels: (user: AdminUser) => void = () => {};
    const pendingPromise = new Promise<AdminUser>((resolve) => {
      resolveSetHotels = resolve;
    });

    vi.mocked(getUser).mockResolvedValueOnce(managerUser);
    vi.mocked(listHotels).mockResolvedValueOnce(mockHotels);
    vi.mocked(setUserHotels).mockReturnValueOnce(pendingPromise);

    render(<UserDetailPage userId={managerUser.id} />);

    await screen.findByRole('heading', {
      level: 3,
      name: resources.fr.page.userDetail.hotels.title,
    });

    const saveHotelsBtn = screen.getByRole('button', {
      name: resources.fr.page.userDetail.hotels.actions.save,
    });
    fireEvent.click(saveHotelsBtn);

    expect(
      (await screen.findByRole('button', {
        name: resources.fr.page.userDetail.hotels.actions.saving,
      })).hasAttribute('disabled'),
    ).toBe(true);

    resolveSetHotels(managerUser);

    await screen.findByText(resources.fr.page.userDetail.hotels.saveSuccess);
  });

  it('affiche une erreur de chargement lorsque listHotels échoue', async () => {
    const managerUser: AdminUser = AdminUserSchema.parse({
      ...mockUser,
      id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d03',
      role: Role.HOTEL_MANAGER,
      hotelIds: [],
    });
    vi.mocked(getUser).mockResolvedValueOnce(managerUser);
    vi.mocked(listHotels).mockRejectedValueOnce(new Error('Network error'));

    render(<UserDetailPage userId={managerUser.id} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      resources.fr.page.userDetail.hotels.loadError,
    );
  });
});
