/**
 * Bouton d'entrée en VR WebXR (M6 F-70, F-73).
 */

export interface VrButtonOptions {
  /**
   * Libellé accessible affiché sur le bouton.
   */
  label: string;

  /**
   * Fonction asynchrone vérifiant la prise en charge WebXR / VR.
   */
  supported: () => Promise<boolean>;

  /**
   * Callback déclenché au clic sur le bouton.
   */
  onClick: () => void;
}

export interface VrButtonHandle {
  /**
   * Retire le bouton du DOM et détache les écouteurs d'événements.
   * Cet appel est idempotent.
   */
  destroy(): void;
}

/**
 * Monte un bouton d'accès au mode VR dans le conteneur spécifié (M6 F-70).
 *
 * Le bouton `<button class="xplor-vr-button">` n'est ajouté au DOM que si `supported()`
 * résout à `true` (F-73 : sinon rien n'est affiché et aucune erreur n'est levée,
 * y compris si `supported()` est rejetée).
 *
 * @param container Conteneur HTML hôte dans lequel insérer le bouton.
 * @param opts Options de configuration (libellé, détection, callback de clic).
 * @returns Une promesse résolue avec l'instance contenant la méthode `destroy()`.
 */
export async function mountVrButton(
  container: HTMLElement,
  opts: VrButtonOptions,
): Promise<VrButtonHandle> {
  let isSupported = false;
  try {
    isSupported = await opts.supported();
  } catch {
    isSupported = false;
  }

  if (!isSupported) {
    return {
      destroy: () => {},
    };
  }

  const doc = container.ownerDocument;
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'xplor-vr-button';
  button.textContent = opts.label;
  button.setAttribute('aria-label', opts.label);

  const handleClick = (): void => {
    opts.onClick();
  };

  button.addEventListener('click', handleClick);
  container.appendChild(button);

  let destroyed = false;
  return {
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      button.removeEventListener('click', handleClick);
      button.remove();
    },
  };
}
