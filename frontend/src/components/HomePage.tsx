import React, { useState } from 'react';
import { Sparkles, Plus, ArrowRight, Paintbrush } from 'lucide-react';
import { useUIStore } from '../stores/uiStore.js';

interface HomePageProps {
  onNavigateRoom: (roomId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigateRoom }) => {
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { showToast } = useUIStore();

  const handleCreateRoom = async () => {
    try {
      setIsCreating(true);
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ width: 64, height: 64 }),
      });

      if (!res.ok) {
        throw new Error('Failed to create room');
      }

      const data = await res.json();
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-8 relative overflow-hidden">
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
            <span className="font-extrabold tracking-wider text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              PIXEL PARTY
            </span>
            <span className="block text-[10px] text-slate-400 font-mono tracking-widest uppercase">
              Realtime Canvas
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-semibold text-indigo-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Realtime Canvas 64×64</span>
        </div>
      </header>

      {/* Hero Content */}
      <main className="w-full max-w-2xl my-auto text-center z-10 py-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Multiplayer Pixel-Art Party Game</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4 text-white leading-tight">
          Draw Together in{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            Realtime
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-lg mx-auto mb-10 leading-relaxed font-medium">
          Create a room, share the QR code with your friends on phone or desktop, and draw on a shared canvas with full pixel ownership and player filtering!
        </p>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto mb-12">
          {/* Create Room Button */}
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-98 rounded-3xl shadow-xl shadow-indigo-600/30 border border-indigo-400/30 transition-all group text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <span className="text-lg font-bold text-white mb-1">
              {isCreating ? 'Creating...' : 'Create Room'}
            </span>
            <span className="text-xs text-indigo-200">Get QR code & invite friends</span>
          </button>

          {/* Join Room Form */}
          <div className="p-6 bg-slate-900/90 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between">
            <div className="text-left mb-3">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block mb-1">
                Have a code?
              </span>
              <span className="text-sm font-semibold text-slate-200">Join Existing Room</span>
            </div>

            <form onSubmit={handleJoinByCode} className="space-y-3">
              <input
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="w-full text-center tracking-widest uppercase font-mono font-bold text-base px-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl text-amber-400 placeholder-slate-600 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={joinCode.trim().length < 3}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              >
                <span>Join Game</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* 3 Step Instruction */}
        <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto pt-6 border-t border-slate-800/80">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-xl bg-indigo-950/80 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-1 text-xs font-bold font-mono">
              1
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">SCAN</span>
            <span className="text-[11px] text-slate-400">QR Code</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-xl bg-purple-950/80 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-1 text-xs font-bold font-mono">
              2
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">JOIN</span>
            <span className="text-[11px] text-slate-400">Enter Nickname</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-xl bg-pink-950/80 border border-pink-500/30 text-pink-400 flex items-center justify-center mb-1 text-xs font-bold font-mono">
              3
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">DRAW</span>
            <span className="text-[11px] text-slate-400">Realtime Fun</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center py-4 text-xs text-slate-500 z-10">
        Pixel Party MVP &bull; Server-Authoritative LWW Realtime Sync
      </footer>
    </div>
  );
};
