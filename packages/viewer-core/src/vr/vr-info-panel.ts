/**
 * Dictionnaire de décodage des entités HTML courantes (M6 F-71).
 */
const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#039;': "'",
  '&apos;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
};

const HTML_ENTITY_REGEX = /&(?:amp|lt|gt|quot|apos|nbsp|#39|#039|#x27);/gi;

/**
 * Convertit une chaîne HTML en texte brut pour affichage en VR (M6 F-71).
 *
 * Fonction pure sans dépendance au DOM ni à DOMParser, afin de rester
 * directement testable et exécutable en environnement Node.js et navigateur.
 *
 * Règles de transformation :
 * - Remplace les balises `<br>` et leurs variantes (`<br/>`, `<br />`) par des sauts de ligne (`\n`).
 * - Remplace les balises de fin de paragraphe `</p>` par des sauts de ligne (`\n`).
 * - Supprime toutes les autres balises HTML (`<...>`).
 * - Décode les entités HTML courantes (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&nbsp;`).
 * - Normalise les sauts de ligne et espaces (espaces multiples réduits, sauts de ligne excessifs limités).
 *
 * @param html Chaîne HTML d'entrée.
 * @returns Texte brut extrait et nettoyé.
 */
export function htmlToPlainText(html: string): string {
  if (typeof html !== 'string' || html.length === 0) {
    return '';
  }

  // 1. Convertit les balises <br> et </p> en sauts de ligne (consomme au plus un saut de ligne immédiat)
  let text = html
    .replace(/<br\s*\/?>[^\S\r\n]*(?:\r\n|\r|\n)?/gi, '\n')
    .replace(/<\/p\s*>[^\S\r\n]*(?:\r\n|\r|\n)?/gi, '\n');

  // 2. Retire toutes les autres balises HTML
  text = text.replace(/<[^>]+>/g, '');

  // 3. Décode les entités HTML courantes en une seule passe (évite le double décodage)
  text = text.replace(HTML_ENTITY_REGEX, match => {
    const lower = match.toLowerCase();
    const decoded = HTML_ENTITY_MAP[lower];
    return decoded !== undefined ? decoded : match;
  });

  // 4. Normalise les retours chariot système (\r\n et \r -> \n)
  text = text.replace(/\r\n|\r/g, '\n');

  // 5. Nettoie les espaces horizontaux sur chaque ligne et trim
  text = text
    .split('\n')
    .map(line => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n');

  // 6. Réduit les sauts de ligne consécutifs (au plus deux sauts consécutifs pour séparer les paragraphes)
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Découpe un texte brut en lignes formatées pour le panneau d'information 3D en VR (M6 F-71).
 *
 * Règles de formatage :
 * - Retour à la ligne privilégié aux espaces entre les mots.
 * - Coupe les mots trop longs dont la longueur dépasse `maxChars`.
 * - Respecte la limite `maxLines` : si le texte complet ne tient pas dans `maxLines`,
 *   le texte est tronqué et la dernière ligne se termine par l'ellipse « … ».
 * - Aucune ligne retournée ne dépasse `maxChars` de longueur (y compris l'ellipse « … »).
 *
 * @param text Texte brut d'entrée.
 * @param maxChars Nombre maximal de caractères par ligne (> 0).
 * @param maxLines Nombre maximal de lignes retournées (> 0).
 * @returns Tableau des lignes formatées.
 */
export function wrapLines(
  text: string,
  maxChars: number,
  maxLines: number
): string[] {
  if (
    typeof text !== 'string' ||
    typeof maxChars !== 'number' ||
    typeof maxLines !== 'number' ||
    !Number.isFinite(maxChars) ||
    !Number.isFinite(maxLines) ||
    maxChars <= 0 ||
    maxLines <= 0
  ) {
    return [];
  }

  const charsLimit = Math.floor(maxChars);
  const linesLimit = Math.floor(maxLines);
  if (charsLimit <= 0 || linesLimit <= 0) {
    return [];
  }

  const normalized = text.replace(/\r\n|\r/g, '\n').trim();
  if (normalized.length === 0) {
    return [];
  }

  const allLines: string[] = [];
  const paragraphs = normalized.split('\n');

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed === '') {
      if (allLines.length > 0 && allLines[allLines.length - 1] !== '') {
        allLines.push('');
      }
      continue;
    }

    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (word.length > charsLimit) {
        if (currentLine !== '') {
          allLines.push(currentLine);
          currentLine = '';
        }
        let remaining = word;
        while (remaining.length > charsLimit) {
          allLines.push(remaining.slice(0, charsLimit));
          remaining = remaining.slice(charsLimit);
        }
        currentLine = remaining;
      } else {
        if (currentLine === '') {
          currentLine = word;
        } else if (currentLine.length + 1 + word.length <= charsLimit) {
          currentLine += ' ' + word;
        } else {
          allLines.push(currentLine);
          currentLine = word;
        }
      }
    }

    if (currentLine !== '') {
      allLines.push(currentLine);
    }
  }

  if (allLines.length <= linesLimit) {
    return allLines;
  }

  const result = allLines.slice(0, linesLimit);
  const lastIndex = linesLimit - 1;
  const last = result[lastIndex];

  if (last !== undefined) {
    if (last.length + 1 <= charsLimit) {
      result[lastIndex] = last.trimEnd() + '…';
    } else {
      const lastSpaceIndex = last.lastIndexOf(' ');
      if (lastSpaceIndex > 0) {
        result[lastIndex] = last.slice(0, lastSpaceIndex).trimEnd() + '…';
      } else {
        result[lastIndex] = last.slice(0, Math.max(0, charsLimit - 1)).trimEnd() + '…';
      }
    }
  }

  return result;
}
