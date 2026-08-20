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

interface PixelCanvasProps {
  roomId: string;
}

export const PixelCanvas: React.FC<PixelCanvasProps> = ({ roomId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    width,
    height,
    tool,
    brushSize,
    selectedColor,
    zoom,
    showGrid,
    pixels,
    subscribeChanges,
    applyOptimisticBatch,
  } = useCanvasStore();

  const { myPlayerId, selectedFilterPlayerId, hoveredPlayerId } = usePlayerStore();
  const { room } = useRoomStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const lastCoordRef = useRef<{ x: number; y: number } | null>(null);
  const currentBatchRef = useRef<PixelBatchItem[]>([]);
  const batchOpIdRef = useRef<string | null>(null);
  const batchTimerRef = useRef<any>(null);
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);

  // Render a specific pixel onto the canvas context
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
        // Empty pixel (white background)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(px, py, cellSize, cellSize);
      } else {
        const isTargetFilter =
          activeFilter === null || pixel.ownerId === activeFilter;
        const isHovered = activeHover !== null && pixel.ownerId === activeHover;

        if (isTargetFilter || isHovered) {
          // Full vibrant color
          ctx.fillStyle = pixel.color;
          ctx.fillRect(px, py, cellSize, cellSize);
        } else {
          // Dimmed color for player filtering
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
      if (showGrid && cellSize >= 6) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.07)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
      }
    },
    [pixels, zoom, showGrid]
  );

  // Full Canvas Repaint
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

  // Subscribe to granular store updates for high-performance selective repaints
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

  // Trigger full repaint on filter or zoom changes
  useEffect(() => {
    renderFullCanvas();
  }, [renderFullCanvas, selectedFilterPlayerId, hoveredPlayerId, zoom, showGrid]);

  // Flush queued batch of drawn pixels to the server
  const flushBatch = useCallback(() => {
    if (currentBatchRef.current.length > 0 && batchOpIdRef.current) {
      socketClient.drawBatch(
        roomId,
        batchOpIdRef.current,
        [...currentBatchRef.current]
      );
      currentBatchRef.current = [];
      batchOpIdRef.current = null;
    }
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
  }, [roomId]);

  // Get logical pixel coordinates from Mouse/Touch Event
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

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

  // Draw continuous stroke using Bresenham interpolation
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

      if (!batchOpIdRef.current) {
        batchOpIdRef.current = generateOperationId();
      }

      // 1. Optimistic local painting
      applyOptimisticBatch(batchItems, myPlayerId);

      // 2. Add to batch queue
      currentBatchRef.current.push(...batchItems);

      // 3. Debounced or threshold flush
      if (currentBatchRef.current.length >= 25) {
        flushBatch();
      } else if (!batchTimerRef.current) {
        batchTimerRef.current = setTimeout(flushBatch, 30);
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

  // Mouse & Touch Event Handlers
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (room?.status !== 'playing') return;
    const coord = getCanvasCoords(e);
    if (!coord) return;

    setIsDrawing(true);
    lastCoordRef.current = coord;
    batchOpIdRef.current = generateOperationId();
    drawStrokeTo(coord);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    const coord = getCanvasCoords(e);
    if (coord) {
      setHoverCoord(coord);
    } else {
      setHoverCoord(null);
    }

    if (!isDrawing || !coord) return;
    drawStrokeTo(coord);
  };

  const handlePointerUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastCoordRef.current = null;
      flushBatch();
    }
  };

  const canvasPixelWidth = width * zoom;
  const canvasPixelHeight = height * zoom;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex flex-col items-center justify-center p-2 sm:p-6 overflow-auto touch-none select-none"
    >
      {/* Canvas Frame */}
      <div className="relative rounded-2xl shadow-2xl p-2.5 bg-slate-900 border-2 border-indigo-500/30 flex flex-col items-center">
        {/* Top Info Bar on Canvas */}
        <div className="w-full flex items-center justify-between px-2 py-1 mb-2 text-[11px] font-mono text-slate-400 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span>Canvas: {width}×{height}</span>
          </div>
          <div>
            {hoverCoord ? (
              <span className="text-amber-400 font-bold">
                X: {hoverCoord.x}, Y: {hoverCoord.y}
              </span>
            ) : (
              <span>Zoom: {zoom}x</span>
            )}
          </div>
        </div>

        {/* HTML Canvas Element */}
        <div className="relative overflow-hidden rounded-lg shadow-inner bg-white border border-slate-700">
          <canvas
            ref={canvasRef}
            width={canvasPixelWidth}
            height={canvasPixelHeight}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={() => {
              handlePointerUp();
              setHoverCoord(null);
            }}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onTouchCancel={handlePointerUp}
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
