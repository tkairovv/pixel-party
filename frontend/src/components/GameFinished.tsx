import React, { useEffect, useState } from 'react';
import { useRoomStore } from '../stores/roomStore.js';
import { useCanvasStore } from '../stores/canvasStore.js';
import { TimelapsePlayer } from './TimelapsePlayer.js';
import confetti from 'canvas-confetti';
import { Download, Trophy, Crown, Film } from 'lucide-react';
import { pixelKey } from '@pixel-party/shared';

interface GameFinishedProps {
  roomId: string;
}

export const GameFinished: React.FC<GameFinishedProps> = ({ roomId }) => {
  const { players } = useRoomStore();
  const { width, height, pixels } = useCanvasStore();
  const [showTimelapse, setShowTimelapse] = useState(false);

  useEffect(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  const handleDownloadPNG = () => {
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

    const link = document.createElement('a');
    link.download = `pixel-party-${roomId}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  const sortedPlayers = [...players].sort((a, b) => (b.pixelCount || 0) - (a.pixelCount || 0));
  const winner = sortedPlayers[0];

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
        <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center">
          {/* Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
            <Trophy className="w-8 h-8" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
            Шедевр завершён! 🎉
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Раунд окончен. Холст сохранён и готов к экспорту!
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
                    Главный творец
                  </span>
                  <span className="text-sm font-bold text-white">{winner.nickname}</span>
                </div>
              </div>

              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
                {winner.pixelCount} пикселей
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Play Timelapse */}
            <button
              onClick={() => setShowTimelapse(true)}
              className="flex-1 py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold rounded-2xl shadow-lg shadow-indigo-600/25 transition-all transform active:scale-98 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Film className="w-4 h-4" />
              <span>Таймлапс (GIF/Видео)</span>
            </button>

            {/* Download High-Res PNG */}
            <button
              onClick={handleDownloadPNG}
              className="flex-1 py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-500/25 transition-all transform active:scale-98 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Скачать PNG (HD)</span>
            </button>
          </div>
        </div>
      </div>

      {showTimelapse && (
        <TimelapsePlayer roomId={roomId} onClose={() => setShowTimelapse(false)} />
      )}
    </>
  );
};
