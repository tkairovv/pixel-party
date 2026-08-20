import React from 'react';
import { useUIStore } from '../stores/uiStore.js';
import { RefreshCw, WifiOff } from 'lucide-react';

export const ConnectionBanner: React.FC = () => {
  const { connectionStatus } = useUIStore();

  if (connectionStatus === 'connected') return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600/90 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 backdrop-blur shadow-md">
      {connectionStatus === 'reconnecting' ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Connection lost. Trying to reconnect...</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          <span>Disconnected from server. Retrying...</span>
        </>
      )}
    </div>
  );
};
