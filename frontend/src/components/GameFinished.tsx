import React, { useEffect } from 'react';
import { useRoomStore } from '../stores/roomStore.js';
import { useCanvasStore } from '../stores/canvasStore.js';
import confetti from 'canvas-confetti';
import { Download, Trophy, Crown } from 'lucide-react';
import { pixelKey } from '@pixel-party/shared';

interface GameFinishedProps {
  roomId: string;
}

export const GameFinished: React.FC<GameFinishedProps> = ({ roomId }) => {
  const { players } = useRoomStore();
  const { width, height, pixels } = useCanvasStore();

  useEffect(() => {
    // Fire confetti celebration
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  const handleDownloadPNG = () => {
    // Create an offscreen canvas for high-resolution 1024x1024 nearest-neighbor export
    const scale = Math.floor(1024 / Math.max(width, height)) || 16;
    const exportWidth = width * scale;
    const exportHeight = height * scale;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    // Draw each pixel
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const p = pixels.get(pixelKey(x, y));
        if (p && p.color) {
          ctx.fillStyle = p.color;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }

    // Trigger download
    const link = document.createElement('a');
    link.download = `pixel-party-${roomId}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  const sortedPlayers = [...players].sort((a, b) => (b.pixelCount || 0) - (a.pixelCount || 0));
  const winner = sortedPlayers[0];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center">
        {/* Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
          <Trophy className="w-8 h-8" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
          Masterpiece Complete!
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Game has concluded. Canvas is now in final showcase mode.
        </p>

        {/* Top Contributor Badge */}
        {winner && (winner.pixelCount || 0) > 0 && (
          <div className="p-4 bg-gradient-to-r from-amber-950/40 to-yellow-950/40 border border-amber-500/30 rounded-2xl mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3 text-left">
              <div className="relative">
                <span
                  className="w-4 h-4 rounded-full block ring-2 ring-white/30"
                  style={{ backgroundColor: winner.color }}
                />
                <Crown className="w-3.5 h-3.5 text-amber-400 absolute -top-2.5 -right-2.5 transform rotate-12" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold block">
                  Top Artist
                </span>
                <span className="text-sm font-bold text-white">{winner.nickname}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-amber-300">
                {winner.pixelCount?.toLocaleString()} px
              </span>
            </div>
          </div>
        )}

        {/* Action Button: Download PNG */}
        <button
          onClick={handleDownloadPNG}
          className="w-full flex items-center justify-center gap-2.5 py-4 px-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-500/30 transition-all transform active:scale-98 text-sm uppercase tracking-wider mb-4"
        >
          <Download className="w-5 h-5" />
          <span>Download PNG (1024×1024)</span>
        </button>

        <p className="text-[11px] text-slate-500">
          Saved with sharp nearest-neighbor pixel precision.
        </p>
      </div>
    </div>
  );
};
