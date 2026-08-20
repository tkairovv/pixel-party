import React from 'react';
import { useRoomStore } from '../stores/roomStore.js';
import { useCanvasStore } from '../stores/canvasStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { socketClient } from '../socket/socketClient.js';
import { GameHeader } from './GameHeader.js';
import { Toolbar } from './Toolbar.js';
import { PixelCanvas } from './PixelCanvas.js';
import { PlayersPanel } from './PlayersPanel.js';
import { ColorPalette } from './ColorPalette.js';
import { QRCodeDisplay } from './QRCodeDisplay.js';
import { GameFinished } from './GameFinished.js';
import { MosaicReveal } from './MosaicReveal.js';
import { BrushSize } from '@pixel-party/shared';
import {
  Pencil,
  Eraser,
  Users,
  ZoomIn,
  ZoomOut,
  X,
  AlertTriangle,
  Undo2,
} from 'lucide-react';

interface GamePageProps {
  roomId: string;
}

export const GamePage: React.FC<GamePageProps> = ({ roomId }) => {
  const { room } = useRoomStore();
  const {
    tool,
    setTool,
    brushSize,
    setBrushSize,
    setZoom,
    canUndo,
  } = useCanvasStore();

  const {
    isQRModalOpen,
    setQRModalOpen,
    isClearModalOpen,
    setClearModalOpen,
    setPlayersDrawerOpen,
  } = useUIStore();

  const handleConfirmClear = () => {
    socketClient.clearCanvas(roomId);
    setClearModalOpen(false);
  };

  const handleUndo = () => {
    socketClient.undo(roomId);
  };

  return (
    <div className="h-[100dvh] w-screen max-w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Header */}
      <GameHeader roomId={roomId} />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden p-1.5 sm:p-4 gap-3 min-h-0">
        {/* Left: Desktop Toolbar */}
        <Toolbar />

        {/* Center: Collaborative HTML5 Canvas */}
        <PixelCanvas roomId={roomId} />

        {/* Right: Desktop / Mobile Players Panel */}
        <PlayersPanel />
      </div>

      {/* Mobile Bottom Action Bar (visible on sm/md and below) */}
      <div className="md:hidden bg-slate-900 border-t border-slate-800 p-2 flex flex-col gap-2 z-20">
        {/* Color Palette Row */}
        <ColorPalette layout="row" />

        {/* Quick Tools Row */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-1">
            {/* Pencil */}
            <button
              type="button"
              onClick={() => setTool('pencil')}
              className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                tool === 'pencil'
                  ? 'bg-indigo-600 border-indigo-400 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <Pencil className="w-4 h-4" />
            </button>

            {/* Eraser */}
            <button
              type="button"
              onClick={() => setTool('eraser')}
              className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                tool === 'eraser'
                  ? 'bg-indigo-600 border-indigo-400 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <Eraser className="w-4 h-4" />
            </button>

            {/* Mobile Undo */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className="p-2 bg-slate-800 disabled:opacity-30 border border-slate-700 text-slate-300 rounded-xl"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            {/* Brush Size Toggle */}
            <button
              type="button"
              onClick={() => {
                const nextSize = brushSize === 1 ? 2 : brushSize === 2 ? 3 : 1;
                setBrushSize(nextSize as BrushSize);
              }}
              className="px-2.5 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold"
            >
              {brushSize}x
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Zoom Controls */}
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(2, z - 2))}
              className="p-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(32, z + 2))}
              className="p-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {/* Players Drawer Trigger */}
            <button
              type="button"
              onClick={() => setPlayersDrawerOpen(true)}
              className="p-2 bg-slate-800 border border-slate-700 text-indigo-400 rounded-xl"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* QR Code Invite Modal */}
      {isQRModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center relative">
            <button
              onClick={() => setQRModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-1">Invite Friends</h3>
            <p className="text-xs text-slate-400 mb-4">Scan QR code or use room code</p>
            <div className="flex justify-center mb-4">
              <QRCodeDisplay roomId={roomId} size={200} />
            </div>
          </div>
        </div>
      )}

      {/* Clear Canvas Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center relative">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Clear Canvas?</h3>
            <p className="text-xs text-slate-400 mb-6">
              This will wipe all pixels drawn by all players. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setClearModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-semibold text-white shadow-lg shadow-rose-600/30"
              >
                Yes, Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blind Mosaic Reveal Stage */}
      {room?.status === 'revealing' && <MosaicReveal roomId={roomId} />}

      {/* Game Finished Overlay */}
      {room?.status === 'finished' && <GameFinished roomId={roomId} />}
    </div>
  );
};
