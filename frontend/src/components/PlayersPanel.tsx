import React from 'react';
import { useRoomStore } from '../stores/roomStore.js';
import { usePlayerStore } from '../stores/playerStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { PlayerItem } from './PlayerItem.js';
import { Users, X, EyeOff, Sparkles } from 'lucide-react';

export const PlayersPanel: React.FC = () => {
  const { room, players } = useRoomStore();
  const { myPlayerId, selectedFilterPlayerId, setSelectedFilterPlayerId } = usePlayerStore();
  const { isPlayersDrawerOpen, setPlayersDrawerOpen } = useUIStore();

  const selectedPlayer = players.find((p) => p.id === selectedFilterPlayerId);

  // Sort players by pixelCount descending, active first
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    return (b.pixelCount || 0) - (a.pixelCount || 0);
  });

  const totalPixels = players.reduce((sum, p) => sum + (p.pixelCount || 0), 0);

  const panelContent = (
    <div className="flex flex-col h-full bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl backdrop-blur-md">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Players</h3>
            <span className="text-[10px] text-slate-400 font-mono">
              {players.filter((p) => p.connected).length} online &bull; {totalPixels.toLocaleString()} px drawn
            </span>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setPlayersDrawerOpen(false)}
          className="sm:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Active Filter Mode Banner */}
      {selectedPlayer && (
        <div className="mt-3 p-2.5 bg-indigo-600/20 border border-indigo-500/40 rounded-2xl flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selectedPlayer.color }}
            />
            <span className="text-[11px] font-semibold text-indigo-200 truncate">
              Showing <strong className="text-white">{selectedPlayer.nickname}</strong>'s pixels
            </span>
          </div>
          <button
            onClick={() => setSelectedFilterPlayerId(null)}
            className="p-1 text-indigo-300 hover:text-white rounded-lg hover:bg-indigo-500/30 text-[10px] font-bold uppercase shrink-0 flex items-center gap-1"
          >
            <EyeOff className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      )}

      {/* Instruction tooltip */}
      <div className="my-2 px-1 text-[11px] text-slate-400 font-medium flex items-center gap-1.5 shrink-0">
        <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
        <span>Click a player to highlight their pixels!</span>
      </div>

      {/* Players List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {sortedPlayers.map((player) => (
          <PlayerItem
            key={player.id}
            player={player}
            isHost={room?.hostId === player.id}
            isMe={player.id === myPlayerId}
          />
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (visible on md+) */}
      <aside className="hidden lg:flex w-72 h-full flex-col shrink-0">
        {panelContent}
      </aside>

      {/* Mobile Drawer (visible when isPlayersDrawerOpen is true) */}
      {isPlayersDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-80 h-full p-4 animate-in slide-in-from-right duration-200">
            {panelContent}
          </div>
        </div>
      )}
    </>
  );
};
