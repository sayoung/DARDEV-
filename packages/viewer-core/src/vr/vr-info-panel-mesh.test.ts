import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createInfoPanel,
  DEFAULT_INFO_PANEL_WIDTH_M,
  DEFAULT_INFO_PANEL_HEIGHT_M,
  DEFAULT_INFO_PANEL_DISTANCE_M,
  DEFAULT_INFO_PANEL_CANVAS_WIDTH,
  DEFAULT_INFO_PANEL_CANVAS_HEIGHT,
  InfoPanelCanvasLike,
} from './vr-info-panel-mesh.js';
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

interface FakeCanvas extends InfoPanelCanvasLike {
  width: number;
  height: number;
  readonly context: FakeCanvasContext;
  getContext(type: '2d'): FakeCanvasContext;
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

function createFakeCanvas(
  width = DEFAULT_INFO_PANEL_CANVAS_WIDTH,
  height = DEFAULT_INFO_PANEL_CANVAS_HEIGHT,
): FakeCanvas {
  const context = createFakeCanvasContext();
  return {
    width,
    height,
    context,
    getContext(): FakeCanvasContext {
      return context;
    },
  };
}

describe('vr-info-panel-mesh (M6 F-71)', () => {
  describe('exports depuis index.ts', () => {
    it('exporte createInfoPanel depuis index.ts', () => {
      expect(indexExports.createInfoPanel).toBe(createInfoPanel);
    });

    it('exporte les constantes géométriques et de résolution par défaut', () => {
      expect(indexExports.DEFAULT_INFO_PANEL_WIDTH_M).toBe(DEFAULT_INFO_PANEL_WIDTH_M);
      expect(indexExports.DEFAULT_INFO_PANEL_HEIGHT_M).toBe(DEFAULT_INFO_PANEL_HEIGHT_M);
      expect(indexExports.DEFAULT_INFO_PANEL_DISTANCE_M).toBe(DEFAULT_INFO_PANEL_DISTANCE_M);
      expect(indexExports.DEFAULT_INFO_PANEL_CANVAS_WIDTH).toBe(DEFAULT_INFO_PANEL_CANVAS_WIDTH);
      expect(indexExports.DEFAULT_INFO_PANEL_CANVAS_HEIGHT).toBe(DEFAULT_INFO_PANEL_CANVAS_HEIGHT);
    });
  });

  describe('création et état initial du mesh', () => {
    it('crée un mesh Three.js avec PlaneGeometry, MeshBasicMaterial transparent et CanvasTexture', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      expect(panel.mesh).toBeInstanceOf(THREE.Mesh);
      expect(panel.mesh.name).toBe('xplor-vr-info-panel');
      expect(panel.mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
      expect(panel.mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);

      const mat = panel.mesh.material;
      if (mat instanceof THREE.MeshBasicMaterial) {
        expect(mat.transparent).toBe(true);
        expect(mat.map).toBeInstanceOf(THREE.CanvasTexture);
        expect(mat.side).toBe(THREE.DoubleSide);
      }
    });

    it('est invisible par défaut à l initialisation', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      expect(panel.mesh.visible).toBe(false);
    });

    it('positionne le mesh devant la caméra à la distance par défaut (0, 0, -distanceM)', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      expect(panel.mesh.position.x).toBe(0);
      expect(panel.mesh.position.y).toBe(0);
      expect(panel.mesh.position.z).toBe(-DEFAULT_INFO_PANEL_DISTANCE_M);
    });

    it('respecte des dimensions et une distance personnalisées', () => {
      const fakeCanvas = createFakeCanvas();
      const customWidth = 2.4;
      const customHeight = 1.2;
      const customDistance = 3.5;

      const panel = createInfoPanel({
        widthM: customWidth,
        heightM: customHeight,
        distanceM: customDistance,
        createCanvas: () => fakeCanvas,
      });

      expect(panel.mesh.position.z).toBe(-customDistance);
      const geom = panel.mesh.geometry;
      if (geom instanceof THREE.PlaneGeometry) {
        expect(geom.parameters.width).toBe(customWidth);
        expect(geom.parameters.height).toBe(customHeight);
      }
    });

    it('utilise les dimensions par défaut si widthM, heightM ou distanceM sont invalides', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        widthM: -1,
        heightM: 0,
        distanceM: Number.NaN,
        createCanvas: () => fakeCanvas,
      });

      expect(panel.mesh.position.z).toBe(-DEFAULT_INFO_PANEL_DISTANCE_M);
      const geom = panel.mesh.geometry;
      if (geom instanceof THREE.PlaneGeometry) {
        expect(geom.parameters.width).toBe(DEFAULT_INFO_PANEL_WIDTH_M);
        expect(geom.parameters.height).toBe(DEFAULT_INFO_PANEL_HEIGHT_M);
      }
    });
  });

  describe('méthode show()', () => {
    it('rend le mesh visible après appel à show()', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      expect(panel.mesh.visible).toBe(false);
      panel.show(['Bonjour de Rabat', 'Visite des Oudayas']);
      expect(panel.mesh.visible).toBe(true);
    });

    it('dessine via drawInfoPanel sur le canvas injecté et met à jour la texture', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      const mat = panel.mesh.material;
      let initialVersion = 0;
      if (mat instanceof THREE.MeshBasicMaterial && mat.map instanceof THREE.CanvasTexture) {
        initialVersion = mat.map.version;
      }

      const lines = ['Premier paragraphe', 'Deuxième paragraphe'];
      panel.show(lines);

      // Le fond a été dessiné via fillRect
      const fillRectCall = fakeCanvas.context.calls.find(c => c.method === 'fillRect');
      expect(fillRectCall).toBeDefined();
      if (fillRectCall !== undefined) {
        expect(fillRectCall.args[2]).toBe(DEFAULT_INFO_PANEL_CANVAS_WIDTH);
        expect(fillRectCall.args[3]).toBe(DEFAULT_INFO_PANEL_CANVAS_HEIGHT);
      }

      // Le texte a été tracé via fillText
      const fillTextCalls = fakeCanvas.context.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(lines.length);
      const call0 = fillTextCalls[0];
      const call1 = fillTextCalls[1];
      expect(call0).toBeDefined();
      expect(call1).toBeDefined();
      if (call0 !== undefined && call1 !== undefined) {
        expect(call0.args[0]).toBe('Premier paragraphe');
        expect(call1.args[0]).toBe('Deuxième paragraphe');
      }

      // La version de texture a bien été incrémentée via needsUpdate = true
      if (mat instanceof THREE.MeshBasicMaterial && mat.map instanceof THREE.CanvasTexture) {
        expect(mat.map.version).toBeGreaterThan(initialVersion);
      }
    });

    it('transmet le paramètre rtl à drawInfoPanel quand rtl est true', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      panel.show(['مرحبا بكم في الرباط'], true);

      expect(panel.mesh.visible).toBe(true);
      expect(fakeCanvas.context.textAlign).toBe('right');
      expect(fakeCanvas.context.direction).toBe('rtl');
    });

    it('transmet le paramètre rtl à drawInfoPanel quand rtl est false', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      panel.show(['Bienvenue à Rabat'], false);

      expect(panel.mesh.visible).toBe(true);
      expect(fakeCanvas.context.textAlign).toBe('left');
      expect(fakeCanvas.context.direction).toBe('ltr');
    });

    it('utilise l option rtl configurée à la création si le paramètre rtl est omis lors de show()', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        rtl: true,
        createCanvas: () => fakeCanvas,
      });

      panel.show(['قصبة الوداية']);

      expect(fakeCanvas.context.textAlign).toBe('right');
      expect(fakeCanvas.context.direction).toBe('rtl');
    });

    it('permet de réafficher et actualiser le panneau avec de nouvelles lignes', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      panel.show(['Premier affichage']);
      panel.hide();
      expect(panel.mesh.visible).toBe(false);

      panel.show(['Deuxième affichage actualisé']);
      expect(panel.mesh.visible).toBe(true);

      const fillTextCalls = fakeCanvas.context.calls.filter(c => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(2);
      const secondCall = fillTextCalls[1];
      expect(secondCall).toBeDefined();
      if (secondCall !== undefined) {
        expect(secondCall.args[0]).toBe('Deuxième affichage actualisé');
      }
    });

    it('gère gracieusement le cas où getContext("2d") retourne null', () => {
      const canvasWithNullCtx: InfoPanelCanvasLike = {
        width: 800,
        height: 400,
        getContext() {
          return null;
        },
      };

      const panel = createInfoPanel({
        createCanvas: () => canvasWithNullCtx,
      });

      expect(() => {
        panel.show(['Texte sans contexte 2D']);
      }).not.toThrow();

      expect(panel.mesh.visible).toBe(true);
    });
  });

  describe('méthode hide()', () => {
    it('rend le mesh invisible après appel à hide()', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      panel.show(['Texte test']);
      expect(panel.mesh.visible).toBe(true);

      panel.hide();
      expect(panel.mesh.visible).toBe(false);
    });

    it('ne produit aucune erreur si hide() est appelé alors que le panneau est déjà invisible', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      expect(panel.mesh.visible).toBe(false);
      expect(() => {
        panel.hide();
      }).not.toThrow();
      expect(panel.mesh.visible).toBe(false);
    });
  });

  describe('méthode dispose()', () => {
    it('libère les ressources Three.js (géométrie, matériau, texture) sans erreur', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      panel.show(['Texte à libérer']);
      expect(panel.mesh.visible).toBe(true);

      expect(() => {
        panel.dispose();
      }).not.toThrow();

      expect(panel.mesh.visible).toBe(false);
    });

    it('retire le mesh de son parent Three.js lors de dispose()', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      const parentGroup = new THREE.Group();
      parentGroup.add(panel.mesh);
      expect(parentGroup.children).toContain(panel.mesh);

      panel.dispose();
      expect(parentGroup.children).not.toContain(panel.mesh);
      expect(panel.mesh.parent).toBeNull();
    });

    it('est idempotente et tolère plusieurs appels successifs sans erreur', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      expect(() => {
        panel.dispose();
        panel.dispose();
        panel.dispose();
      }).not.toThrow();
    });

    it('ignore les appels show() et hide() après appel à dispose()', () => {
      const fakeCanvas = createFakeCanvas();
      const panel = createInfoPanel({
        createCanvas: () => fakeCanvas,
      });

      panel.dispose();
      panel.show(['Texte ignoré']);
      expect(panel.mesh.visible).toBe(false);

      expect(() => {
        panel.hide();
      }).not.toThrow();
    });
  });

  describe('gestion de l environnement et fabrique par défaut', () => {
    it('lève une erreur claire en environnement Node si createCanvas n est pas fourni', () => {
      expect(() => {
        createInfoPanel();
      }).toThrow(/document is not defined/i);
    });

    it('transmet les dimensions du canvas injecté au canvasFactory', () => {
      let passedWidth = 0;
      let passedHeight = 0;

      const panel = createInfoPanel({
        canvasWidth: 800,
        canvasHeight: 400,
        createCanvas(w, h) {
          passedWidth = w;
          passedHeight = h;
          return createFakeCanvas(w, h);
        },
      });

      expect(passedWidth).toBe(800);
      expect(passedHeight).toBe(400);
      expect(panel.mesh).toBeDefined();
    });
  });
});
