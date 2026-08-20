import React, { useEffect, useRef, useCallback } from 'react';
import { useRoomStore } from '../stores/roomStore.js';
import { useCanvasStore } from '../stores/canvasStore.js';
import { socketClient } from '../socket/socketClient.js';
import { getSectorBounds, pixelKey } from '@pixel-party/shared';
import confetti from 'canvas-confetti';
import { Sparkles, Eye, ChevronRight, CheckCircle2, Trophy, Lock } from 'lucide-react';

interface MosaicRevealProps {
  roomId: string;
}

export const MosaicReveal: React.FC<MosaicRevealProps> = ({ roomId }) => {
  const { room, players, isHost } = useRoomStore();
  const { width, height, pixels } = useCanvasStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const mosaicConfig = room?.mosaicConfig || {
    sectorsCount: 3,
    sectorTitles: ['Голова 🎩', 'Туловище 👕', 'Ноги 👖'],
    direction: 'horizontal' as const,
  };

  const sectorsCount = mosaicConfig.sectorsCount;
  const currentStep = room?.revealStep || 0;

  const isAllRevealed = currentStep >= sectorsCount;

  // Handle advancing to next reveal step (host action)
  const handleNextStep = () => {
    const next = currentStep + 1;
    socketClient.setRevealStep(roomId, next);
  };

  // Trigger confetti when everything is revealed
  useEffect(() => {
    if (isAllRevealed) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
      });
    }
  }, [isAllRevealed]);

  // Render canvas with curtain overlay on unrevealed sectors
  const renderRevealCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = 8; // high resolution for reveal display
    canvas.width = width * cellSize;
    canvas.height = height * cellSize;

    ctx.imageSmoothingEnabled = false;

    // Fill white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Draw all pixels
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const p = pixels.get(pixelKey(x, y));
        if (p && p.color) {
          ctx.fillStyle = p.color;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    // 2. Draw curtains over sectors where sectorIndex >= currentStep
    for (let i = 0; i < sectorsCount; i++) {
      if (i >= currentStep) {
        const bounds = getSectorBounds(i, sectorsCount, width, height, mosaicConfig.direction);
        const rx = bounds.minX * cellSize;
        const ry = bounds.minY * cellSize;
        const rw = (bounds.maxX - bounds.minX) * cellSize;
        const rh = (bounds.maxY - bounds.minY) * cellSize;

        // Dark velvet secret curtain
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(rx, ry, rw, rh);

        // Pattern stripes
        ctx.fillStyle = '#1E293B';
        for (let stripe = rx; stripe < rx + rw; stripe += 24) {
          ctx.fillRect(stripe, ry, 12, rh);
        }

        // Shroud outline
        ctx.strokeStyle = '#6366F1';
        ctx.lineWidth = 3;
        ctx.strokeRect(rx, ry, rw, rh);

        // Text & Lock on curtain
        ctx.fillStyle = '#A5B4FC';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🔒 ${mosaicConfig.sectorTitles[i] || `Сектор ${i + 1}`}`, rx + rw / 2, ry + rh / 2);
      }
    }
  }, [width, height, pixels, currentStep, sectorsCount, mosaicConfig]);

  useEffect(() => {
    renderRevealCanvas();
  }, [renderRevealCanvas, currentStep]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-xl animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-5 sm:p-8 shadow-2xl relative text-center my-auto">
        {/* Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Title */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Слепая мозаика: Великое раскрытие! 🎭</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-2">
          {isAllRevealed ? '🎉 Мозаика полностью открыта!' : `Раскрытие: Часть ${Math.min(sectorsCount, currentStep + 1)} из ${sectorsCount}`}
        </h2>

        {/* Teams Summary Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
          {Array.from({ length: sectorsCount }).map((_, idx) => {
            const teamPlayers = players.filter((p) => p.teamSector === idx);
            const isRevealed = idx < currentStep;
            const title = mosaicConfig.sectorTitles[idx] || `Сектор ${idx + 1}`;

            return (
              <div
                key={idx}
                className={`p-3 rounded-2xl border transition-all text-left ${
                  isRevealed
                    ? 'bg-emerald-950/30 border-emerald-500/40 shadow-sm'
                    : idx === currentStep
                    ? 'bg-indigo-600/20 border-indigo-500 animate-pulse'
                    : 'bg-slate-800/40 border-slate-700/50 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white truncate">{title}</span>
                  {isRevealed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {teamPlayers.length > 0 ? (
                    teamPlayers.map((tp) => (
                      <span
                        key={tp.id}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-900/80 text-slate-200 border border-slate-700/60 flex items-center gap-1"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tp.color }} />
                        <span>{tp.nickname}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-500 italic">Нет игроков</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reveal Canvas Display */}
        <div className="flex justify-center mb-6">
          <div className="p-2 bg-slate-950 rounded-2xl border-2 border-slate-800 shadow-2xl max-w-full overflow-hidden">
            <canvas
              ref={canvasRef}
              className="block rounded-lg shadow-inner max-w-full max-h-[42vh] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!isAllRevealed && isHost && (
            <button
              onClick={handleNextStep}
              className="flex-1 py-4 px-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-600/30 transition-all transform active:scale-98 text-sm uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              <span>Открыть: {mosaicConfig.sectorTitles[currentStep] || `Часть ${currentStep + 1}`}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {!isAllRevealed && !isHost && (
            <div className="flex-1 py-3.5 px-4 bg-slate-800/80 rounded-2xl border border-slate-700 text-xs font-semibold text-slate-300 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Ожидание хоста для открытия следующей части...</span>
            </div>
          )}

          {isAllRevealed && (
            <button
              onClick={() => {
                if (isHost) {
                  socketClient.finishGame(roomId);
                }
              }}
              className="flex-1 py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-2xl shadow-xl shadow-emerald-600/30 transition-all transform active:scale-98 text-sm uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Trophy className="w-4 h-4" />
              <span>Перейти к итогам и Таймлапсу 🏆</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
