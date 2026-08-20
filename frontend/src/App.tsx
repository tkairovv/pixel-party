import { useState, useEffect } from 'react';
import { useRoomStore } from './stores/roomStore.js';
import { usePlayerStore } from './stores/playerStore.js';
import { useUIStore } from './stores/uiStore.js';
import { socketClient } from './socket/socketClient.js';
import { HomePage } from './components/HomePage.js';
import { LobbyPage } from './components/LobbyPage.js';
import { GamePage } from './components/GamePage.js';
import { JoinModal } from './components/JoinModal.js';
import { ToastContainer } from './components/Toast.js';
import { ConnectionBanner } from './components/ConnectionBanner.js';

export function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const { room } = useRoomStore();
  const { myPlayerId, nickname } = usePlayerStore();
  const { setJoinModalOpen } = useUIStore();

  // Initialize socket client
  useEffect(() => {
    socketClient.init();
  }, []);

  // Listen to browser navigation (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Parse room ID from path: /room/:roomId
  const roomMatch = currentPath.match(/^\/room\/([a-zA-Z0-9_-]+)/);
  const urlRoomId = roomMatch ? roomMatch[1].toUpperCase() : null;

  useEffect(() => {
    if (urlRoomId) {
      const hostPlayerId = localStorage.getItem(`pixel_party_host_${urlRoomId}`) || myPlayerId || undefined;
      // If we haven't joined the room or don't have our player registered yet, prompt join modal
      if (!myPlayerId || !nickname || room?.id !== urlRoomId) {
        setJoinModalOpen(true);
        // Auto-join if we already have stored credentials
        if (nickname) {
          socketClient.joinRoom(urlRoomId, nickname, hostPlayerId);
        }
      }
    }
  }, [urlRoomId, myPlayerId, nickname, room?.id, setJoinModalOpen]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <ConnectionBanner />
      <ToastContainer />

      {!urlRoomId && (
        <HomePage onNavigateRoom={(roomId) => navigateTo(`/room/${roomId}`)} />
      )}

      {urlRoomId && (
        <>
          <JoinModal roomId={urlRoomId} />

          {room?.status === 'waiting' ? (
            <LobbyPage roomId={urlRoomId} />
          ) : (
            <GamePage roomId={urlRoomId} />
          )}
        </>
      )}
    </div>
  );
}

export default App;
