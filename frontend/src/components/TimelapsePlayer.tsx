import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCanvasStore } from '../stores/canvasStore.js';
import { socketClient } from '../socket/socketClient.js';
import { pixelKey } from '@pixel-party/shared';
import { Play, Pause, RotateCcw, Download, Film, X } from 'lucide-react';

interface TimelapsePlayerProps {
  roomId: string;
  onClose?: () => void;
}

export const TimelapsePlayer: React.FC<TimelapsePlayerProps> = ({ roomId, onClose }) => {
  const { width, height, timelapseHistory } = useCanvasStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(2);
  const [isExporting, setIsExporting] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    socketClient.requestTimelapse(roomId);
  }, [roomId]);

  const totalOps = timelapseHistory.length;

  // Render canvas state up to operation index
  const renderFrame = useCallback(
    (targetIndex: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cellSize = 8;
      canvas.width = width * cellSize;
      canvas.height = height * cellSize;
      ctx.imageSmoothingEnabled = false;

      // Fill white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Replay pixels from 0 to targetIndex
      const framePixels = new Map<string, string>();
      for (let i = 0; i <= targetIndex && i < timelapseHistory.length; i++) {
        const op = timelapseHistory[i];
        const key = pixelKey(op.x, op.y);
        if (op.color === null) {
          framePixels.delete(key);
        } else {
          framePixels.set(key, op.color);
        }
      }

      // Draw all active pixels
      for (const [key, color] of framePixels.entries()) {
        const [xStr, yStr] = key.split(':');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);
        ctx.fillStyle = color;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    },
    [width, height, timelapseHistory]
  );

  useEffect(() => {
    if (totalOps > 0) {
      renderFrame(currentIndex);
    }
  }, [currentIndex, renderFrame, totalOps]);

  // Animation playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    let lastTime = performance.now();
    const stepInterval = Math.max(8, Math.floor(60 / (speed * 4)));

    const loop = (time: number) => {
      if (time - lastTime >= stepInterval) {
        setCurrentIndex((prev) => {
          if (prev >= totalOps - 1) {
            setIsPlaying(false);
            return totalOps - 1;
          }
          return Math.min(totalOps - 1, prev + Math.max(1, Math.floor(speed)));
        });
        lastTime = time;
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, speed, totalOps]);

  const handlePlayPause = () => {
    if (currentIndex >= totalOps - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  // Export Timelapse as WebM Video (supported in all modern mobile/desktop browsers)
  const handleExportVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || totalOps === 0) return;

    try {
      setIsExporting(true);
      setIsPlaying(false);

      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timelapse-${roomId}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsExporting(false);
      };

      mediaRecorder.start();

      // Render through all frames
      const step = Math.max(1, Math.floor(totalOps / 150));
      for (let i = 0; i < totalOps; i += step) {
        renderFrame(i);
        await new Promise((r) => setTimeout(r, 20));
      }
      renderFrame(totalOps - 1);
      await new Promise((r) => setTimeout(r, 1000)); // hold final frame 1 sec

      mediaRecorder.stop();
    } catch (err) {
      console.error('Error exporting video:', err);
      setIsExporting(false);
    }
  };

  const progressPercent = totalOps > 0 ? Math.round((currentIndex / totalOps) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl relative text-center">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Title */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Timelapse Player</h3>
            <p className="text-xs text-slate-400 font-mono">
              {totalOps} strokes &bull; {progressPercent}% complete
            </p>
          </div>
        </div>

        {/* Canvas Display */}
        <div className="flex justify-center mb-4">
          <div className="p-2 bg-slate-950 rounded-2xl border border-slate-800 shadow-xl">
            <canvas
              ref={canvasRef}
              className="block rounded-lg max-w-full max-h-[40vh] object-contain shadow-inner"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        </div>

        {/* Progress Scrubber */}
        <div className="space-y-1 mb-4 px-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalOps - 1)}
            value={currentIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentIndex(parseInt(e.target.value, 10));
            }}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
            </button>

            <button
              onClick={handleReset}
              title="Reset to Start"
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 transition-all active:scale-95"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            {[1, 2, 4, 8].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  speed === s ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Export Video Button */}
        <button
          onClick={handleExportVideo}
          disabled={isExporting || totalOps === 0}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-lg shadow-pink-600/20 text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <Download className="w-4 h-4" />
          <span>{isExporting ? 'Generating Video...' : 'Download Timelapse Video (WebM)'}</span>
        </button>
      </div>
    </div>
  );
};
