import { describe, it, expect } from 'vitest';
import { htmlToPlainText, wrapLines } from './vr-info-panel.js';
import {
  htmlToPlainText as htmlToPlainTextFromIndex,
  wrapLines as wrapLinesFromIndex,
} from '../index.js';

describe('vr-info-panel (M6 F-71)', () => {
  describe('exports depuis index.ts', () => {
    it('exporte htmlToPlainText depuis index.ts', () => {
      expect(htmlToPlainTextFromIndex).toBe(htmlToPlainText);
    });

    it('exporte wrapLines depuis index.ts', () => {
      expect(wrapLinesFromIndex).toBe(wrapLines);
    });
  });

  describe('htmlToPlainText', () => {
    it('renvoie une chaîne vide pour une chaîne vide ou du blanc', () => {
      expect(htmlToPlainText('')).toBe('');
      expect(htmlToPlainText('   ')).toBe('');
      expect(htmlToPlainText('\n\t  ')).toBe('');
    });

    it('retire les balises HTML simples tout en conservant le texte', () => {
      const input = '<p>Bonjour <b>le</b> <i>monde</i> et <span>bonjour</span> !</p>';
      expect(htmlToPlainText(input)).toBe('Bonjour le monde et bonjour !');
    });

    it('retire les balises avec attributs', () => {
      const input = '<div id="main" class="content"><a href="https://example.com" target="_blank">Lien</a></div>';
      expect(htmlToPlainText(input)).toBe('Lien');
    });

    it('convertit les balises <br>, <br/>, <br /> et <BR> en sauts de ligne', () => {
      const input = 'Ligne 1<br>Ligne 2<br/>Ligne 3<br />Ligne 4<BR>Ligne 5';
      expect(htmlToPlainText(input)).toBe('Ligne 1\nLigne 2\nLigne 3\nLigne 4\nLigne 5');
    });

    it('convertit la balise fermante </p> en saut de ligne', () => {
      const input = '<p>Premier paragraphe</p><p>Deuxième paragraphe</p>';
      expect(htmlToPlainText(input)).toBe('Premier paragraphe\nDeuxième paragraphe');
    });

    it('gère les majuscules et espaces dans </p > et </P>', () => {
      const input = '<P>Premier</P ><P>Deuxième</P>';
      expect(htmlToPlainText(input)).toBe('Premier\nDeuxième');
    });

    it('décode les entités HTML requises (&amp;, &lt;, &gt;, &quot;, &#39;, &nbsp;)', () => {
      const input = 'Tom &amp; Jerry &lt;1&gt; &quot;Classique&quot; l&#39;artiste&nbsp;!';
      expect(htmlToPlainText(input)).toBe('Tom & Jerry <1> "Classique" l\'artiste !');
    });

    it('décode également &apos; et &#039;', () => {
      const input = 'L&apos;hôtel et l&#039;oasis';
      expect(htmlToPlainText(input)).toBe("L'hôtel et l'oasis");
    });

    it('évite le double décodage accidentel (&amp;lt; reste &lt;)', () => {
      const input = 'Code : &amp;lt;div&amp;gt;';
      expect(htmlToPlainText(input)).toBe('Code : &lt;div&gt;');
    });

    it('normalise les espaces consécutifs et les retours chariot', () => {
      const input = '<p>   Texte   avec   beaucoup   d\'espaces   </p>\r\n<p>Autre ligne</p>';
      expect(htmlToPlainText(input)).toBe("Texte avec beaucoup d'espaces\nAutre ligne");
    });

    it('limite les sauts de ligne consécutifs excessifs à 2 sauts maximum', () => {
      const input = '<p>Ligne A</p>\n\n\n\n<p>Ligne B</p>';
      expect(htmlToPlainText(input)).toBe('Ligne A\n\nLigne B');
    });

    it('préserve parfaitement le texte avec accents français', () => {
      const input = '<p>Visite <b>guidée</b> à l&#39;hôtel <i>Hassan</i> : séjour agréable &amp; détendu à Rabat.</p>';
      expect(htmlToPlainText(input)).toBe(
        "Visite guidée à l'hôtel Hassan : séjour agréable & détendu à Rabat."
      );
    });

    it('préserve parfaitement le texte en arabe (RTL)', () => {
      const input = '<p>مرحبا بكم في <b>قصبة الوداية</b> بالرباط</p><p>تاريخ عريق &amp; تراث أصيل</p>';
      expect(htmlToPlainText(input)).toBe(
        'مرحبا بكم في قصبة الوداية بالرباط\nتاريخ عريق & تراث أصيل'
      );
    });
  });

  describe('wrapLines', () => {
    describe('cas limites et paramètres invalides', () => {
      it('renvoie un tableau vide pour du texte vide ou ne contenant que du blanc', () => {
        expect(wrapLines('', 20, 5)).toEqual([]);
        expect(wrapLines('   ', 20, 5)).toEqual([]);
        expect(wrapLines('\n\t  ', 20, 5)).toEqual([]);
      });

      it('renvoie un tableau vide si maxChars est <= 0, NaN ou infini', () => {
        expect(wrapLines('Bonjour', 0, 5)).toEqual([]);
        expect(wrapLines('Bonjour', -10, 5)).toEqual([]);
        expect(wrapLines('Bonjour', Number.NaN, 5)).toEqual([]);
        expect(wrapLines('Bonjour', Infinity, 5)).toEqual([]);
      });

      it('renvoie un tableau vide si maxLines est <= 0, NaN ou infini', () => {
        expect(wrapLines('Bonjour', 20, 0)).toEqual([]);
        expect(wrapLines('Bonjour', 20, -5)).toEqual([]);
        expect(wrapLines('Bonjour', 20, Number.NaN)).toEqual([]);
        expect(wrapLines('Bonjour', 20, Infinity)).toEqual([]);
      });

      it('tronque les valeurs flottantes en entiers inférieurs', () => {
        const text = '1234567890';
        expect(wrapLines(text, 5.9, 1.9)).toEqual(['1234…']);
      });
    });

    describe('texte tenant sur une seule ligne', () => {
      it('ne découpe pas et n’ajoute pas d’ellipse quand le texte tient sur une ligne', () => {
        const text = 'Bonjour le monde';
        const lines = wrapLines(text, 20, 5);
        expect(lines).toEqual(['Bonjour le monde']);
      });

      it('ne découpe pas quand la longueur correspond exactement à maxChars', () => {
        const text = '1234567890';
        const lines = wrapLines(text, 10, 2);
        expect(lines).toEqual(['1234567890']);
      });
    });

    describe('retour à la ligne aux espaces', () => {
      it('découpe aux espaces sans couper les mots courts', () => {
        const text = 'Un deux trois quatre cinq';
        const lines = wrapLines(text, 10, 5);
        expect(lines).toEqual(['Un deux', 'trois', 'quatre', 'cinq']);
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(10);
        }
      });

      it('remplit chaque ligne au maximum sans dépasser maxChars', () => {
        const text = 'aa bb cc dd ee';
        // 'aa bb cc' = 8 chars <= 8
        // 'dd ee' = 5 chars <= 8
        const lines = wrapLines(text, 8, 4);
        expect(lines).toEqual(['aa bb cc', 'dd ee']);
      });
    });

    describe('coupure des mots trop longs', () => {
      it('coupe un mot unique plus long que maxChars en tranches de maxChars', () => {
        const word = 'Anticonstitutionnellement'; // 25 caractères
        const lines = wrapLines(word, 10, 5);
        expect(lines).toEqual(['Anticonsti', 'tutionnell', 'ement']);
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(10);
        }
      });

      it('renvoie le mot trop long à la ligne suivante avant de le couper s’il ne tient pas sur la ligne en cours', () => {
        const text = 'Mot Anticonstitutionnellement fin';
        const lines = wrapLines(text, 10, 5);
        expect(lines).toEqual(['Mot', 'Anticonsti', 'tutionnell', 'ement fin']);
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(10);
        }
      });
    });

    describe('gestion des sauts de ligne préexistants', () => {
      it('respecte les sauts de ligne simples (paragraphes)', () => {
        const text = 'Titre court\nDescription sur plusieurs mots';
        const lines = wrapLines(text, 20, 5);
        expect(lines).toEqual(['Titre court', 'Description sur', 'plusieurs mots']);
      });

      it('préserve une ligne vide entre deux paragraphes séparés par double saut de ligne', () => {
        const text = 'Paragraphe 1\n\nParagraphe 2';
        const lines = wrapLines(text, 20, 5);
        expect(lines).toEqual(['Paragraphe 1', '', 'Paragraphe 2']);
      });
    });

    describe('troncature et ajout de « … » à la dernière ligne', () => {
      it('n’ajoute pas d’ellipse si le texte complet tient dans maxLines', () => {
        const text = 'Un deux trois quatre';
        const lines = wrapLines(text, 10, 4);
        expect(lines).toEqual(['Un deux', 'trois', 'quatre']);
        for (const line of lines) {
          expect(line.endsWith('…')).toBe(false);
        }
      });

      it('ajoute « … » à la dernière ligne si le nombre de lignes dépasse maxLines', () => {
        const text = 'Un deux trois quatre cinq';
        const lines = wrapLines(text, 10, 2);
        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe('Un deux');
        expect(lines[1]).toBe('trois…');
        expect(lines[1]?.endsWith('…')).toBe(true);
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(10);
        }
      });

      it('conserve la limite maxChars même si la dernière ligne avait déjà exactement maxChars', () => {
        // 'Line 1' (6 chars)
        // '1234567890' (10 chars)
        // 'suite'
        const text = 'Line 1\n1234567890\nsuite';
        const lines = wrapLines(text, 10, 2);
        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe('Line 1');
        // '1234567890' doit être tronqué à 9 chars + '…' = 10 chars
        expect(lines[1]).toBe('123456789…');
        expect(lines[1]?.length).toBe(10);
        expect(lines[1]?.endsWith('…')).toBe(true);
      });

      it('tronque au bord du mot précédent si ajouter l’ellipse dépasserait maxChars', () => {
        // 'Bonjour le' fait 10 chars
        // Avec maxChars = 10, maxLines = 1 : 'le' est retiré pour laisser la place à l'ellipse 'Bonjour…' (8 chars <= 10)
        const text = 'Bonjour le monde';
        const lines = wrapLines(text, 10, 1);
        expect(lines).toEqual(['Bonjour…']);
        expect(lines[0]?.length).toBeLessThanOrEqual(10);
      });

      it('ajoute l’ellipse directement si la dernière ligne a assez d’espace libre', () => {
        // 'Bonjour' (7 chars), avec maxChars = 10, maxLines = 1, et du texte en plus
        const text = 'Bonjour monde';
        const lines = wrapLines(text, 10, 1);
        expect(lines).toEqual(['Bonjour…']);
        expect(lines[0]?.length).toBe(8);
      });

      it('gère maxChars = 1 et maxLines = 1 en renvoyant uniquement l’ellipse si tronqué', () => {
        const text = 'Hello';
        const lines = wrapLines(text, 1, 1);
        expect(lines).toEqual(['…']);
        expect(lines[0]?.length).toBe(1);
      });
    });

    describe('texte en français avec accents et ponctuation', () => {
      it('découpe correctement un texte en français avec accents', () => {
        const text = "La Kasbah des Oudaïas est située à l'embouchure du Bouregreg.";
        const lines = wrapLines(text, 25, 4);
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('La Kasbah des Oudaïas est');
        expect(lines[1]).toBe("située à l'embouchure du");
        expect(lines[2]).toBe('Bouregreg.');
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(25);
        }
      });

      it('tronque avec ellipse sur texte accentué sans altérer les caractères', () => {
        const text = "Visite d'un monument historique exceptionnel et chargé d'émotion.";
        const lines = wrapLines(text, 20, 2);
        expect(lines).toHaveLength(2);
        expect(lines[1]?.endsWith('…')).toBe(true);
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(20);
        }
      });
    });

    describe('texte en arabe (RTL)', () => {
      it('découpe correctement le texte en arabe aux espaces', () => {
        const text = 'مرحبا بكم في مدينة الرباط الجميلة عاصمة الثقافة المغربية';
        const lines = wrapLines(text, 20, 5);
        expect(lines.length).toBeGreaterThan(1);
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(20);
        }
        // Vérifie que les mots arabes ne sont pas tronqués accidentellement
        expect(lines[0]).toBe('مرحبا بكم في مدينة');
        expect(lines[1]).toBe('الرباط الجميلة عاصمة');
        expect(lines[2]).toBe('الثقافة المغربية');
      });

      it('tronque avec ellipse sur texte arabe en respectant maxLines et maxChars', () => {
        const text = 'قصبة الوداية موقع تاريخي رائع يطل على المحيط الأطلسي ونهر أبي رقراق';
        const lines = wrapLines(text, 18, 2);
        expect(lines).toHaveLength(2);
        expect(lines[1]?.endsWith('…')).toBe(true);
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(18);
        }
      });
    });

    describe('intégration htmlToPlainText et wrapLines', () => {
      it('prépare un panneau info 3D complet à partir d’un contenu HTML de hotspot', () => {
        const html = `
          <p>La <b>Kasbah des Oudaïas</b> est un ancien camp militaire fortifié.</p>
          <p>Construite au XIIe siècle, elle offre une vue imprenable sur Salé &amp; l&#39;océan.</p>
        `;
        const plain = htmlToPlainText(html);
        expect(plain).toContain("Salé & l'océan.");

        const lines = wrapLines(plain, 30, 3);
        expect(lines).toHaveLength(3);
        expect(lines[2]?.endsWith('…')).toBe(true);
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(30);
        }
      });
    });
  });
});
