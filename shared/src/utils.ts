import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, PALETTE_COLORS } from './constants.js';

export function pixelKey(x: number, y: number): string {
  return `${x}:${y}`;
}

export function parsePixelKey(key: string): { x: number; y: number } {
  const [xStr, yStr] = key.split(':');
  return { x: parseInt(xStr, 10), y: parseInt(yStr, 10) };
}

export function isValidCoordinate(
  x: number,
  y: number,
  width: number = DEFAULT_CANVAS_WIDTH,
  height: number = DEFAULT_CANVAS_HEIGHT
): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < width && y >= 0 && y < height;
}

export function sanitizeNickname(nickname: string): string {
  return nickname.trim();
}

export function validateNickname(nickname: string): { valid: boolean; error?: string } {
  const sanitized = sanitizeNickname(nickname);
  if (sanitized.length < 2) {
    return { valid: false, error: 'Nickname must be at least 2 characters' };
  }
  if (sanitized.length > 16) {
    return { valid: false, error: 'Nickname must be at most 16 characters' };
  }
  return { valid: true };
}

export function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function generateOperationId(): string {
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

export function generatePlayerId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Bresenham's line algorithm with brush size support.
 * Returns unique in-bounds coordinates covering the continuous stroke.
 */
export function getLinePixels(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  brushSize: number = 1,
  width: number = DEFAULT_CANVAS_WIDTH,
  height: number = DEFAULT_CANVAS_HEIGHT
): { x: number; y: number }[] {
  const visited = new Set<string>();
  const result: { x: number; y: number }[] = [];

  const addPointWithBrush = (cx: number, cy: number) => {
    const half = Math.floor(brushSize / 2);
    for (let dx = -half; dx < brushSize - half; dx++) {
      for (let dy = -half; dy < brushSize - half; dy++) {
        const px = cx + dx;
        const py = cy + dy;
        if (isValidCoordinate(px, py, width, height)) {
          const key = pixelKey(px, py);
          if (!visited.has(key)) {
            visited.add(key);
            result.push({ x: px, y: py });
          }
        }
      }
    }
  };

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let currX = x0;
  let currY = y0;

  while (true) {
    addPointWithBrush(currX, currY);
    if (currX === x1 && currY === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      currX += sx;
    }
    if (e2 < dx) {
      err += dx;
      currY += sy;
    }
  }

  return result;
}
