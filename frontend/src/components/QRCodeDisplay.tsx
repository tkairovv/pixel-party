import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check } from 'lucide-react';
import { useUIStore } from '../stores/uiStore.js';

interface QRCodeDisplayProps {
  roomId: string;
  size?: number;
  showUrl?: boolean;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  roomId,
  size = 200,
  showUrl = true,
}) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useUIStore();

  const joinUrl = `${window.location.origin}/room/${roomId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      showToast('Link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Could not copy link', 'error');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="p-4 bg-white rounded-2xl shadow-2xl border-4 border-indigo-500/30 flex items-center justify-center">
        <QRCodeSVG
          value={joinUrl}
          size={size}
          level="M"
          includeMargin={false}
          imageSettings={{
            src: '/favicon.svg',
            x: undefined,
            y: undefined,
            height: 32,
            width: 32,
            excavate: true,
          }}
        />
      </div>

      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-1">
          Room Code
        </div>
        <div className="text-3xl font-extrabold tracking-widest text-amber-400 font-mono">
          {roomId}
        </div>
      </div>

      {showUrl && (
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold transition-all active:scale-95 shadow-md"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied!' : 'Copy Invite Link'}</span>
        </button>
      )}
    </div>
  );
};
