import React from 'react';
import { useRoomStore } from '../stores/roomStore.js';
import { usePlayerStore } from '../stores/playerStore.js';
import { socketClient } from '../socket/socketClient.js';
import { QRCodeDisplay } from './QRCodeDisplay.js';
import { Users, Play, Crown, Sparkles, Paintbrush, Loader2 } from 'lucide-react';

interface LobbyPageProps {
  roomId: string;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({ roomId }) => {
  const { room, players, isHost: isHostStore } = useRoomStore();
  const { myPlayerId } = usePlayerStore();

  const isHost = isHostStore || (room?.hostId === myPlayerId);

  const handleStartGame = () => {
    socketClient.startGame(roomId);
  };

  const activePlayers = players.filter((p) => p.connected);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-8 relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <header className="w-full max-w-2xl flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Paintbrush className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold tracking-wider text-base bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-pink-400">
            PIXEL PARTY
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span>{activePlayers.length} {activePlayers.length === 1 ? 'Player' : 'Players'} Ready</span>
        </div>
      </header>

      {/* Main Lobby Card */}
      <main className="w-full max-w-md my-auto z-10 py-4">
        <div className="bg-slate-900/90 border-2 border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center">
          {/* Title */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-5">
            <Sparkles className="w-3 h-3" />
            <span>Scan to Join</span>
          </div>

          {/* QR Code */}
          <div className="mb-6">
            <QRCodeDisplay roomId={roomId} size={210} />
          </div>

          {/* Connected Players List */}
          <div className="w-full border-t border-slate-800 pt-5 mb-6 text-left">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Connected Players ({activePlayers.length})
              </span>
            </div>

            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
              {activePlayers.map((player) => {
                const isCurrentHost = room?.hostId === player.id;
                const isMe = player.id === myPlayerId;

                return (
                  <div
                    key={player.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-200"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full ring-2 ring-white/20 shadow-sm"
                      style={{ backgroundColor: player.color }}
                    />
                    <span className="font-semibold text-white truncate max-w-[110px]">
                      {player.nickname}
                    </span>
                    {isMe && (
                      <span className="text-[10px] text-indigo-400 font-mono font-bold">(You)</span>
                    )}
                    {isCurrentHost && (
                      <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Host Start Button or Waiting Message */}
          {isHost ? (
            <button
              onClick={handleStartGame}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-500/25 transition-all transform active:scale-98 text-sm uppercase tracking-wider"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Game</span>
            </button>
          ) : (
            <div className="w-full py-3.5 px-4 bg-slate-800/60 rounded-2xl border border-slate-700/50 flex items-center justify-center gap-2.5 text-slate-300 text-xs font-semibold">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Waiting for host to start the game...</span>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-2xl text-center py-2 text-xs text-slate-500 z-10">
        Share the link or QR code with everyone on the same Wi-Fi or internet!
      </footer>
    </div>
  );
};
