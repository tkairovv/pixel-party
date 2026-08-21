import React, { useState } from 'react';
import { Sparkles, Plus, ArrowRight, Paintbrush, Scissors, Palette, LogIn, LayoutDashboard } from 'lucide-react';
import { useUIStore } from '../stores/uiStore.js';
import { useAuthStore } from '../stores/authStore.js';
import { createRoom } from '../api.js';
import { GameMode, MosaicConfig } from '@pixel-party/shared';

interface HomePageProps {
  onNavigateRoom: (roomId: string) => void;
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigateRoom, onNavigate }) => {
  const [joinCode, setJoinCode] = useState('');
  const [selectedSize, setSelectedSize] = useState<number>(64);
  const [gameMode, setGameMode] = useState<GameMode>('blind_mosaic');
  const [sectorsCount, setSectorsCount] = useState<number>(3);
  const [isCreating, setIsCreating] = useState(false);
  const { showToast } = useUIStore();
  const { user, session, signOut } = useAuthStore();

  const handleCreateRoom = async () => {
    if (!session?.access_token) {
      showToast('Войдите в аккаунт, чтобы создать комнату', 'warning');
      onNavigate('/auth');
      return;
    }

    try {
      setIsCreating(true);

      const mosaicConfig: MosaicConfig | undefined = gameMode === 'blind_mosaic' ? {
        sectorsCount,
        sectorTitles: sectorsCount === 3
          ? ['Голова 🎩', 'Туловище 👕', 'Ноги 👖']
          : sectorsCount === 2
          ? ['Верхняя часть ⬆️', 'Нижняя часть ⬇️']
          : ['Сектор 1 ↖️', 'Сектор 2 ↗️', 'Сектор 3 ↙️', 'Сектор 4 ↘️'],
        direction: sectorsCount === 4 ? 'grid' : 'horizontal',
        roundDurationSeconds: 0,
      } : undefined;

      const data = await createRoom(session.access_token, {
        width: selectedSize,
        height: selectedSize,
        gameMode,
        mosaicConfig,
      });

      localStorage.setItem('pixel_party_player_id', data.hostId);
      localStorage.setItem(`pixel_party_host_${data.roomId}`, data.hostId);
      onNavigateRoom(data.roomId);
    } catch (err: any) {
      showToast(err.message || 'Error creating room', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    if (cleanCode.length < 4) {
      showToast('Please enter a valid room code', 'warning');
      return;
    }
    onNavigateRoom(cleanCode);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-3 sm:p-8 relative overflow-x-hidden overflow-y-auto">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-4xl flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Paintbrush className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold tracking-wider text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-pink-400">
              PIXEL PARTY
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-widest">
              Multiplayer Canvas
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Realtime
          </span>

          {user ? (
            <>
              <button
                onClick={() => onNavigate('/dashboard')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-all"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden md:inline">Дашборд</span>
              </button>
              <button
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all"
                title={user.email || ''}
              >
                <span className="hidden sm:inline max-w-[120px] truncate">{user.email}</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => onNavigate('/auth')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Войти</span>
            </button>
          )}
        </div>
      </header>

      {/* Hero Content */}
      <main className="w-full max-w-2xl my-auto text-center z-10 py-4 sm:py-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Multiplayer Pixel-Art Party Game</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-3 text-white leading-tight">
          Рисуйте вместе в{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            Realtime
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto mb-5 leading-relaxed font-medium">
          Создайте комнату, отсканируйте QR-код с телефона и устройте взрывной творческий вечер с друзьями!
        </p>

        {/* Game Mode Selector Card */}
        <div className="max-w-lg mx-auto mb-4 p-3 bg-slate-900/90 border-2 border-indigo-500/30 rounded-2xl text-left space-y-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2 px-1">
              Выберите режим игры:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGameMode('blind_mosaic')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  gameMode === 'blind_mosaic'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs mb-1 text-indigo-300">
                  <Scissors className="w-4 h-4 text-pink-400" />
                  <span>Слепая мозаика 🎭</span>
                </div>
                <span className="text-[11px] text-slate-300 block leading-snug">
                  Холст делится на тайные части (Голова/Тело/Ноги) с фееричным вскрытием!
                </span>
              </button>

              <button
                type="button"
                onClick={() => setGameMode('classic')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  gameMode === 'classic'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs mb-1 text-indigo-300">
                  <Palette className="w-4 h-4 text-emerald-400" />
                  <span>Классика 🎨</span>
                </div>
                <span className="text-[11px] text-slate-300 block leading-snug">
                  Все рисуют на одном общем открытом холсте в реальном времени.
                </span>
              </button>
            </div>
          </div>

          {/* Sector Count Selector (if Blind Mosaic) */}
          {gameMode === 'blind_mosaic' && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-400">Части мозаики:</span>
              <div className="flex gap-1.5">
                {[
                  { count: 3, label: '3 (Голова/Тело/Ноги)' },
                  { count: 2, label: '2 (Верх/Низ)' },
                  { count: 4, label: '4 (Квадранты)' },
                ].map((item) => (
                  <button
                    key={item.count}
                    type="button"
                    onClick={() => setSectorsCount(item.count)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      sectorsCount === item.count
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grid Size Row */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-400">Размер холста:</span>
            <div className="flex gap-1.5">
              {[32, 64, 128].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    selectedSize === size
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {size}×{size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto mb-8">
          {/* Create Room Button */}
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="flex flex-col items-center justify-center p-5 bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-98 rounded-3xl shadow-xl shadow-indigo-600/30 border border-indigo-400/30 transition-all group text-left"
          >
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <span className="text-base font-bold text-white mb-0.5">
              {isCreating ? 'Создание...' : 'Создать комнату'}
            </span>
            <span className="text-[11px] text-indigo-200">Получить QR-код для друзей</span>
          </button>

          {/* Join Room Form */}
          <div className="p-5 bg-slate-900/90 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between">
            <div className="text-left mb-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                Есть код комнаты?
              </span>
              <span className="text-xs font-semibold text-slate-200">Войти в игру</span>
            </div>

            <form onSubmit={handleJoinByCode} className="space-y-2.5">
              <input
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="w-full text-center tracking-widest uppercase font-mono font-bold text-base px-3 py-2 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl text-amber-400 placeholder-slate-600 outline-none transition-all"
              />
              <button
                type="submit"
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all border border-slate-700"
              >
                <span>Войти</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center z-10 py-2 border-t border-slate-900 text-xs text-slate-400">
        Pixel Party &bull; Realtime Collaborative Canvas &bull; Blind Mosaic Mode
      </footer>
    </div>
  );
};
