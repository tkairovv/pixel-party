import React from 'react';
import { useRoomStore } from '../stores/roomStore.js';
import { usePlayerStore } from '../stores/playerStore.js';
import { socketClient } from '../socket/socketClient.js';
import { QRCodeDisplay } from './QRCodeDisplay.js';
import { Play, Users, Crown, Loader2, Paintbrush, Scissors, Palette } from 'lucide-react';

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
  const isBlindMosaic = room?.gameMode === 'blind_mosaic' && room.mosaicConfig;

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-3 sm:p-8 relative overflow-x-hidden overflow-y-auto">
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
          <span>{activePlayers.length} {activePlayers.length === 1 ? 'Игрок' : 'Игроков'} Готово</span>
        </div>
      </header>

      {/* Main Lobby Card */}
      <main className="w-full max-w-md my-auto z-10 py-2">
        <div className="bg-slate-900/90 border-2 border-indigo-500/30 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center">
          {/* Title / Mode Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4">
            {isBlindMosaic ? (
              <>
                <Scissors className="w-3.5 h-3.5 text-pink-400" />
                <span>Режим: Слепая мозаика 🎭</span>
              </>
            ) : (
              <>
                <Palette className="w-3.5 h-3.5 text-emerald-400" />
                <span>Режим: Классика 🎨</span>
              </>
            )}
          </div>

          {/* QR Code */}
          <div className="mb-4">
            <QRCodeDisplay roomId={roomId} size={180} />
          </div>

          {/* Connected Players List */}
          <div className="w-full border-t border-slate-800 pt-4 mb-5 text-left">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Игроки в комнате ({activePlayers.length})
              </span>
              {isBlindMosaic && (
                <span className="text-[10px] text-indigo-300 font-semibold">Распределение по частям</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
              {activePlayers.map((player) => {
                const isCurrentHost = room?.hostId === player.id;
                const isMe = player.id === myPlayerId;
                const sectorTitle = (isBlindMosaic && player.teamSector !== undefined)
                  ? room!.mosaicConfig!.sectorTitles[player.teamSector] || `Часть ${player.teamSector + 1}`
                  : null;

                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-200"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full ring-2 ring-white/20 shadow-sm shrink-0"
                        style={{ backgroundColor: player.color }}
                      />
                      <span className="font-semibold text-white truncate max-w-[120px]">
                        {player.nickname}
                      </span>
                      {isMe && (
                        <span className="text-[10px] text-indigo-400 font-mono font-bold">(Вы)</span>
                      )}
                      {isCurrentHost && (
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                    </div>

                    {/* Team Sector Badge */}
                    {isBlindMosaic && sectorTitle && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-600/50 text-indigo-300 shrink-0">
                        {sectorTitle}
                      </span>
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
              <span>Начать игру</span>
            </button>
          ) : (
            <div className="w-full py-3.5 px-4 bg-slate-800/60 rounded-2xl border border-slate-700/50 flex items-center justify-center gap-2.5 text-slate-300 text-xs font-semibold">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Ожидание хоста для старта игры...</span>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-2xl text-center z-10 py-2 border-t border-slate-900 text-xs text-slate-400">
        Комната: <span className="font-mono font-bold text-amber-400">{roomId}</span> &bull; Поделитесь QR-кодом
      </footer>
    </div>
  );
};
