import React from 'react';
import { useRoomStore } from '../stores/roomStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { socketClient } from '../socket/socketClient.js';
import {
  Paintbrush,
  QrCode,
  Users,
  Flag,
  Scissors,
  Crown,
} from 'lucide-react';

interface GameHeaderProps {
  roomId: string;
}

export const GameHeader: React.FC<GameHeaderProps> = ({ roomId }) => {
  const { room, players, isHost: isHostStore, isHostSpectator } = useRoomStore();
  const {
    setQRModalOpen,
    setPlayersDrawerOpen,
  } = useUIStore();

  const isHost = isHostStore || isHostSpectator;
  const isBlindMosaic = room?.gameMode === 'blind_mosaic';

  const handleFinishGame = () => {
    const confirmMsg = isBlindMosaic
      ? 'Завершить рисование и перейти к раскрытию мозаики?'
      : 'Завершить игру и зафиксировать шедевр?';

    if (window.confirm(confirmMsg)) {
      socketClient.finishGame(roomId);
    }
  };

  const activePlayers = players.filter((p) => p.connected && !p.isHostSpectator);

  return (
    <header className="w-full bg-slate-900/90 border-b border-slate-800 px-3 sm:px-4 py-2.5 flex items-center justify-between z-20 backdrop-blur-md shrink-0">
      {/* Left: Brand & Room ID */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-pink-600 flex items-center justify-center shadow-md shadow-indigo-600/30">
            <Paintbrush className="w-4 h-4 text-white" />
          </div>
          <span className="hidden sm:inline font-extrabold tracking-wider text-base bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-pink-400">
            PIXEL PARTY
          </span>
        </div>

        {/* Room badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs">
          <span className="text-slate-400 font-semibold hidden xs:inline">КОД:</span>
          <span className="text-amber-400 font-bold tracking-wider">{roomId}</span>
        </div>

        {/* Spectator Host Badge */}
        {isHostSpectator && (
          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
            <Crown className="w-3 h-3 text-amber-400" />
            <span>Главный экран</span>
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* QR Code Modal Button */}
        <button
          type="button"
          onClick={() => setQRModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-sm"
          title="Показать QR-код"
        >
          <QrCode className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">QR-код</span>
        </button>

        {/* Mobile Players Drawer Button */}
        <button
          type="button"
          onClick={() => setPlayersDrawerOpen(true)}
          className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all"
        >
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span>{activePlayers.length}</span>
        </button>

        {/* Host Game Actions */}
        {isHost && room?.status === 'playing' && (
          <button
            type="button"
            onClick={handleFinishGame}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-600 via-purple-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-rose-600/20 active:scale-95"
          >
            {isBlindMosaic ? <Scissors className="w-3.5 h-3.5" /> : <Flag className="w-3.5 h-3.5" />}
            <span>{isBlindMosaic ? 'Вскрыть мозаику 🎭' : 'Завершить раунд'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
