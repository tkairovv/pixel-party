import { create } from 'zustand';
import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  PALETTE_COLORS,
  BrushSize,
  PixelState,
  PixelUpdate,
  CanvasSnapshot,
  pixelKey,
} from '@pixel-party/shared';

export type DrawingTool = 'pencil' | 'eraser';

type PixelChangeListener = (updatedKeys: string[]) => void;

interface CanvasStoreState {
  width: number;
  height: number;
  tool: DrawingTool;
  brushSize: BrushSize;
  selectedColor: string;
  zoom: number;
  showGrid: boolean;
  lastAppliedSeq: number;

  canUndo: boolean;
  canRedo: boolean;

  timelapseHistory: PixelUpdate[];

  // In-memory map of pixels
  pixels: Map<string, PixelState>;

  // Direct canvas render listeners
  listeners: Set<PixelChangeListener>;

  // Actions
  setDimensions: (width: number, height: number) => void;
  setTool: (tool: DrawingTool) => void;
  setBrushSize: (size: BrushSize) => void;
  setSelectedColor: (color: string) => void;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  setShowGrid: (show: boolean | ((prev: boolean) => boolean)) => void;
  setUndoRedoStatus: (canUndo: boolean, canRedo: boolean) => void;
  setTimelapseHistory: (history: PixelUpdate[]) => void;

  applySnapshot: (snapshot: CanvasSnapshot) => void;
  applyUpdate: (update: PixelUpdate) => boolean;
  applyBatchUpdates: (updates: PixelUpdate[]) => void;
  applyOptimisticBatch: (
    items: { x: number; y: number; color: string | null }[],
    ownerId: string
  ) => void;
  clearCanvasState: (newSeq: number) => void;

  subscribeChanges: (listener: PixelChangeListener) => () => void;
  notifyChanges: (keys: string[]) => void;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  width: DEFAULT_CANVAS_WIDTH,
  height: DEFAULT_CANVAS_HEIGHT,
  tool: 'pencil',
  brushSize: 1,
  selectedColor: PALETTE_COLORS[6],
  zoom: 10,
  showGrid: true,
  lastAppliedSeq: 0,
  canUndo: false,
  canRedo: false,
  timelapseHistory: [],
  pixels: new Map<string, PixelState>(),
  listeners: new Set<PixelChangeListener>(),

  setDimensions: (width, height) => set({ width, height }),

  setTool: (tool) => set({ tool }),

  setBrushSize: (brushSize) => set({ brushSize }),

  setSelectedColor: (selectedColor) => set({ selectedColor, tool: 'pencil' }),

  setZoom: (zoom) =>
    set((state) => ({
      zoom: typeof zoom === 'function' ? zoom(state.zoom) : zoom,
    })),

  setShowGrid: (showGrid) =>
    set((state) => ({
      showGrid: typeof showGrid === 'function' ? showGrid(state.showGrid) : showGrid,
    })),

  setUndoRedoStatus: (canUndo, canRedo) => set({ canUndo, canRedo }),

  setTimelapseHistory: (timelapseHistory) => set({ timelapseHistory }),

  applySnapshot: (snapshot) => {
    const newPixels = new Map<string, PixelState>();
    for (const [k, p] of Object.entries(snapshot.pixels)) {
      newPixels.set(k, { ...p });
    }

    set({
      width: snapshot.width,
      height: snapshot.height,
      lastAppliedSeq: snapshot.sequence,
      pixels: newPixels,
    });

    get().notifyChanges(['*']);
  },

  applyUpdate: (update) => {
    const { pixels, lastAppliedSeq } = get();
    const key = pixelKey(update.x, update.y);
    const current = pixels.get(key);

    if (current && update.seq < current.seq) {
      return false;
    }

    if (update.color === null) {
      pixels.delete(key);
    } else {
      pixels.set(key, {
        color: update.color,
        ownerId: update.ownerId,
        seq: update.seq,
      });
    }

    const nextSeq = Math.max(lastAppliedSeq, update.seq);
    set({ lastAppliedSeq: nextSeq, canUndo: true });

    get().notifyChanges([key]);
    return true;
  },

  applyBatchUpdates: (updates) => {
    if (!updates || updates.length === 0) return;
    const { pixels, lastAppliedSeq } = get();
    const changedKeys: string[] = [];
    let maxSeq = lastAppliedSeq;

    for (const update of updates) {
      const key = pixelKey(update.x, update.y);
      const current = pixels.get(key);

      if (!current || update.seq >= current.seq) {
        if (update.color === null) {
          pixels.delete(key);
        } else {
          pixels.set(key, {
            color: update.color,
            ownerId: update.ownerId,
            seq: update.seq,
          });
        }
        changedKeys.push(key);
      }

      if (update.seq > maxSeq) {
        maxSeq = update.seq;
      }
    }

    set({ lastAppliedSeq: maxSeq, canUndo: true });
    get().notifyChanges(changedKeys);
  },

  applyOptimisticBatch: (items, ownerId) => {
    const { pixels } = get();
    const changedKeys: string[] = [];

    for (const item of items) {
      const key = pixelKey(item.x, item.y);
      const current = pixels.get(key);
      const tentativeSeq = (current?.seq || 0) + 1;

      if (item.color === null) {
        pixels.delete(key);
      } else {
        pixels.set(key, {
          color: item.color,
          ownerId,
          seq: tentativeSeq,
        });
      }
      changedKeys.push(key);
    }

    set({ canUndo: true });
    get().notifyChanges(changedKeys);
  },

  clearCanvasState: (newSeq) => {
    const { pixels } = get();
    pixels.clear();
    set({ lastAppliedSeq: newSeq, canUndo: false, canRedo: false });
    get().notifyChanges(['*']);
  },

  subscribeChanges: (listener) => {
    const { listeners } = get();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  notifyChanges: (keys) => {
    const { listeners } = get();
    for (const listener of listeners) {
      listener(keys);
    }
  },
}));
