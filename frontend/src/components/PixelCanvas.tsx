import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useCanvasStore } from '../stores/canvasStore.js';
import { usePlayerStore } from '../stores/playerStore.js';
import { useRoomStore } from '../stores/roomStore.js';
import { socketClient } from '../socket/socketClient.js';
import {
  getLinePixels,
  generateOperationId,
  pixelKey,
  PixelBatchItem,
  getSectorBounds,
  isCoordInSector,
} from '@pixel-party/shared';
import { ZoomIn, ZoomOut, Maximize2, Eye, EyeOff, Scissors } from 'lucide-react';

interface PixelCanvasProps {
  roomId: string;
}

export const PixelCanvas: React.FC<PixelCanvasProps> = ({ roomId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const {
    width,
    height,
    tool,
    brushSize,
    selectedColor,
    zoom,
    setZoom,
    showGrid,
    pixels,
    subscribeChanges,
    applyOptimisticBatch,
  } = useCanvasStore();

  const { myPlayerId, selectedFilterPlayerId, hoveredPlayerId } = usePlayerStore();
  const { room, players, isHost, isHostPeekActive, toggleHostPeek } = useRoomStore();

  // Navigation & Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);
  const lastCoordRef = useRef<{ x: number; y: number } | null>(null);

  // Batch queue for high-speed network synchronization
  const currentBatchRef = useRef<PixelBatchItem[]>([]);
  const batchTimerRef = useRef<any>(null);

  // Touch tracking for pinch-to-zoom & pan
  const touchStartDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(zoom);

  // Slicing intro animation state (for Blind Mosaic mode)
  const [showIntroAnimation, setShowIntroAnimation] = useState(false);

  const myPlayer = players.find((p) => p.id === myPlayerId);
  const isBlindMosaic = room?.gameMode === 'blind_mosaic' && room.mosaicConfig;
  const mySector = myPlayer?.teamSector;

  // Show 2.5s Slicing Intro on Game Start
  useEffect(() => {
    if (isBlindMosaic && room?.status === 'playing') {
      setShowIntroAnimation(true);
      const timer = setTimeout(() => setShowIntroAnimation(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [isBlindMosaic, room?.status]);

  // Auto-fit initial zoom on mount or dimension change
  const autoFitZoom = useCallback(() => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const availableWidth = Math.max(260, rect.width - 24);
    const availableHeight = Math.max(260, rect.height - 40);

    const fitZoom = Math.max(
      2,
      Math.floor(Math.min(availableWidth / width, availableHeight / height))
    );
    setZoom(fitZoom);
  }, [width, height, setZoom]);

  useEffect(() => {
    autoFitZoom();
  }, [autoFitZoom]);

  // Render an individual pixel directly on the canvas context
  const renderPixel = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      activeFilter: string | null,
      activeHover: string | null
    ) => {
      const key = pixelKey(x, y);
      const pixel = pixels.get(key);
      const cellSize = zoom;

      const px = x * cellSize;
      const py = y * cellSize;

      if (!pixel || !pixel.color) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(px, py, cellSize, cellSize);
      } else {
        const isTargetFilter =
          activeFilter === null || pixel.ownerId === activeFilter;
        const isHovered = activeHover !== null && pixel.ownerId === activeHover;

        if (isTargetFilter || isHovered) {
          ctx.fillStyle = pixel.color;
          ctx.fillRect(px, py, cellSize, cellSize);
        } else {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(px, py, cellSize, cellSize);

          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = pixel.color;
          ctx.fillRect(px, py, cellSize, cellSize);
          ctx.restore();
        }
      }

      if (showGrid && cellSize >= 5) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
      }
    },
    [pixels, zoom, showGrid]
  );

  // Full canvas repaint with Curtain Shrouding for Blind Mosaic
  const renderFullCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Fill background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        renderPixel(ctx, x, y, selectedFilterPlayerId, hoveredPlayerId);
      }
    }

    // If Blind Mosaic is active and not host peeking, shroud other sectors!
    if (isBlindMosaic && room?.status === 'playing' && !isHostPeekActive && mySector !== undefined) {
      const sectorsCount = room.mosaicConfig!.sectorsCount;
      const cellSize = zoom;

      for (let i = 0; i < sectorsCount; i++) {
        if (i !== mySector) {
          const bounds = getSectorBounds(i, sectorsCount, width, height, room.mosaicConfig!.direction);
          const rx = bounds.minX * cellSize;
          const ry = bounds.minY * cellSize;
          const rw = (bounds.maxX - bounds.minX) * cellSize;
          const rh = (bounds.maxY - bounds.minY) * cellSize;

          // Velvet Curtain overlay
          ctx.fillStyle = '#0B0F19';
          ctx.fillRect(rx, ry, rw, rh);

          // Subtle stripes pattern
          ctx.fillStyle = '#111827';
          for (let s = rx; s < rx + rw; s += 20) {
            ctx.fillRect(s, ry, 10, rh);
          }

          // Shroud border
          ctx.strokeStyle = '#4F46E5';
          ctx.lineWidth = 2;
          ctx.strokeRect(rx, ry, rw, rh);

          // Secret Zone Text
          ctx.fillStyle = '#818CF8';
          ctx.font = 'bold 13px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`🔒 СЕКРЕТ: ${room.mosaicConfig!.sectorTitles[i] || `Сектор ${i + 1}`}`, rx + rw / 2, ry + rh / 2);
        }
      }

      // Draw dividing line around player's active sector
      const myBounds = getSectorBounds(mySector, sectorsCount, width, height, room.mosaicConfig!.direction);
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        myBounds.minX * cellSize,
        myBounds.minY * cellSize,
        (myBounds.maxX - myBounds.minX) * cellSize,
        (myBounds.maxY - myBounds.minY) * cellSize
      );
    }
  }, [
    width,
    height,
    renderPixel,
    selectedFilterPlayerId,
    hoveredPlayerId,
    isBlindMosaic,
    room?.status,
    room?.mosaicConfig,
    isHostPeekActive,
    mySector,
    zoom,
  ]);

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = subscribeChanges((keys) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      if (keys.includes('*') || isBlindMosaic) {
        renderFullCanvas();
        return;
      }

      for (const key of keys) {
        const [xStr, yStr] = key.split(':');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);
        if (!isNaN(x) && !isNaN(y)) {
          renderPixel(ctx, x, y, selectedFilterPlayerId, hoveredPlayerId);
        }
      }
    });

    return () => unsubscribe();
  }, [subscribeChanges, renderFullCanvas, renderPixel, selectedFilterPlayerId, hoveredPlayerId, isBlindMosaic]);

  useEffect(() => {
    renderFullCanvas();
  }, [renderFullCanvas, selectedFilterPlayerId, hoveredPlayerId, zoom, showGrid, width, height, isHostPeekActive]);

  // Flush queued strokes to server
  const flushBatch = useCallback(() => {
    if (currentBatchRef.current.length > 0) {
      const batchToSend = [...currentBatchRef.current];
      currentBatchRef.current = [];
      const opId = generateOperationId();
      socketClient.drawBatch(roomId, opId, batchToSend);
    }
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
  }, [roomId]);

  // Translate pointer coordinates to logical canvas grid (x, y)
  const getCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    const logicalX = Math.floor(canvasX / zoom);
    const logicalY = Math.floor(canvasY / zoom);

    if (logicalX < 0 || logicalX >= width || logicalY < 0 || logicalY >= height) {
      return null;
    }

    // In Blind Mosaic mode (unless host peeking), clamp strictly to player's sector!
    if (isBlindMosaic && !isHostPeekActive && mySector !== undefined) {
      const inSector = isCoordInSector(
        logicalX,
        logicalY,
        mySector,
        room!.mosaicConfig!.sectorsCount,
        width,
        height,
        room!.mosaicConfig!.direction
      );
      if (!inSector) return null;
    }

    return { x: logicalX, y: logicalY };
  };

  // Draw continuous stroke using Bresenham line interpolation
  const drawStrokeTo = useCallback(
    (targetCoord: { x: number; y: number }) => {
      if (!myPlayerId || room?.status !== 'playing') return;

      const sectorBounds = (isBlindMosaic && !isHostPeekActive && mySector !== undefined)
        ? getSectorBounds(mySector, room!.mosaicConfig!.sectorsCount, width, height, room!.mosaicConfig!.direction)
        : undefined;

      const fromCoord = lastCoordRef.current || targetCoord;
      const strokePixels = getLinePixels(
        fromCoord.x,
        fromCoord.y,
        targetCoord.x,
        targetCoord.y,
        brushSize,
        width,
        height,
        sectorBounds
      );

      const colorToApply = tool === 'eraser' ? null : selectedColor;

      const batchItems: PixelBatchItem[] = strokePixels.map((p) => ({
        x: p.x,
        y: p.y,
        color: colorToApply,
      }));

      // Optimistic local paint
      applyOptimisticBatch(batchItems, myPlayerId);
      currentBatchRef.current.push(...batchItems);

      if (currentBatchRef.current.length >= 15) {
        flushBatch();
      } else if (!batchTimerRef.current) {
        batchTimerRef.current = setTimeout(flushBatch, 20);
      }

      lastCoordRef.current = targetCoord;
    },
    [
      myPlayerId,
      room?.status,
      brushSize,
      width,
      height,
      tool,
      selectedColor,
      isBlindMosaic,
      isHostPeekActive,
      mySector,
      room,
      applyOptimisticBatch,
      flushBatch,
    ]
  );

  // Pointer Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (room?.status !== 'playing') return;

    const coord = getCanvasCoords(e.clientX, e.clientY);
    if (!coord) return;

    setIsDrawing(true);
    lastCoordRef.current = coord;
    drawStrokeTo(coord);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coord = getCanvasCoords(e.clientX, e.clientY);
    setHoverCoord(coord);

    if (!isDrawing || !coord) return;
    drawStrokeTo(coord);
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastCoordRef.current = null;
      flushBatch();
    }
  };

  // Touch Handlers with 2-finger pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsDrawing(false);
      lastCoordRef.current = null;
      flushBatch();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistRef.current = Math.hypot(dx, dy);
      initialZoomRef.current = zoom;
      return;
    }

    if (e.touches.length === 1 && room?.status === 'playing') {
      const touch = e.touches[0];
      const coord = getCanvasCoords(touch.clientX, touch.clientY);
      if (!coord) return;

      setIsDrawing(true);
      lastCoordRef.current = coord;
      drawStrokeTo(coord);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDist = Math.hypot(dx, dy);
      const factor = currentDist / touchStartDistRef.current;
      const newZoom = Math.max(2, Math.min(32, Math.round(initialZoomRef.current * factor)));
      setZoom(newZoom);
      return;
    }

    if (e.touches.length === 1 && isDrawing) {
      const touch = e.touches[0];
      const coord = getCanvasCoords(touch.clientX, touch.clientY);
      if (coord) {
        setHoverCoord(coord);
        drawStrokeTo(coord);
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
    if (isDrawing) {
      setIsDrawing(false);
      lastCoordRef.current = null;
      flushBatch();
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      setZoom((z) => Math.max(2, Math.min(32, z + delta)));
    }
  };

  const canvasPixelWidth = width * zoom;
  const canvasPixelHeight = height * zoom;

  const currentSectorTitle = (isBlindMosaic && mySector !== undefined)
    ? room!.mosaicConfig!.sectorTitles[mySector] || `Сектор ${mySector + 1}`
    : null;

  return (
    <div
      ref={viewportRef}
      onWheel={handleWheel}
      className="relative flex-1 w-full h-full flex flex-col items-center justify-center p-1 sm:p-4 overflow-auto touch-none select-none"
    >
      {/* Slicing Cinematic Intro Overlay */}
      {showIntroAnimation && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-in fade-in">
          <div className="text-center p-6 bg-slate-900 border-2 border-indigo-500 rounded-3xl shadow-2xl animate-bounce">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400 text-indigo-300 flex items-center justify-center mx-auto mb-3">
              <Scissors className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-xl font-extrabold text-white mb-1">Холст разделен на части! ✂️</h3>
            <p className="text-sm text-slate-300 mb-2">Ваша секретная часть:</p>
            <div className="inline-block px-4 py-2 bg-indigo-600 text-white font-mono font-bold text-base rounded-2xl shadow-lg shadow-indigo-600/30">
              {currentSectorTitle || 'Ваш сектор'}
            </div>
          </div>
        </div>
      )}

      {/* Floating Canvas Controls Overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(2, z - 2))}
          title="Zoom Out"
          className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 active:scale-95"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="text-[11px] font-mono font-bold px-1 text-indigo-300 min-w-[28px] text-center">
          {zoom}x
        </span>

        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(32, z + 2))}
          title="Zoom In"
          className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 active:scale-95"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={autoFitZoom}
          title="Fit Canvas to Screen"
          className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 active:scale-95 border-l border-slate-800 ml-0.5"
        >
          <Maximize2 className="w-4 h-4 text-amber-400" />
        </button>

        {/* Host Spectator Peek Toggle */}
        {isHost && isBlindMosaic && (
          <button
            type="button"
            onClick={toggleHostPeek}
            title={isHostPeekActive ? 'Скрыть чужие части' : 'Подглядеть весь холст (Зритель)'}
            className={`p-1.5 rounded-lg active:scale-95 border-l border-slate-800 ml-0.5 flex items-center gap-1 text-[10px] font-bold ${
              isHostPeekActive
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-400 hover:bg-slate-800'
            }`}
          >
            {isHostPeekActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isHostPeekActive ? 'Скрыть' : 'Подглядеть'}</span>
          </button>
        )}
      </div>

      {/* Sector Badge or Coordinate Tooltip */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {isBlindMosaic && currentSectorTitle && (
          <div className="px-3 py-1 bg-indigo-600/30 border border-indigo-500 rounded-xl text-[11px] font-bold text-indigo-300 shadow-md backdrop-blur-md">
            {currentSectorTitle}
          </div>
        )}

        {hoverCoord && (
          <div className="px-2.5 py-1 bg-slate-900/90 border border-slate-800 rounded-xl text-[11px] font-mono font-bold text-amber-400 shadow-md backdrop-blur-md">
            {hoverCoord.x}, {hoverCoord.y}
          </div>
        )}
      </div>

      {/* Canvas Container */}
      <div className="relative rounded-2xl shadow-2xl p-1.5 sm:p-2 bg-slate-900 border-2 border-indigo-500/30 flex items-center justify-center max-w-full max-h-full">
        <div className="relative overflow-hidden rounded-lg shadow-inner bg-white border border-slate-700">
          <canvas
            ref={canvasRef}
            width={canvasPixelWidth}
            height={canvasPixelHeight}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              handleMouseUp();
              setHoverCoord(null);
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className="cursor-crosshair block touch-none"
            style={{
              width: `${canvasPixelWidth}px`,
              height: `${canvasPixelHeight}px`,
              imageRendering: 'pixelated',
            }}
          />
        </div>
      </div>
    </div>
  );
};
