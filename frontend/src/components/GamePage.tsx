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
import { BrushSize } from '@pixel-party/shared';
import {
  Pencil,
  Eraser,
  Users,
  ZoomIn,
  ZoomOut,
  X,
  AlertTriangle,
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

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Header */}
      <GameHeader roomId={roomId} />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden p-2 sm:p-4 gap-3">
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
              onClick={() => setZoom((z) => Math.max(4, z - 2))}
              className="p-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(24, z + 2))}
              className="p-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {/* Players Drawer Button */}
            <button
              type="button"
              onClick={() => setPlayersDrawerOpen(true)}
              className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md"
            >
              <Users className="w-4 h-4" />
              <span>Players</span>
            </button>
          </div>
        </div>
      </div>

      {/* QR Code Modal (for inviting players during active game) */}
      {isQRModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 shadow-2xl relative max-w-sm w-full text-center">
            <button
              onClick={() => setQRModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-white mb-4">Invite Friends</h3>
            <QRCodeDisplay roomId={roomId} size={190} />
          </div>
        </div>
      )}

      {/* Clear Canvas Confirmation Modal (Host only) */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-6 shadow-2xl relative max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Clear Canvas?</h3>
            <p className="text-xs text-slate-400 mb-6">
              This will permanently erase all pixels on the canvas for all players.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase shadow-md shadow-rose-600/30"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Finished Overlay & PNG Download */}
      {room?.status === 'finished' && <GameFinished roomId={roomId} />}
    </div>
  );
};
