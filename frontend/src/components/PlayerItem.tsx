import React from 'react';
import { Player } from '@pixel-party/shared';
import { usePlayerStore } from '../stores/playerStore.js';
import { Crown, Eye, WifiOff } from 'lucide-react';

interface PlayerItemProps {
  player: Player;
  isHost: boolean;
  isMe: boolean;
}

export const PlayerItem: React.FC<PlayerItemProps> = ({ player, isHost, isMe }) => {
  const { selectedFilterPlayerId, togglePlayerFilter, setHoveredPlayerId } = usePlayerStore();
  const isSelected = selectedFilterPlayerId === player.id;

  const countFormatted = (player.pixelCount || 0).toLocaleString();

  return (
    <div
      onClick={() => togglePlayerFilter(player.id)}
      onMouseEnter={() => setHoveredPlayerId(player.id)}
      onMouseLeave={() => setHoveredPlayerId(null)}
      className={`group relative flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer select-none ${
        isSelected
          ? 'bg-indigo-600/30 border-indigo-500 shadow-md shadow-indigo-500/20'
          : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
      } ${!player.connected ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Color Dot */}
        <div className="relative shrink-0">
          <span
            className="w-3.5 h-3.5 rounded-full block ring-2 ring-white/20 shadow-sm"
            style={{ backgroundColor: player.color }}
          />
          {!player.connected && (
            <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-slate-600 border border-slate-900 flex items-center justify-center">
              <WifiOff className="w-1.5 h-1.5 text-slate-300" />
            </span>
          )}
        </div>

        {/* Nickname & Me Badge */}
        <div className="truncate">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-100 truncate">{player.nickname}</span>
            {isMe && (
              <span className="text-[10px] text-indigo-400 font-mono font-semibold px-1 rounded bg-indigo-500/10">
                You
              </span>
            )}
            {isHost && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
          </div>
          <span className="text-[10px] font-mono text-slate-400 block">
            {countFormatted} px
          </span>
        </div>
      </div>

      {/* Filter Eye Action */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          title={isSelected ? 'Clear filter' : `Highlight ${player.nickname}'s pixels`}
          className={`p-1.5 rounded-lg transition-all ${
            isSelected
              ? 'bg-indigo-500 text-white shadow-sm'
              : 'text-slate-500 group-hover:text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
