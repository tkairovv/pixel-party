import React from 'react';
import { PALETTE_COLORS } from '@pixel-party/shared';
import { useCanvasStore } from '../stores/canvasStore.js';
import { Check } from 'lucide-react';

interface ColorPaletteProps {
  layout?: 'grid' | 'row';
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({ layout = 'grid' }) => {
  const { selectedColor, setSelectedColor, tool, setTool } = useCanvasStore();

  const handleSelectColor = (color: string) => {
    setSelectedColor(color);
    if (tool === 'eraser') {
      setTool('pencil');
    }
  };

  if (layout === 'row') {
    return (
      <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 no-scrollbar">
        {PALETTE_COLORS.map((color) => {
          const isSelected = selectedColor.toLowerCase() === color.toLowerCase() && tool !== 'eraser';
          return (
            <button
              key={color}
              type="button"
              onClick={() => handleSelectColor(color)}
              className={`w-7 h-7 shrink-0 rounded-full transition-transform active:scale-90 flex items-center justify-center shadow-sm ${
                isSelected ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            >
              {isSelected && (
                <Check
                  className={`w-3.5 h-3.5 ${
                    color === '#FFFFFF' || color === '#FACC15' || color === '#86EFAC' || color === '#E5E7EB'
                      ? 'text-black'
                      : 'text-white'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {PALETTE_COLORS.map((color) => {
        const isSelected = selectedColor.toLowerCase() === color.toLowerCase() && tool !== 'eraser';
        return (
          <button
            key={color}
            type="button"
            onClick={() => handleSelectColor(color)}
            className={`w-8 h-8 rounded-xl transition-transform active:scale-90 flex items-center justify-center shadow-sm ${
              isSelected ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900 z-10' : 'hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          >
            {isSelected && (
              <Check
                className={`w-4 h-4 ${
                  color === '#FFFFFF' || color === '#FACC15' || color === '#86EFAC' || color === '#E5E7EB'
                    ? 'text-black'
                    : 'text-white'
                }`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
