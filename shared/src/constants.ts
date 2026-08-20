export const DEFAULT_CANVAS_WIDTH = 64;
export const DEFAULT_CANVAS_HEIGHT = 64;

export const INITIAL_ROOM_SEQUENCE = 1000;

export const OPERATION_HISTORY_LIMIT = 5000;

export const RATE_LIMIT_MAX_PIXELS_PER_SEC = 120;

export const PLAYER_COLORS: string[] = [
  '#F97316', // Orange
  '#3B82F6', // Blue
  '#10B981', // Emerald Green
  '#8B5CF6', // Purple
  '#EAB308', // Yellow
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F43F5E', // Rose
  '#84CC16', // Lime
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#D946EF', // Fuchsia
  '#FB923C', // Light Orange
  '#60A5FA', // Light Blue
  '#4ADE80', // Light Green
  '#A78BFA', // Light Purple
];

export const PALETTE_COLORS: string[] = [
  '#000000', // Black
  '#1F2937', // Dark Slate
  '#4B5563', // Slate Gray
  '#9CA3AF', // Medium Gray
  '#E5E7EB', // Light Gray
  '#FFFFFF', // White

  '#DC2626', // Bright Red
  '#EF4444', // Red
  '#F87171', // Coral Red
  '#EA580C', // Deep Orange
  '#F97316', // Orange
  '#FBBF24', // Amber
  '#FACC15', // Yellow

  '#16A34A', // Dark Green
  '#22C55E', // Green
  '#86EFAC', // Mint Green
  '#0D9488', // Teal
  '#06B6D4', // Cyan
  '#38BDF8', // Sky Blue

  '#2563EB', // Royal Blue
  '#3B82F6', // Blue
  '#7C3AED', // Violet
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#991B1B', // Dark Wine
  '#78350F', // Dark Brown
  '#B45309', // Brown
  '#D97706', // Gold Brown
];

export const BRUSH_SIZES = [1, 2, 3] as const;
export type BrushSize = (typeof BRUSH_SIZES)[number];
