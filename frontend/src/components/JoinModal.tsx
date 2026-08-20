import React, { useState, useEffect } from 'react';
import { useUIStore } from '../stores/uiStore.js';
import { usePlayerStore } from '../stores/playerStore.js';
import { socketClient } from '../socket/socketClient.js';
import { validateNickname } from '@pixel-party/shared';
import { ArrowRight, Palette } from 'lucide-react';

interface JoinModalProps {
  roomId: string;
}

export const JoinModal: React.FC<JoinModalProps> = ({ roomId }) => {
  const { isJoinModalOpen } = useUIStore();
  const { nickname: storedNickname, myPlayerId } = usePlayerStore();
  const [nicknameInput, setNicknameInput] = useState(storedNickname || '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (storedNickname) {
      setNicknameInput(storedNickname);
    }
  }, [storedNickname]);

  if (!isJoinModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateNickname(nicknameInput);
    if (!validation.valid) {
      setError(validation.error || 'Invalid nickname');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    socketClient.joinRoom(roomId, nicknameInput.trim(), myPlayerId || undefined);

    // Timeout reset
    setTimeout(() => setIsSubmitting(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl text-indigo-400">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Join Room</h2>
            <p className="text-xs text-indigo-300 font-mono">ROOM: {roomId}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              What's your nickname?
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                maxLength={16}
                value={nicknameInput}
                onChange={(e) => {
                  setNicknameInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Alex, PixelCat, Max"
                className="w-full px-4 py-3.5 bg-slate-950/80 border-2 border-slate-700 focus:border-indigo-500 rounded-2xl text-white placeholder-slate-500 font-medium text-base outline-none transition-all shadow-inner"
              />
              <span className="absolute right-3.5 top-3.5 text-xs text-slate-500 font-mono">
                {nicknameInput.trim().length}/16
              </span>
            </div>
            {error && <p className="mt-2 text-xs font-medium text-rose-400">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || nicknameInput.trim().length < 2}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/25 transition-all transform active:scale-98 text-sm uppercase tracking-wider"
          >
            <span>{isSubmitting ? 'Joining...' : 'Enter Canvas'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
          Draw in realtime with your friends! 🚀
        </div>
      </div>
    </div>
  );
};
