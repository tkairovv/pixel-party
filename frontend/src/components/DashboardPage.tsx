import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { listRooms, deleteRoom, rehydrateRoom, createRoom } from '../api.js';
import type { RoomRecord } from '@pixel-party/shared';
import {
  Paintbrush,
  Plus,
  LogOut,
  Trash2,
  ExternalLink,
  Loader2,
  LayoutGrid,
  CalendarDays,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
  onNavigateRoom: (roomId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onNavigateRoom }) => {
  const { user, session, signOut, loading: authLoading } = useAuthStore();
  const { showToast } = useUIStore();
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const token = session?.access_token;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setRooms(await listRooms(token));
    } catch (err: any) {
      showToast(err.message || 'Не удалось загрузить комнаты', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('/auth');
    }
  }, [authLoading, user, onNavigate]);

  const handleCreate = async () => {
    if (!token) return;
    setCreating(true);
    try {
      const data = await createRoom(token, {
        width: 64,
        height: 64,
        gameMode: 'blind_mosaic',
        mosaicConfig: {
          sectorsCount: 3,
          sectorTitles: ['Голова 🎩', 'Туловище 👕', 'Ноги 👖'],
          direction: 'horizontal',
          roundDurationSeconds: 0,
        },
      });
      localStorage.setItem(`pixel_party_host_${data.roomId}`, data.hostId);
      onNavigateRoom(data.roomId);
    } catch (err: any) {
      showToast(err.message || 'Не удалось создать комнату', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleOpen = async (room: RoomRecord) => {
    if (!token) return;
    setOpeningId(room.id);
    try {
      const data = await rehydrateRoom(room.id, token);
      localStorage.setItem(`pixel_party_host_${room.id}`, data.hostId);
      onNavigateRoom(data.roomId);
    } catch (err: any) {
      showToast(err.message || 'Не удалось открыть комнату', 'error');
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async (room: RoomRecord) => {
    if (!token) return;
    if (!window.confirm(`Удалить комнату ${room.id}? Это действие нельзя отменить.`)) return;
    try {
      await deleteRoom(room.id, token);
      showToast(`Комната ${room.id} удалена`, 'success');
      load();
    } catch (err: any) {
      showToast(err.message || 'Не удалось удалить комнату', 'error');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onNavigate('/');
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const modeLabel = (mode: string) => (mode === 'blind_mosaic' ? 'Слепая мозаика 🎭' : 'Классика 🎨');

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col items-center p-3 sm:p-8 relative overflow-x-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-3xl flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Paintbrush className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-extrabold tracking-wider text-base bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-pink-400">
              PIXEL PARTY
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-widest">Дашборд</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <span className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 max-w-[180px] truncate">
              {user.email}
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="w-full max-w-3xl my-4 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Мои комнаты</h2>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-60 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all active:scale-95 text-xs"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Создать комнату
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-sm">Загружаем комнаты...</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="p-10 bg-slate-900/80 border border-dashed border-slate-700 rounded-3xl text-center">
            <LayoutGrid className="w-8 h-8 text-indigo-400 mx-auto mb-3" />
            <p className="text-sm text-slate-300 font-semibold mb-1">Пока нет комнат</p>
            <p className="text-xs text-slate-500 mb-4">Создайте первую комнату и пригласите друзей по QR-коду</p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" />
              Создать комнату
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rooms.map((room) => (
              <div key={room.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-amber-400 tracking-wider text-lg">{room.id}</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                    {modeLabel(room.game_mode)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <LayoutGrid className="w-3 h-3" />
                    {room.width}×{room.height}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {formatDate(room.created_at)}
                  </span>
                </div>

                <div className="flex gap-2 mt-auto pt-1">
                  <button
                    onClick={() => handleOpen(room)}
                    disabled={openingId === room.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all"
                  >
                    {openingId === room.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ExternalLink className="w-3.5 h-3.5" />
                    )}
                    Открыть
                  </button>
                  <button
                    onClick={() => handleDelete(room)}
                    className="px-3 py-2 bg-slate-800 hover:bg-rose-600/20 border border-slate-700 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 rounded-xl transition-all"
                    title="Удалить"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
