import { describe, it, expect } from 'vitest';
import {
  TILE_BASE_WIDTH,
  TILE_BASE_HEIGHT,
  TILE_COLS,
  TILE_ROWS,
  tileGrid,
  type TileRectangle
} from './tile-grid.js';

describe('tileGrid', () => {
  it('should generate exactly 128 rectangles (16 cols x 8 rows)', () => {
    const grid = tileGrid();
    expect(grid.length).toBe(TILE_COLS * TILE_ROWS);
    expect(grid.length).toBe(128);
  });

  it('should have the correct first rectangle', () => {
    const grid = tileGrid();
    expect(grid[0]).toEqual({
      col: 0,
      row: 0,
      left: 0,
      top: 0,
      width: 512,
      height: 512
    });
  });

  it('should have the correct last rectangle', () => {
    const grid = tileGrid();
    expect(grid[127]).toEqual({
      col: 15,
      row: 7,
      left: 7680,
      top: 3584,
      width: 512,
      height: 512
    });
  });

  it('should generate rectangles within bounds (8192x4096)', () => {
    const grid = tileGrid();
    for (const rect of grid) {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.left + rect.width).toBeLessThanOrEqual(TILE_BASE_WIDTH);
      expect(rect.top + rect.height).toBeLessThanOrEqual(TILE_BASE_HEIGHT);
    }
  });

  it('should have unique (col, row) pairs', () => {
    const grid = tileGrid();
    const pairs = new Set(grid.map((rect: TileRectangle) => String(rect.col) + ',' + String(rect.row)));
    expect(pairs.size).toBe(128);
  });
});
