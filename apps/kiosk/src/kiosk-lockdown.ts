/**
 * Verrouillage de sécurité de l'application kiosque Xplor (M5 F-60).
 *
 * En mode plein écran (Chrome --kiosk) :
 * - Bloque l'événement contextmenu sur le document (empêche le menu contextuel navigateur).
 * - Bloque l'événement dragstart sur le document (empêche le glisser-déposer de textes, images ou liens).
 * - Intercepte les clics sur les liens externes (a[href^=http]) via preventDefault pour interdire la sortie vers le web.
 */

export interface KioskLockdownInstance {
  dispose(): void;
}

/**
 * Détermine si la cible de l'événement pointe vers un lien externe (a[href^=http]).
 */
export function isExternalLinkElement(target: EventTarget | null): boolean {
  if (target === null) {
    return false;
  }
  let currentElement: Element | null = null;
  if (target instanceof Element) {
    currentElement = target;
  } else if (target instanceof Node) {
    currentElement = target.parentElement;
  }
  if (currentElement === null) {
    return false;
  }

  // Vérifie d'abord via le sélecteur d'attribut préfixé a[href^=http] (spécifié par F-60)
  if (currentElement.closest('a[href^="http"], a[href^="HTTP"]') !== null) {
    return true;
  }

  // Vérifie également l'attribut href de l'ancre le cas échéant
  const anchor = currentElement.closest('a');
  if (anchor !== null) {
    const href = anchor.getAttribute('href');
    if (typeof href === 'string') {
      const trimmed = href.trim().toLowerCase();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Installe les écouteurs de verrouillage sur le document du kiosque.
 */
export function installKioskLockdown(doc: Document): KioskLockdownInstance {
  const handleContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  const handleDragStart = (event: Event): void => {
    event.preventDefault();
  };

  const handleClick = (event: Event): void => {
    if (isExternalLinkElement(event.target)) {
      event.preventDefault();
    }
  };

  doc.addEventListener('contextmenu', handleContextMenu);
  doc.addEventListener('dragstart', handleDragStart);
  doc.addEventListener('click', handleClick);
  doc.addEventListener('auxclick', handleClick);

  let disposed = false;

  return {
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      doc.removeEventListener('contextmenu', handleContextMenu);
      doc.removeEventListener('dragstart', handleDragStart);
      doc.removeEventListener('click', handleClick);
      doc.removeEventListener('auxclick', handleClick);
    },
  };
}
