import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import {
  MeResponseSchema,
  Role,
  TwoFactorSetupResponseSchema,
  type MeResponse,
  type TwoFactorSetupResponse,
} from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../App.js';
import { clearCsrfToken } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.js';
import { i18n } from '../i18n.js';

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();

function requestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return '';
}

function methodOf(input: unknown, init: unknown): string {
  if (typeof init === 'object' && init !== null && 'method' in init && typeof init.method === 'string') {
    return init.method.toUpperCase();
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

function bodyOf(init: unknown): string {
  if (typeof init === 'object' && init !== null && 'body' in init && typeof init.body === 'string') {
    return init.body;
  }
  return '';
}

function headerOf(init: unknown, name: string): string | null {
  if (typeof init === 'object' && init !== null && 'headers' in init) {
    const raw = init.headers;
    if (raw instanceof Headers) {
      return raw.get(name);
    }
    if (typeof raw === 'object' && raw !== null) {
      const target = name.toLowerCase();
      for (const [key, value] of Object.entries(raw)) {
        if (key.toLowerCase() === target && typeof value === 'string') {
          return value;
        }
      }
    }
  }
  return null;
}

function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const adminUser: MeResponse = MeResponseSchema.parse({
  id: 'user-admin-01',
  email: 'admin@xplor.test',
  name: 'Admin Test',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-admin-token-xyz',
  totpEnabled: false,
});

const adminUserWithTotp: MeResponse = MeResponseSchema.parse({
  id: 'user-admin-01',
  email: 'admin@xplor.test',
  name: 'Admin Test',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-admin-token-xyz',
  totpEnabled: true,
});

const editorUser: MeResponse = MeResponseSchema.parse({
  id: 'user-editor-01',
  email: 'editor@xplor.test',
  name: 'Editor Test',
  role: Role.EDITOR,
  uiLang: 'fr',
  csrfToken: 'csrf-editor-token-xyz',
  totpEnabled: false,
});

const setupData: TwoFactorSetupResponse = TwoFactorSetupResponseSchema.parse({
  secret: 'JBSWY3DPEHPK3PXP',
  otpauthUri: 'otpauth://totp/Xplor:admin@xplor.test?secret=JBSWY3DPEHPK3PXP&issuer=Xplor',
});

let capturedAuth: ReturnType<typeof useAuth> | null = null;

function AuthCapture() {
  capturedAuth = useAuth();
  return null;
}

describe('AccountSecurityPage (M8 F-90)', () => {
  beforeEach(async () => {
    capturedAuth = null;
    clearCsrfToken();
    localStorage.clear();
    window.history.replaceState(null, '', '/account/security?lang=fr');
    document.documentElement.setAttribute('lang', 'fr');
    document.documentElement.setAttribute('dir', 'ltr');
    await i18n.changeLanguage('fr');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('le QR et le secret s\'affichent après Activer', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (method === 'GET' && url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, adminUser));
      }
      if (method === 'POST' && url.endsWith('/auth/2fa/setup')) {
        return Promise.resolve(jsonResponse(200, setupData));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: resources.fr.page.accountSecurity.title })).toBeTruthy();
    expect(screen.getByText(resources.fr.page.accountSecurity.statusDisabled)).toBeTruthy();

    const activateButton = screen.getByRole('button', { name: resources.fr.auth.twoFactor.enable });
    expect(activateButton).toBeTruthy();

    fireEvent.click(activateButton);

    const setupCall = fetchMock.mock.calls.find((call) => {
      return requestUrl(call[0]).endsWith('/auth/2fa/setup');
    });
    expect(setupCall).toBeDefined();
    if (setupCall) {
      expect(methodOf(setupCall[0], setupCall[1])).toBe('POST');
      expect(headerOf(setupCall[1], 'X-CSRF-Token')).toBe(adminUser.csrfToken);
    }

    const qrImage = await screen.findByRole('img', { name: resources.fr.page.accountSecurity.qrAlt });
    expect(qrImage).toBeTruthy();
    const qrSrc = qrImage.getAttribute('src');
    expect(qrSrc?.startsWith('data:image/')).toBe(true);

    expect(screen.getByText(setupData.secret)).toBeTruthy();

    const codeInput = screen.getByLabelText(resources.fr.auth.twoFactor.code);
    expect(codeInput).toBeTruthy();

    const confirmButton = screen.getByRole('button', { name: resources.fr.page.accountSecurity.confirmButton });
    expect(confirmButton).toBeTruthy();
  });

  it('un code valide confirme la 2FA', async () => {
    let confirmCalled = false;

    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (method === 'GET' && url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, adminUser));
      }
      if (method === 'POST' && url.endsWith('/auth/2fa/setup')) {
        return Promise.resolve(jsonResponse(200, setupData));
      }
      if (method === 'POST' && url.endsWith('/auth/2fa/confirm')) {
        confirmCalled = true;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(
      <App>
        <AuthCapture />
      </App>,
    );

    const activateButton = await screen.findByRole('button', { name: resources.fr.auth.twoFactor.enable });
    fireEvent.click(activateButton);

    const codeInput = await screen.findByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(codeInput, { target: { value: '123456' } });

    const confirmButton = screen.getByRole('button', { name: resources.fr.page.accountSecurity.confirmButton });
    fireEvent.click(confirmButton);

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      resources.fr.page.accountSecurity.successEnabled,
    );

    expect(confirmCalled).toBe(true);
    const confirmCall = fetchMock.mock.calls.find((call) => {
      return requestUrl(call[0]).endsWith('/auth/2fa/confirm');
    });
    expect(confirmCall).toBeDefined();
    if (confirmCall) {
      expect(bodyOf(confirmCall[1])).toBe(JSON.stringify({ code: '123456' }));
      expect(headerOf(confirmCall[1], 'X-CSRF-Token')).toBe(adminUser.csrfToken);
    }

    expect(screen.getByText(resources.fr.page.accountSecurity.statusEnabled)).toBeTruthy();
    expect(screen.getByRole('button', { name: resources.fr.page.accountSecurity.disableButton })).toBeTruthy();

    await waitFor(() => {
      expect(capturedAuth?.state.status).toBe('authenticated');
      if (capturedAuth?.state.status === 'authenticated') {
        expect(capturedAuth.state.profile.totpEnabled).toBe(true);
      }
    });
  });

  it('pour un profil avec totpEnabled true, la page affiche directement la désactivation', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (method === 'GET' && url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, adminUserWithTotp));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(
      <App>
        <AuthCapture />
      </App>,
    );

    expect(
      await screen.findByRole('heading', { name: resources.fr.page.accountSecurity.title }),
    ).toBeTruthy();

    expect(screen.getByText(resources.fr.page.accountSecurity.statusEnabled)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: resources.fr.page.accountSecurity.disableButton }),
    ).toBeTruthy();
    expect(screen.getByLabelText(resources.fr.auth.twoFactor.code)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: resources.fr.auth.twoFactor.enable }),
    ).toBeNull();
    expect(
      screen.queryByRole('img', { name: resources.fr.page.accountSecurity.qrAlt }),
    ).toBeNull();

    if (capturedAuth !== null && capturedAuth.state.status === 'authenticated') {
      expect(capturedAuth.state.profile.totpEnabled).toBe(true);
    }
  });

  it('un code refusé affiche « Code invalide » lors de la confirmation', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (method === 'GET' && url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, adminUser));
      }
      if (method === 'POST' && url.endsWith('/auth/2fa/setup')) {
        return Promise.resolve(jsonResponse(200, setupData));
      }
      if (method === 'POST' && url.endsWith('/auth/2fa/confirm')) {
        return Promise.resolve(
          jsonResponse(400, {
            statusCode: 400,
            code: 'TWO_FACTOR_INVALID_CODE',
            message: 'TWO_FACTOR_INVALID_CODE',
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(<App />);

    const activateButton = await screen.findByRole('button', { name: resources.fr.auth.twoFactor.enable });
    fireEvent.click(activateButton);

    const codeInput = await screen.findByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(codeInput, { target: { value: '000000' } });

    const confirmButton = screen.getByRole('button', { name: resources.fr.page.accountSecurity.confirmButton });
    fireEvent.click(confirmButton);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.fr.auth.twoFactor.invalidCode);
  });

  it('la page est inaccessible à un EDITOR', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (method === 'GET' && url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, editorUser));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(<App />);

    expect(await screen.findByText(resources.fr.auth.accessDenied)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: resources.fr.page.accountSecurity.title })).toBeNull();
    expect(screen.queryByRole('button', { name: resources.fr.auth.twoFactor.enable })).toBeNull();

    const setupCalls = fetchMock.mock.calls.filter((call) => {
      return requestUrl(call[0]).endsWith('/auth/2fa/setup');
    });
    expect(setupCalls).toHaveLength(0);
  });

  it('désactive la 2FA après saisie d\'un code valide', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (method === 'GET' && url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, adminUser));
      }
      if (method === 'POST' && url.endsWith('/auth/2fa/setup')) {
        return Promise.resolve(jsonResponse(200, setupData));
      }
      if (method === 'POST' && url.endsWith('/auth/2fa/confirm')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (method === 'POST' && url.endsWith('/auth/2fa/disable')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(
      <App>
        <AuthCapture />
      </App>,
    );

    const activateButton = await screen.findByRole('button', { name: resources.fr.auth.twoFactor.enable });
    fireEvent.click(activateButton);

    const confirmInput = await screen.findByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(confirmInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: resources.fr.page.accountSecurity.confirmButton }));

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      resources.fr.page.accountSecurity.successEnabled,
    );

    await waitFor(() => {
      expect(capturedAuth?.state.status).toBe('authenticated');
      if (capturedAuth?.state.status === 'authenticated') {
        expect(capturedAuth.state.profile.totpEnabled).toBe(true);
      }
    });

    const disableInput = screen.getByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(disableInput, { target: { value: '654321' } });

    const disableButton = screen.getByRole('button', { name: resources.fr.page.accountSecurity.disableButton });
    fireEvent.click(disableButton);

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(
        resources.fr.page.accountSecurity.successDisabled,
      );
    });

    const disableCall = fetchMock.mock.calls.find((call) => {
      return requestUrl(call[0]).endsWith('/auth/2fa/disable');
    });
    expect(disableCall).toBeDefined();
    if (disableCall) {
      expect(bodyOf(disableCall[1])).toBe(JSON.stringify({ code: '654321' }));
      expect(headerOf(disableCall[1], 'X-CSRF-Token')).toBe(adminUser.csrfToken);
    }

    expect(screen.getByText(resources.fr.page.accountSecurity.statusDisabled)).toBeTruthy();
    expect(screen.getByRole('button', { name: resources.fr.auth.twoFactor.enable })).toBeTruthy();

    await waitFor(() => {
      expect(capturedAuth?.state.status).toBe('authenticated');
      if (capturedAuth?.state.status === 'authenticated') {
        expect(capturedAuth.state.profile.totpEnabled).toBe(false);
      }
    });
  });

  it('désactive la 2FA directement depuis un profil où elle est déjà activée', async () => {
    let disableCalled = false;
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (method === 'GET' && url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, adminUserWithTotp));
      }
      if (method === 'POST' && url.endsWith('/auth/2fa/disable')) {
        disableCalled = true;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(
      <App>
        <AuthCapture />
      </App>,
    );

    const disableButton = await screen.findByRole('button', {
      name: resources.fr.page.accountSecurity.disableButton,
    });
    const disableInput = screen.getByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(disableInput, { target: { value: '654321' } });
    fireEvent.click(disableButton);

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(
        resources.fr.page.accountSecurity.successDisabled,
      );
    });

    expect(disableCalled).toBe(true);
    expect(screen.getByText(resources.fr.page.accountSecurity.statusDisabled)).toBeTruthy();
    expect(screen.getByRole('button', { name: resources.fr.auth.twoFactor.enable })).toBeTruthy();

    await waitFor(() => {
      expect(capturedAuth?.state.status).toBe('authenticated');
      if (capturedAuth?.state.status === 'authenticated') {
        expect(capturedAuth.state.profile.totpEnabled).toBe(false);
      }
    });
  });

  it('un code refusé affiche « Code invalide » lors de la désactivation', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (method === 'GET' && url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, adminUser));
      }
      if (method === 'POST' && url.endsWith('/auth/2fa/setup')) {
        return Promise.resolve(jsonResponse(200, setupData));
      }
      if (method === 'POST' && url.endsWith('/auth/2fa/confirm')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (method === 'POST' && url.endsWith('/auth/2fa/disable')) {
        return Promise.resolve(
          jsonResponse(400, {
            statusCode: 400,
            code: 'TWO_FACTOR_INVALID_CODE',
            message: 'TWO_FACTOR_INVALID_CODE',
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(<App />);

    const activateButton = await screen.findByRole('button', { name: resources.fr.auth.twoFactor.enable });
    fireEvent.click(activateButton);

    const confirmInput = await screen.findByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(confirmInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: resources.fr.page.accountSecurity.confirmButton }));

    await screen.findByRole('button', { name: resources.fr.page.accountSecurity.disableButton });

    const disableInput = screen.getByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(disableInput, { target: { value: '999999' } });

    const disableButton = screen.getByRole('button', { name: resources.fr.page.accountSecurity.disableButton });
    fireEvent.click(disableButton);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.fr.auth.twoFactor.invalidCode);
  });

  it('gère l\'annulation du formulaire de configuration', async () => {
    fetchMock.mockImplementation((input: unknown, init?: unknown) => {
      const url = requestUrl(input);
      const method = methodOf(input, init);

      if (method === 'GET' && url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(200, adminUser));
      }
      if (method === 'POST' && url.endsWith('/auth/2fa/setup')) {
        return Promise.resolve(jsonResponse(200, setupData));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(<App />);

    const activateButton = await screen.findByRole('button', { name: resources.fr.auth.twoFactor.enable });
    fireEvent.click(activateButton);

    const cancelButton = await screen.findByRole('button', { name: resources.fr.page.accountSecurity.cancel });
    fireEvent.click(cancelButton);

    expect(screen.queryByRole('img', { name: resources.fr.page.accountSecurity.qrAlt })).toBeNull();
    expect(screen.getByRole('button', { name: resources.fr.auth.twoFactor.enable })).toBeTruthy();
  });
});
