import { useState, useEffect } from 'react';
import { useRoomStore } from './stores/roomStore.js';
import { usePlayerStore } from './stores/playerStore.js';
import { useUIStore } from './stores/uiStore.js';
import { useAuthStore } from './stores/authStore.js';
import { socketClient } from './socket/socketClient.js';
import { HomePage } from './components/HomePage.js';
import { LobbyPage } from './components/LobbyPage.js';
import { GamePage } from './components/GamePage.js';
import { JoinModal } from './components/JoinModal.js';
import { AuthPage } from './components/AuthPage.js';
import { DashboardPage } from './components/DashboardPage.js';
import { ToastContainer } from './components/Toast.js';
import { ConnectionBanner } from './components/ConnectionBanner.js';

export function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const { room } = useRoomStore();
  const { myPlayerId, nickname } = usePlayerStore();
  const { setJoinModalOpen } = useUIStore();
  const { init: initAuth } = useAuthStore();

  // Initialize socket client + auth session
  useEffect(() => {
    socketClient.init();
    initAuth();
  }, [initAuth]);

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
  const isAuth = currentPath.startsWith('/auth');
  const isDashboard = currentPath.startsWith('/dashboard');

  useEffect(() => {
    if (urlRoomId) {
      const hostToken = localStorage.getItem(`pixel_party_host_${urlRoomId}`);
      if (hostToken) {
        // We are the creator / host screen of this room
        setJoinModalOpen(false);
        socketClient.joinAsHost(urlRoomId, hostToken);
      } else {
        // We are a player joining from phone or browser
        if (!myPlayerId || !nickname || room?.id !== urlRoomId) {
          setJoinModalOpen(true);
          if (nickname) {
            socketClient.joinRoom(urlRoomId, nickname, myPlayerId || undefined);
          }
        }
      }
    }
  }, [urlRoomId, myPlayerId, nickname, room?.id, setJoinModalOpen]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <ConnectionBanner />
      <ToastContainer />

      {isAuth && <AuthPage onNavigate={navigateTo} />}

      {isDashboard && (
        <DashboardPage onNavigate={navigateTo} onNavigateRoom={(roomId) => navigateTo(`/room/${roomId}`)} />
      )}

      {!urlRoomId && !isAuth && !isDashboard && (
        <HomePage onNavigateRoom={(roomId) => navigateTo(`/room/${roomId}`)} onNavigate={navigateTo} />
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
