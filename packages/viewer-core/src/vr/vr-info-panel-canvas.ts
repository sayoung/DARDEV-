/**
 * Rendu 2D du panneau d'information VR sur Canvas (M6 F-71).
 */

/**
 * Couleur de fond sombre semi-transparente par défaut (M6 F-71).
 */
export const DEFAULT_INFO_PANEL_BG = 'rgba(0, 0, 0, 0.85)';

/**
 * Couleur de texte par défaut (blanc pour contraste AA optimal sur fond sombre).
 */
export const DEFAULT_INFO_PANEL_TEXT_COLOR = '#ffffff';

/**
 * Typographie par défaut du panneau d'information (Montserrat, CHARTE_XPLOR).
 */
export const DEFAULT_INFO_PANEL_FONT = '24px Montserrat, sans-serif';

/**
 * Marge intérieure par défaut (en pixels).
 */
export const DEFAULT_INFO_PANEL_PADDING = 32;

/**
 * Interligne par défaut (en pixels).
 */
export const DEFAULT_INFO_PANEL_LINE_HEIGHT = 36;

/**
 * Sous-ensemble minimal du contexte 2D Canvas requis pour le rendu.
 * Ne dépend pas du DOM : peut être injecté avec un vrai CanvasRenderingContext2D
 * ou un simulateur en environnement Node.js / tests (M6 F-71).
 */
export type InfoPanelCanvasContext = Pick<
  CanvasRenderingContext2D,
  'fillRect' | 'fillText' | 'measureText'
> & {
  fillStyle: unknown;
  font: string;
  textAlign: string;
  direction?: string;
  textBaseline: string;
};

/**
 * Options de rendu du panneau d'information 2D en VR.
 */
export interface DrawInfoPanelOptions {
  width: number;
  height: number;
  rtl?: boolean;
  padding?: number;
  lineHeight?: number;
  font?: string;
  backgroundColor?: string;
  textColor?: string;
}

/**
 * Dessine un panneau d'information textuel pour l'espace 3D VR (M6 F-71).
 *
 * Fonction pure sans dépendance au DOM : le contexte Canvas 2D est injecté.
 *
 * Déroulement du dessin :
 * 1. Dessine un fond sombre semi-transparent couvrant l'intégralité du rectangle (en premier).
 * 2. Configure la typographie (couleur, police, textBaseline 'top').
 * 3. En mode RTL (`opts.rtl === true`), applique `textAlign = 'right'`, `direction = 'rtl'`
 *    et positionne l'ancre X à droite (`width - padding`).
 * 4. En mode LTR (`opts.rtl !== true`), applique `textAlign = 'left'`, `direction = 'ltr'`
 *    et positionne l'ancre X à gauche (`padding`).
 * 5. Dessine chaque ligne de texte successive avec la marge et l'interligne spécifiés.
 *
 * @param ctx Contexte 2D (réel ou simulé).
 * @param lines Lignes de texte déjà découpées (par exemple via wrapLines).
 * @param opts Dimensions du panneau et options d'alignement RTL.
 */
export function drawInfoPanel(
  ctx: Pick<CanvasRenderingContext2D, 'fillRect' | 'fillText' | 'measureText'> & {
    fillStyle: unknown;
    font: string;
    textAlign: string;
    direction?: string;
    textBaseline: string;
  },
  lines: string[],
  opts: DrawInfoPanelOptions,
): void {
  if (
    !Number.isFinite(opts.width) ||
    !Number.isFinite(opts.height) ||
    opts.width <= 0 ||
    opts.height <= 0
  ) {
    return;
  }

  // 1. Fond sombre semi-transparent dessiné en premier
  ctx.fillStyle = opts.backgroundColor ?? DEFAULT_INFO_PANEL_BG;
  ctx.fillRect(0, 0, opts.width, opts.height);

  // 2. Configuration typographique et d'alignement
  const padding =
    typeof opts.padding === 'number' && Number.isFinite(opts.padding) && opts.padding >= 0
      ? opts.padding
      : DEFAULT_INFO_PANEL_PADDING;

  const lineHeight =
    typeof opts.lineHeight === 'number' && Number.isFinite(opts.lineHeight) && opts.lineHeight > 0
      ? opts.lineHeight
      : DEFAULT_INFO_PANEL_LINE_HEIGHT;

  const isRtl = opts.rtl === true;

  ctx.fillStyle = opts.textColor ?? DEFAULT_INFO_PANEL_TEXT_COLOR;
  ctx.font = opts.font ?? DEFAULT_INFO_PANEL_FONT;
  ctx.textBaseline = 'top';
  ctx.textAlign = isRtl ? 'right' : 'left';
  ctx.direction = isRtl ? 'rtl' : 'ltr';

  // 3. Dessin des lignes de texte avec marge et interligne
  const x = isRtl ? opts.width - padding : padding;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (typeof line === 'string') {
      const y = padding + i * lineHeight;
      ctx.fillText(line, x, y);
    }
  }
}
