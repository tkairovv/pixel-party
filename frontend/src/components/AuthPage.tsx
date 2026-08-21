import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore.js';
import { Paintbrush, Mail, Lock, ArrowLeft, Loader2, LogIn, UserPlus } from 'lucide-react';

interface AuthPageProps {
  onNavigate: (path: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onNavigate }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn, signUp } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Заполните email и пароль');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }
    setBusy(true);
    const res = mode === 'signin' ? await signIn(cleanEmail, password) : await signUp(cleanEmail, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onNavigate('/dashboard');
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm z-10">
        <button
          onClick={() => onNavigate('/')}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </button>

        <div className="bg-slate-900/90 border-2 border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Paintbrush className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-pink-400">
                {mode === 'signin' ? 'Вход' : 'Регистрация'}
              </h1>
              <p className="text-[11px] text-slate-400">
                {mode === 'signin' ? 'Войдите, чтобы управлять комнатами' : 'Создайте аккаунт создателя'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/70 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(''); }}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${mode === 'signin' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); }}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${mode === 'signup' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Пароль</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-60 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all active:scale-98 text-sm"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'signin' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {mode === 'signin' ? 'Войти' : 'Создать аккаунт'}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 mt-4 text-center leading-relaxed">
            Аккаунт нужен только создателям комнат. Игроки подключаются по коду без регистрации.
          </p>
        </div>
      </div>
    </div>
  );
};
