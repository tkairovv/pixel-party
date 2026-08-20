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
} from '@pixel-party/shared';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

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
  const { room } = useRoomStore();

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
        // Empty pixel (crisp white)
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
          // Dimmed for other players when a filter is active
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(px, py, cellSize, cellSize);

          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = pixel.color;
          ctx.fillRect(px, py, cellSize, cellSize);
          ctx.restore();
        }
      }

      // Draw grid line if enabled and zoom is sufficiently large
      if (showGrid && cellSize >= 5) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
      }
    },
    [pixels, zoom, showGrid]
  );

  // Full canvas repaint
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
  }, [width, height, renderPixel, selectedFilterPlayerId, hoveredPlayerId]);

  // Subscribe to granular store updates for high-performance direct canvas updates
  useEffect(() => {
    const unsubscribe = subscribeChanges((keys) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      if (keys.includes('*')) {
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
  }, [subscribeChanges, renderFullCanvas, renderPixel, selectedFilterPlayerId, hoveredPlayerId]);

  // Repaint when visual filter, zoom, or dimensions change
  useEffect(() => {
    renderFullCanvas();
  }, [renderFullCanvas, selectedFilterPlayerId, hoveredPlayerId, zoom, showGrid, width, height]);

  // Flush queued strokes to server with unique operationId
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

  // Translate pointer client coordinates to logical canvas grid (x, y)
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

    return { x: logicalX, y: logicalY };
  };

  // Draw continuous stroke using Bresenham line interpolation
  const drawStrokeTo = useCallback(
    (targetCoord: { x: number; y: number }) => {
      if (!myPlayerId || room?.status !== 'playing') return;

      const fromCoord = lastCoordRef.current || targetCoord;
      const strokePixels = getLinePixels(
        fromCoord.x,
        fromCoord.y,
        targetCoord.x,
        targetCoord.y,
        brushSize,
        width,
        height
      );

      const colorToApply = tool === 'eraser' ? null : selectedColor;

      const batchItems: PixelBatchItem[] = strokePixels.map((p) => ({
        x: p.x,
        y: p.y,
        color: colorToApply,
      }));

      // 1. Instant optimistic local painting
      applyOptimisticBatch(batchItems, myPlayerId);

      // 2. Add to batch queue
      currentBatchRef.current.push(...batchItems);

      // 3. Fast flush threshold: every 20ms or when 15 pixels queued
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
      applyOptimisticBatch,
      flushBatch,
    ]
  );

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
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
      // 2 touches: start pinch zoom
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
      // Pinch zoom in action
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

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      setZoom((z) => Math.max(2, Math.min(32, z + delta)));
    }
  };

  const canvasPixelWidth = width * zoom;
  const canvasPixelHeight = height * zoom;

  return (
    <div
      ref={viewportRef}
      onWheel={handleWheel}
      className="relative flex-1 w-full h-full flex flex-col items-center justify-center p-1 sm:p-4 overflow-auto touch-none select-none"
    >
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
      </div>

      {/* Coordinate Tooltip */}
      {hoverCoord && (
        <div className="absolute top-3 right-3 z-10 px-2.5 py-1 bg-slate-900/90 border border-slate-800 rounded-xl text-[11px] font-mono font-bold text-amber-400 shadow-md backdrop-blur-md">
          {hoverCoord.x}, {hoverCoord.y}
        </div>
      )}

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
