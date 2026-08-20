import React from 'react';
import { useCanvasStore } from '../stores/canvasStore.js';
import { useRoomStore } from '../stores/roomStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { ColorPalette } from './ColorPalette.js';
import { BrushSize, BRUSH_SIZES } from '@pixel-party/shared';
import {
  Pencil,
  Eraser,
  Grid,
  ZoomIn,
  ZoomOut,
  Trash2,
} from 'lucide-react';

export const Toolbar: React.FC = () => {
  const {
    tool,
    setTool,
    brushSize,
    setBrushSize,
    zoom,
    setZoom,
    showGrid,
    setShowGrid,
  } = useCanvasStore();

  const { isHost } = useRoomStore();
  const { setClearModalOpen } = useUIStore();

  return (
    <aside className="hidden md:flex w-64 h-full flex-col bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl backdrop-blur-md shrink-0 overflow-y-auto">
      {/* Section: Tools */}
      <div className="mb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2 px-1">
          Drawing Tools
        </span>
        <div className="grid grid-cols-2 gap-2">
          {/* Pencil */}
          <button
            type="button"
            onClick={() => setTool('pencil')}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border font-bold text-xs uppercase tracking-wider transition-all ${
              tool === 'pencil'
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30 scale-102'
                : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300'
            }`}
          >
            <Pencil className="w-4 h-4" />
            <span>Pencil</span>
          </button>

          {/* Eraser */}
          <button
            type="button"
            onClick={() => setTool('eraser')}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border font-bold text-xs uppercase tracking-wider transition-all ${
              tool === 'eraser'
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30 scale-102'
                : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300'
            }`}
          >
            <Eraser className="w-4 h-4" />
            <span>Eraser</span>
          </button>
        </div>
      </div>

      {/* Section: Brush Size */}
      <div className="mb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2 px-1">
          Brush Size
        </span>
        <div className="grid grid-cols-3 gap-2">
          {BRUSH_SIZES.map((size) => {
            const isSelected = brushSize === size;
            return (
              <button
                key={size}
                type="button"
                onClick={() => setBrushSize(size as BrushSize)}
                className={`py-2 rounded-xl border text-xs font-mono font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                  isSelected
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-md'
                    : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <div
                  className="bg-current rounded-sm"
                  style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
                />
                <span>{size}×{size}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section: Color Palette */}
      <div className="mb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2 px-1">
          Color Palette
        </span>
        <ColorPalette layout="grid" />
      </div>

      {/* Section: Canvas View Controls */}
      <div className="mt-auto pt-4 border-t border-slate-800 space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1 px-1">
          View Controls
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(4, z - 2))}
            title="Zoom Out"
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl flex items-center justify-center transition-all active:scale-95"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(12)}
            title="Reset Zoom"
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl flex items-center justify-center text-xs font-mono font-bold transition-all active:scale-95"
          >
            {zoom}x
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(24, z + 2))}
            title="Zoom In"
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl flex items-center justify-center transition-all active:scale-95"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowGrid((g) => !g)}
          className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            showGrid
              ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
              : 'bg-slate-800/60 border-slate-700 text-slate-400'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>{showGrid ? 'Grid On' : 'Grid Off'}</span>
        </button>

        {/* Clear Canvas (Host only) */}
        {isHost && (
          <button
            type="button"
            onClick={() => setClearModalOpen(true)}
            className="w-full py-2.5 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all mt-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Canvas</span>
          </button>
        )}
      </div>
    </aside>
  );
};
