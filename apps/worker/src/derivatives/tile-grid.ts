export const TILE_BASE_WIDTH = 8192;
export const TILE_BASE_HEIGHT = 4096;
export const TILE_SIZE = 512;
export const TILE_COLS = 16;
export const TILE_ROWS = 8;

export interface TileRectangle {
  col: number;
  row: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export function tileGrid(): Array<TileRectangle> {
  const rectangles: Array<TileRectangle> = [];

  for (let row = 0; row < TILE_ROWS; row++) {
    for (let col = 0; col < TILE_COLS; col++) {
      rectangles.push({
        col,
        row,
        left: col * TILE_SIZE,
        top: row * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
      });
    }
  }

  return rectangles;
}
