/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountVrButton } from './vr-button.js';
import { isVrSupported } from './vr-support.js';

describe('mountVrButton (M6 F-70, F-73)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
  });

  it('monte le bouton dans le DOM si supported() résout à true', async () => {
    const onClick = vi.fn();
    const handle = await mountVrButton(container, {
      label: 'Vivre en VR',
      supported: () => Promise.resolve(true),
      onClick,
    });

    expect(container.children.length).toBe(1);
    const button = container.querySelector('button');
    expect(button).toBeInstanceOf(HTMLButtonElement);

    if (button instanceof HTMLButtonElement) {
      expect(button.className).toBe('xplor-vr-button');
      expect(button.type).toBe('button');
      expect(button.textContent).toBe('Vivre en VR');
      expect(button.getAttribute('aria-label')).toBe('Vivre en VR');

      button.click();
      expect(onClick).toHaveBeenCalledTimes(1);

      button.click();
      expect(onClick).toHaveBeenCalledTimes(2);
    }

    handle.destroy();
    expect(container.children.length).toBe(0);
  });

  it("utilise le libellé fourni par l'appelant sans chaîne en dur", async () => {
    const handle1 = await mountVrButton(container, {
      label: 'Entrer dans la réalité virtuelle',
      supported: () => Promise.resolve(true),
      onClick: () => {},
    });

    const button1 = container.querySelector('button');
    expect(button1).toBeInstanceOf(HTMLButtonElement);
    if (button1 instanceof HTMLButtonElement) {
      expect(button1.textContent).toBe('Entrer dans la réalité virtuelle');
      expect(button1.getAttribute('aria-label')).toBe(
        'Entrer dans la réalité virtuelle',
      );
    }
    handle1.destroy();

    const handle2 = await mountVrButton(container, {
      label: 'Enter VR',
      supported: () => Promise.resolve(true),
      onClick: () => {},
    });

    const button2 = container.querySelector('button');
    expect(button2).toBeInstanceOf(HTMLButtonElement);
    if (button2 instanceof HTMLButtonElement) {
      expect(button2.textContent).toBe('Enter VR');
      expect(button2.getAttribute('aria-label')).toBe('Enter VR');
    }
    handle2.destroy();
  });

  it("n'ajoute rien au DOM si supported() résout à false et ne lève aucune erreur", async () => {
    const onClick = vi.fn();
    const handle = await mountVrButton(container, {
      label: 'Vivre en VR',
      supported: () => Promise.resolve(false),
      onClick,
    });

    expect(container.children.length).toBe(0);
    expect(container.querySelector('.xplor-vr-button')).toBeNull();
    expect(onClick).not.toHaveBeenCalled();

    // destroy() sur une session non supportée est un no-op sans erreur
    expect(() => {
      handle.destroy();
    }).not.toThrow();
  });

  it("n'ajoute rien au DOM et ne propage aucune erreur si supported() est rejetée", async () => {
    const onClick = vi.fn();
    const handle = await mountVrButton(container, {
      label: 'Vivre en VR',
      supported: () => Promise.reject(new Error('WebXR device error')),
      onClick,
    });

    expect(container.children.length).toBe(0);
    expect(container.querySelector('.xplor-vr-button')).toBeNull();
    expect(onClick).not.toHaveBeenCalled();

    expect(() => {
      handle.destroy();
    }).not.toThrow();
  });

  it("n'ajoute rien au DOM si supported() lève une exception synchrone", async () => {
    const handle = await mountVrButton(container, {
      label: 'Vivre en VR',
      supported: () => {
        throw new Error('Sync failure');
      },
      onClick: () => {},
    });

    expect(container.children.length).toBe(0);
    expect(() => {
      handle.destroy();
    }).not.toThrow();
  });

  it('destroy() retire le bouton et est idempotent', async () => {
    const onClick = vi.fn();
    const handle = await mountVrButton(container, {
      label: 'Vivre en VR',
      supported: () => Promise.resolve(true),
      onClick,
    });

    const button = container.querySelector('button');
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(container.contains(button)).toBe(true);

    // Premier appel à destroy() : retire le bouton du conteneur
    handle.destroy();
    expect(container.contains(button)).toBe(false);
    expect(container.children.length).toBe(0);

    // Appels successifs : idempotence totale, aucune exception
    expect(() => {
      handle.destroy();
    }).not.toThrow();
    expect(() => {
      handle.destroy();
    }).not.toThrow();
    expect(container.children.length).toBe(0);

    // Le listener a été détaché : cliquer sur le bouton détaché ne déclenche plus onClick
    if (button instanceof HTMLButtonElement) {
      button.click();
      expect(onClick).not.toHaveBeenCalled();
    }
  });

  it('conserve les éléments déjà présents dans le conteneur lors du montage et du destroy', async () => {
    const existingElement = document.createElement('span');
    existingElement.textContent = 'Contenu existant';
    container.appendChild(existingElement);

    const handle = await mountVrButton(container, {
      label: 'Vivre en VR',
      supported: () => Promise.resolve(true),
      onClick: () => {},
    });

    expect(container.children.length).toBe(2);
    expect(container.firstElementChild).toBe(existingElement);

    const button = container.querySelector('.xplor-vr-button');
    expect(button).not.toBeNull();

    handle.destroy();
    expect(container.children.length).toBe(1);
    expect(container.firstElementChild).toBe(existingElement);
    expect(container.querySelector('.xplor-vr-button')).toBeNull();
  });

  it('fonctionne en synergie avec isVrSupported()', async () => {
    const supportedNav = {
      xr: {
        isSessionSupported: (mode: string) =>
          Promise.resolve(mode === 'immersive-vr'),
      },
    };

    const handleSupported = await mountVrButton(container, {
      label: 'Vivre en VR',
      supported: () => isVrSupported(supportedNav),
      onClick: () => {},
    });

    expect(container.children.length).toBe(1);
    handleSupported.destroy();
    expect(container.children.length).toBe(0);

    const unsupportedNav = {
      xr: {
        isSessionSupported: () => Promise.resolve(false),
      },
    };

    const handleUnsupported = await mountVrButton(container, {
      label: 'Vivre en VR',
      supported: () => isVrSupported(unsupportedNav),
      onClick: () => {},
    });

    expect(container.children.length).toBe(0);
    handleUnsupported.destroy();
  });
});
