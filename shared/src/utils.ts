import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from './constants.js';

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

export interface SectorBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function getSectorBounds(
  sectorIndex: number,
  sectorsCount: number,
  width: number = DEFAULT_CANVAS_WIDTH,
  height: number = DEFAULT_CANVAS_HEIGHT,
  direction: 'horizontal' | 'vertical' | 'grid' = 'horizontal'
): SectorBounds {
  if (direction === 'grid' && sectorsCount === 4) {
    const halfW = Math.floor(width / 2);
    const halfH = Math.floor(height / 2);
    switch (sectorIndex) {
      case 0: return { minX: 0, maxX: halfW, minY: 0, maxY: halfH };
      case 1: return { minX: halfW, maxX: width, minY: 0, maxY: halfH };
      case 2: return { minX: 0, maxX: halfW, minY: halfH, maxY: height };
      case 3:
      default: return { minX: halfW, maxX: width, minY: halfH, maxY: height };
    }
  }

  // Horizontal strips (Head, Body, Legs)
  const sectorH = Math.floor(height / sectorsCount);
  const minY = sectorIndex * sectorH;
  const maxY = sectorIndex === sectorsCount - 1 ? height : (sectorIndex + 1) * sectorH;
  return { minX: 0, maxX: width, minY, maxY };
}

export function isCoordInSector(
  x: number,
  y: number,
  sectorIndex: number,
  sectorsCount: number,
  width: number = DEFAULT_CANVAS_WIDTH,
  height: number = DEFAULT_CANVAS_HEIGHT,
  direction: 'horizontal' | 'vertical' | 'grid' = 'horizontal'
): boolean {
  const bounds = getSectorBounds(sectorIndex, sectorsCount, width, height, direction);
  return x >= bounds.minX && x < bounds.maxX && y >= bounds.minY && y < bounds.maxY;
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
  height: number = DEFAULT_CANVAS_HEIGHT,
  sectorBounds?: SectorBounds
): { x: number; y: number }[] {
  const visited = new Set<string>();
  const result: { x: number; y: number }[] = [];

  const minX = sectorBounds ? sectorBounds.minX : 0;
  const maxX = sectorBounds ? sectorBounds.maxX : width;
  const minY = sectorBounds ? sectorBounds.minY : 0;
  const maxY = sectorBounds ? sectorBounds.maxY : height;

  const addPointWithBrush = (cx: number, cy: number) => {
    const half = Math.floor(brushSize / 2);
    for (let dx = -half; dx < brushSize - half; dx++) {
      for (let dy = -half; dy < brushSize - half; dy++) {
        const px = cx + dx;
        const py = cy + dy;
        if (isValidCoordinate(px, py, width, height) && px >= minX && px < maxX && py >= minY && py < maxY) {
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
