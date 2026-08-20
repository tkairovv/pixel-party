import React from 'react';
import { useUIStore, ToastMessage } from '../stores/uiStore.js';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: () => void }> = ({ toast, onRemove }) => {
  const icons = {
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
  };

  const borderColors = {
    info: 'border-blue-500/40 bg-slate-900/95',
    success: 'border-emerald-500/40 bg-slate-900/95',
    warning: 'border-amber-500/40 bg-slate-900/95',
    error: 'border-rose-500/40 bg-slate-900/95',
  };

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border ${borderColors[toast.type]} shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-3`}
    >
      <div className="flex items-center gap-2.5">
        {icons[toast.type]}
        <span className="text-sm font-medium text-slate-100">{toast.message}</span>
      </div>
      <button
        onClick={onRemove}
        className="p-1 text-slate-400 hover:text-slate-200 transition-colors rounded-md"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
