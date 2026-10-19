import { describe, it, expect } from 'vitest';
import {
  drawInfoPanel,
  DEFAULT_INFO_PANEL_BG,
  DEFAULT_INFO_PANEL_TEXT_COLOR,
  DEFAULT_INFO_PANEL_FONT,
  DEFAULT_INFO_PANEL_PADDING,
  DEFAULT_INFO_PANEL_LINE_HEIGHT,
} from './vr-info-panel-canvas.js';
import { wrapLines } from './vr-info-panel.js';
import * as indexExports from '../index.js';

interface FakeContextCall {
  readonly method: 'fillRect' | 'fillText' | 'measureText';
  readonly args: readonly unknown[];
  readonly fillStyleSnapshot: unknown;
  readonly fontSnapshot: string;
  readonly textAlignSnapshot: string;
  readonly directionSnapshot: string | undefined;
  readonly textBaselineSnapshot: string;
}

interface FakeCanvasContext {
  fillStyle: unknown;
  font: string;
  textAlign: string;
  direction?: string;
  textBaseline: string;
  readonly calls: readonly FakeContextCall[];
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): TextMetrics;
}

function createFakeTextMetrics(width: number): TextMetrics {
  return {
    width,
    actualBoundingBoxAscent: 0,
    actualBoundingBoxDescent: 0,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: 0,
    alphabeticBaseline: 0,
    emHeightAscent: 0,
    emHeightDescent: 0,
    fontBoundingBoxAscent: 0,
    fontBoundingBoxDescent: 0,
    hangingBaseline: 0,
    ideographicBaseline: 0,
  };
}

function createFakeCanvasContext(): FakeCanvasContext {
  const calls: FakeContextCall[] = [];

  const ctx: FakeCanvasContext = {
    fillStyle: '',
    font: '',
    textAlign: '',
    direction: undefined,
    textBaseline: '',
    calls,
    fillRect(x: number, y: number, w: number, h: number): void {
      calls.push({
        method: 'fillRect',
        args: [x, y, w, h],
        fillStyleSnapshot: ctx.fillStyle,
        fontSnapshot: ctx.font,
        textAlignSnapshot: ctx.textAlign,
        directionSnapshot: ctx.direction,
        textBaselineSnapshot: ctx.textBaseline,
      });
    },
    fillText(text: string, x: number, y: number, maxWidth?: number): void {
      const args = typeof maxWidth === 'number' ? [text, x, y, maxWidth] : [text, x, y];
      calls.push({
        method: 'fillText',
        args,
        fillStyleSnapshot: ctx.fillStyle,
        fontSnapshot: ctx.font,
        textAlignSnapshot: ctx.textAlign,
        directionSnapshot: ctx.direction,
        textBaselineSnapshot: ctx.textBaseline,
      });
    },
    measureText(text: string): TextMetrics {
      calls.push({
        method: 'measureText',
        args: [text],
        fillStyleSnapshot: ctx.fillStyle,
        fontSnapshot: ctx.font,
        textAlignSnapshot: ctx.textAlign,
        directionSnapshot: ctx.direction,
        textBaselineSnapshot: ctx.textBaseline,
      });
      return createFakeTextMetrics(text.length * 10);
    },
  };

  return ctx;
}

describe('vr-info-panel-canvas (M6 F-71)', () => {
  describe('exports depuis index.ts', () => {
    it('exporte drawInfoPanel depuis index.ts', () => {
      expect(indexExports.drawInfoPanel).toBe(drawInfoPanel);
    });

    it('exporte les constantes par défaut du panneau d information', () => {
      expect(indexExports.DEFAULT_INFO_PANEL_BG).toBe(DEFAULT_INFO_PANEL_BG);
      expect(indexExports.DEFAULT_INFO_PANEL_TEXT_COLOR).toBe(DEFAULT_INFO_PANEL_TEXT_COLOR);
      expect(indexExports.DEFAULT_INFO_PANEL_FONT).toBe(DEFAULT_INFO_PANEL_FONT);
      expect(indexExports.DEFAULT_INFO_PANEL_PADDING).toBe(DEFAULT_INFO_PANEL_PADDING);
      expect(indexExports.DEFAULT_INFO_PANEL_LINE_HEIGHT).toBe(DEFAULT_INFO_PANEL_LINE_HEIGHT);
    });
  });

  describe('fond dessiné en premier', () => {
    it('dessine un fond sombre semi-transparent couvrant toute la surface en premier appel', () => {
      const ctx = createFakeCanvasContext();
      const lines = ['Ligne 1', 'Ligne 2'];
      const opts = { width: 512, height: 256 };

      drawInfoPanel(ctx, lines, opts);

      expect(ctx.calls.length).toBeGreaterThanOrEqual(1);
      const firstCall = ctx.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall !== undefined) {
        expect(firstCall.method).toBe('fillRect');
        expect(firstCall.args).toEqual([0, 0, 512, 256]);
        expect(firstCall.fillStyleSnapshot).toBe(DEFAULT_INFO_PANEL_BG);
      }
    });

    it('exécute tous les appels fillText strictement après le fillRect du fond', () => {
      const ctx = createFakeCanvasContext();
      const lines = ['Alpha', 'Beta', 'Gamma'];

      drawInfoPanel(ctx, lines, { width: 400, height: 300 });

      const fillRectIndex = ctx.calls.findIndex(c => c.method === 'fillRect');
      expect(fillRectIndex).toBe(0);

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(3);

      for (let i = 0; i < ctx.calls.length; i++) {
        const call = ctx.calls[i];
        if (call !== undefined && call.method === 'fillText') {
          expect(i).toBeGreaterThan(fillRectIndex);
        }
      }
    });

    it('utilise une couleur de fond personnalisée si elle est fournie', () => {
      const ctx = createFakeCanvasContext();
      const customBg = 'rgba(15, 20, 30, 0.9)';

      drawInfoPanel(ctx, ['Texte'], {
        width: 300,
        height: 200,
        backgroundColor: customBg,
      });

      const firstCall = ctx.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall !== undefined) {
        expect(firstCall.method).toBe('fillRect');
        expect(firstCall.fillStyleSnapshot).toBe(customBg);
      }
    });
  });

  describe('nombre de fillText', () => {
    it('n’effectue aucun appel fillText si le tableau de lignes est vide', () => {
      const ctx = createFakeCanvasContext();

      drawInfoPanel(ctx, [], { width: 500, height: 200 });

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(0);

      // Le fond a tout de même été tracé
      expect(ctx.calls.length).toBe(1);
      const firstCall = ctx.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall !== undefined) {
        expect(firstCall.method).toBe('fillRect');
      }
    });

    it('effectue exactement 1 appel fillText pour 1 seule ligne', () => {
      const ctx = createFakeCanvasContext();

      drawInfoPanel(ctx, ['Ligne unique'], { width: 500, height: 200 });

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(1);
      const singleCall = fillTextCalls[0];
      expect(singleCall).toBeDefined();
      if (singleCall !== undefined) {
        expect(singleCall.args[0]).toBe('Ligne unique');
      }
    });

    it('effectue exactement N appels fillText pour N lignes données', () => {
      const ctx = createFakeCanvasContext();
      const lines = ['Premier paragraphe', 'Deuxième paragraphe', 'Troisième paragraphe', 'Conclusion'];

      drawInfoPanel(ctx, lines, { width: 600, height: 400 });

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(lines.length);

      for (let i = 0; i < lines.length; i++) {
        const call = fillTextCalls[i];
        expect(call).toBeDefined();
        if (call !== undefined) {
          expect(call.args[0]).toBe(lines[i]);
        }
      }
    });

    it('s’intègre avec wrapLines : effectue exactement le nombre d appels fillText résultant du découpage', () => {
      const ctx = createFakeCanvasContext();
      const text = 'Un deux trois quatre cinq six sept huit neuf dix';
      const lines = wrapLines(text, 12, 4);
      expect(lines.length).toBeGreaterThan(1);

      drawInfoPanel(ctx, lines, { width: 512, height: 256 });

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(lines.length);
      for (let i = 0; i < lines.length; i++) {
        const call = fillTextCalls[i];
        expect(call).toBeDefined();
        if (call !== undefined) {
          expect(call.args[0]).toBe(lines[i]);
        }
      }
    });
  });

  describe('alignement RTL', () => {
    it('configure textAlign à right, direction à rtl et ancre X à droite quand opts.rtl est true', () => {
      const ctx = createFakeCanvasContext();
      const lines = ['مرحبا بكم في الرباط', 'قصبة الوداية'];
      const width = 600;
      const height = 300;

      drawInfoPanel(ctx, lines, { width, height, rtl: true });

      expect(ctx.textAlign).toBe('right');
      expect(ctx.direction).toBe('rtl');

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(2);

      const expectedX = width - DEFAULT_INFO_PANEL_PADDING;
      for (const call of fillTextCalls) {
        expect(call.textAlignSnapshot).toBe('right');
        expect(call.directionSnapshot).toBe('rtl');
        expect(call.args[1]).toBe(expectedX);
      }
    });

    it('configure textAlign à left, direction à ltr et ancre X à gauche quand opts.rtl est false', () => {
      const ctx = createFakeCanvasContext();
      const lines = ['Kasbah des Oudayas', 'Rabat, Maroc'];
      const width = 600;
      const height = 300;

      drawInfoPanel(ctx, lines, { width, height, rtl: false });

      expect(ctx.textAlign).toBe('left');
      expect(ctx.direction).toBe('ltr');

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(2);

      const expectedX = DEFAULT_INFO_PANEL_PADDING;
      for (const call of fillTextCalls) {
        expect(call.textAlignSnapshot).toBe('left');
        expect(call.directionSnapshot).toBe('ltr');
        expect(call.args[1]).toBe(expectedX);
      }
    });

    it('adopte par défaut l alignement LTR lorsque opts.rtl est omis', () => {
      const ctx = createFakeCanvasContext();
      const lines = ['Vue 360 immersive'];

      drawInfoPanel(ctx, lines, { width: 500, height: 200 });

      expect(ctx.textAlign).toBe('left');
      expect(ctx.direction).toBe('ltr');

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(1);
      const call = fillTextCalls[0];
      expect(call).toBeDefined();
      if (call !== undefined) {
        expect(call.args[1]).toBe(DEFAULT_INFO_PANEL_PADDING);
      }
    });

    it('gère correctement le texte arabe découpé par wrapLines avec alignement RTL', () => {
      const ctx = createFakeCanvasContext();
      const arabicText = 'قصبة الوداية موقع تاريخي رائع يطل على المحيط الأطلسي ونهر أبي رقراق';
      const lines = wrapLines(arabicText, 25, 4);

      drawInfoPanel(ctx, lines, { width: 512, height: 256, rtl: true });

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(lines.length);
      const expectedX = 512 - DEFAULT_INFO_PANEL_PADDING;

      for (let i = 0; i < lines.length; i++) {
        const call = fillTextCalls[i];
        expect(call).toBeDefined();
        if (call !== undefined) {
          expect(call.args[0]).toBe(lines[i]);
          expect(call.args[1]).toBe(expectedX);
          expect(call.textAlignSnapshot).toBe('right');
          expect(call.directionSnapshot).toBe('rtl');
        }
      }
    });
  });

  describe('marge et interligne', () => {
    it('positionne la première ligne à la marge supérieure et applique l interligne exact', () => {
      const ctx = createFakeCanvasContext();
      const lines = ['Ligne 0', 'Ligne 1', 'Ligne 2'];

      drawInfoPanel(ctx, lines, { width: 400, height: 300 });

      expect(ctx.textBaseline).toBe('top');

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(3);

      const y0 = fillTextCalls[0]?.args[2];
      const y1 = fillTextCalls[1]?.args[2];
      const y2 = fillTextCalls[2]?.args[2];

      expect(y0).toBe(DEFAULT_INFO_PANEL_PADDING);
      expect(y1).toBe(DEFAULT_INFO_PANEL_PADDING + DEFAULT_INFO_PANEL_LINE_HEIGHT);
      expect(y2).toBe(DEFAULT_INFO_PANEL_PADDING + 2 * DEFAULT_INFO_PANEL_LINE_HEIGHT);

      if (typeof y0 === 'number' && typeof y1 === 'number' && typeof y2 === 'number') {
        expect(y1 - y0).toBe(DEFAULT_INFO_PANEL_LINE_HEIGHT);
        expect(y2 - y1).toBe(DEFAULT_INFO_PANEL_LINE_HEIGHT);
      }
    });

    it('respecte une marge (padding) et un interligne (lineHeight) personnalisés', () => {
      const ctx = createFakeCanvasContext();
      const lines = ['Titre', 'Sous-titre'];
      const customPadding = 48;
      const customLineHeight = 52;

      drawInfoPanel(ctx, lines, {
        width: 600,
        height: 400,
        padding: customPadding,
        lineHeight: customLineHeight,
      });

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(2);

      const call0 = fillTextCalls[0];
      const call1 = fillTextCalls[1];
      expect(call0).toBeDefined();
      expect(call1).toBeDefined();

      if (call0 !== undefined && call1 !== undefined) {
        expect(call0.args[1]).toBe(customPadding);
        expect(call0.args[2]).toBe(customPadding);

        expect(call1.args[1]).toBe(customPadding);
        expect(call1.args[2]).toBe(customPadding + customLineHeight);
      }
    });

    it('respecte une marge personnalisée en mode RTL', () => {
      const ctx = createFakeCanvasContext();
      const lines = ['عنوان'];
      const width = 800;
      const customPadding = 50;

      drawInfoPanel(ctx, lines, {
        width,
        height: 400,
        rtl: true,
        padding: customPadding,
      });

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(1);
      const call = fillTextCalls[0];
      expect(call).toBeDefined();
      if (call !== undefined) {
        expect(call.args[1]).toBe(width - customPadding);
      }
    });
  });

  describe('configuration typographique et couleurs', () => {
    it('applique la police et la couleur par défaut pour le texte', () => {
      const ctx = createFakeCanvasContext();

      drawInfoPanel(ctx, ['Texte de test'], { width: 500, height: 200 });

      expect(ctx.font).toBe(DEFAULT_INFO_PANEL_FONT);
      expect(ctx.fillStyle).toBe(DEFAULT_INFO_PANEL_TEXT_COLOR);
      expect(ctx.textBaseline).toBe('top');
    });

    it('applique une police et une couleur de texte personnalisées', () => {
      const ctx = createFakeCanvasContext();
      const customFont = 'bold 28px Montserrat, sans-serif';
      const customTextColor = '#C4D937';

      drawInfoPanel(ctx, ['Texte personnalisé'], {
        width: 500,
        height: 200,
        font: customFont,
        textColor: customTextColor,
      });

      expect(ctx.font).toBe(customFont);
      expect(ctx.fillStyle).toBe(customTextColor);
    });
  });

  describe('robustesse et cas limites', () => {
    it('ignore l appel si width ou height est nul ou négatif', () => {
      const ctx1 = createFakeCanvasContext();
      drawInfoPanel(ctx1, ['Test'], { width: 0, height: 200 });
      expect(ctx1.calls.length).toBe(0);

      const ctx2 = createFakeCanvasContext();
      drawInfoPanel(ctx2, ['Test'], { width: 200, height: -10 });
      expect(ctx2.calls.length).toBe(0);

      const ctx3 = createFakeCanvasContext();
      drawInfoPanel(ctx3, ['Test'], { width: Number.NaN, height: 200 });
      expect(ctx3.calls.length).toBe(0);
    });

    it('applique les replis par défaut si padding ou lineHeight est invalide', () => {
      const ctx = createFakeCanvasContext();
      drawInfoPanel(ctx, ['Test'], {
        width: 500,
        height: 200,
        padding: -5,
        lineHeight: 0,
      });

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(1);
      const call = fillTextCalls[0];
      expect(call).toBeDefined();
      if (call !== undefined) {
        expect(call.args[1]).toBe(DEFAULT_INFO_PANEL_PADDING);
        expect(call.args[2]).toBe(DEFAULT_INFO_PANEL_PADDING);
      }
    });

    it('dessine les lignes vides en préservant l interligne', () => {
      const ctx = createFakeCanvasContext();
      const lines = ['Paragraphe 1', '', 'Paragraphe 2'];

      drawInfoPanel(ctx, lines, { width: 500, height: 300 });

      const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(3);

      const call0 = fillTextCalls[0];
      const call1 = fillTextCalls[1];
      const call2 = fillTextCalls[2];
      expect(call0).toBeDefined();
      expect(call1).toBeDefined();
      expect(call2).toBeDefined();

      if (call0 !== undefined && call1 !== undefined && call2 !== undefined) {
        expect(call0.args[0]).toBe('Paragraphe 1');
        expect(call1.args[0]).toBe('');
        expect(call2.args[0]).toBe('Paragraphe 2');

        const y0 = call0.args[2];
        const y1 = call1.args[2];
        const y2 = call2.args[2];
        if (typeof y0 === 'number' && typeof y1 === 'number' && typeof y2 === 'number') {
          expect(y1 - y0).toBe(DEFAULT_INFO_PANEL_LINE_HEIGHT);
          expect(y2 - y1).toBe(DEFAULT_INFO_PANEL_LINE_HEIGHT);
        }
      }
    });
  });
});
