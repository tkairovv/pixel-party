import { io, Socket } from 'socket.io-client';
import {
  PixelUpdate,
  CanvasSyncResponse,
  RoomStatePayload,
  Player,
  GameStatusPayload,
  CanvasClearedPayload,
  AppErrorPayload,
  PixelBatchItem,
} from '@pixel-party/shared';
import { useRoomStore } from '../stores/roomStore.js';
import { usePlayerStore } from '../stores/playerStore.js';
import { useCanvasStore } from '../stores/canvasStore.js';
import { useUIStore } from '../stores/uiStore.js';

class SocketClient {
  private socket: Socket | null = null;
  private currentRoomId: string | null = null;

  public init(): Socket {
    if (this.socket) return this.socket;

    // Use current origin in browser (proxied by Vite in dev) or explicit env
    const socketUrl = (import.meta as any).env?.VITE_BACKEND_URL || window.location.origin;

    this.socket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.setupListeners();
    return this.socket;
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      useUIStore.getState().setConnectionStatus('connected');

      // If we were in a room, perform automatic resync
      if (this.currentRoomId) {
        const { myPlayerId, nickname } = usePlayerStore.getState();
        if (nickname) {
          // Re-join session
          this.joinRoom(this.currentRoomId, nickname, myPlayerId || undefined);
        }
      }
    });

    this.socket.on('disconnect', () => {
      useUIStore.getState().setConnectionStatus('disconnected');
    });

    this.socket.on('connect_error', () => {
      useUIStore.getState().setConnectionStatus('reconnecting');
    });

    // Room State received upon join
    this.socket.on('room:state', (payload: RoomStatePayload) => {
      const { room, players, isHost, myPlayerId, snapshot } = payload;
      this.currentRoomId = room.id;

      useRoomStore.getState().setRoom(room, isHost);
      useRoomStore.getState().setPlayers(players);

      const myPlayer = players.find((p) => p.id === myPlayerId);
      if (myPlayer) {
        usePlayerStore.getState().setMyPlayer(myPlayer.id, myPlayer.nickname, myPlayer.color);
      }

      useCanvasStore.getState().applySnapshot(snapshot);
      useUIStore.getState().setJoinModalOpen(false);
    });

    // Player joined
    this.socket.on('player:joined', (player: Player) => {
      useRoomStore.getState().addPlayer(player);
      useUIStore.getState().showToast(`${player.nickname} joined the party!`, 'info');
    });

    // Player list updated (connected status or pixel count changed)
    this.socket.on('players:updated', (players: Player[]) => {
      useRoomStore.getState().setPlayers(players);
    });

    // Single Authoritative Pixel Update
    this.socket.on('pixel:updated', (update: PixelUpdate) => {
      const { lastAppliedSeq } = useCanvasStore.getState();

      // Check for sequence gaps
      if (update.seq > lastAppliedSeq + 1 && lastAppliedSeq > 0) {
        // Gap detected! Request delta resync
        if (this.currentRoomId) {
          this.syncCanvas(this.currentRoomId, lastAppliedSeq);
        }
      }

      useCanvasStore.getState().applyUpdate(update);
    });

    // Batch Authoritative Updates
    this.socket.on('pixel:batch_updated', (updates: PixelUpdate[]) => {
      const { lastAppliedSeq } = useCanvasStore.getState();
      if (updates.length > 0 && updates[0].seq > lastAppliedSeq + 1 && lastAppliedSeq > 0) {
        if (this.currentRoomId) {
          this.syncCanvas(this.currentRoomId, lastAppliedSeq);
        }
      }
      useCanvasStore.getState().applyBatchUpdates(updates);
    });

    // Canvas Delta / Snapshot Sync Response
    this.socket.on('canvas:sync_response', (res: CanvasSyncResponse) => {
      if (res.type === 'snapshot' && res.snapshot) {
        useCanvasStore.getState().applySnapshot(res.snapshot);
      } else if (res.type === 'delta' && res.updates) {
        useCanvasStore.getState().applyBatchUpdates(res.updates);
      }
    });

    // Game Started
    this.socket.on('game:started', (payload: GameStatusPayload) => {
      useRoomStore.getState().setStatus(payload.status);
      useUIStore.getState().showToast('The game has started! Start drawing! 🎨', 'success');
    });

    // Game Finished
    this.socket.on('game:finished', (payload: GameStatusPayload) => {
      useRoomStore.getState().setStatus(payload.status);
      useUIStore.getState().showToast('Game finished! Check out the final art! 🏆', 'success');
    });

    // Canvas Cleared
    this.socket.on('canvas:cleared', (payload: CanvasClearedPayload) => {
      useCanvasStore.getState().clearCanvasState(payload.seq);
      useUIStore.getState().showToast('Canvas was cleared by the host', 'warning');
    });

    // Errors
    this.socket.on('error', (payload: AppErrorPayload) => {
      useUIStore.getState().showToast(payload.message || 'Something went wrong', 'error');
    });
  }

  public joinRoom(roomId: string, nickname: string, playerId?: string): void {
    this.currentRoomId = roomId;
    this.init().emit('room:join', { roomId, nickname, playerId });
  }

  public leaveRoom(roomId: string): void {
    this.currentRoomId = null;
    this.init().emit('room:leave', { roomId });
  }

  public drawPixel(roomId: string, x: number, y: number, color: string, operationId: string): void {
    this.init().emit('pixel:draw', { roomId, x, y, color, operationId });
  }

  public erasePixel(roomId: string, x: number, y: number, operationId: string): void {
    this.init().emit('pixel:erase', { roomId, x, y, operationId });
  }

  public drawBatch(roomId: string, operationId: string, pixels: PixelBatchItem[]): void {
    this.init().emit('pixel:batch', { roomId, operationId, pixels });
  }

  public syncCanvas(roomId: string, lastAppliedSeq: number): void {
    this.init().emit('canvas:sync', { roomId, lastAppliedSeq });
  }

  public startGame(roomId: string): void {
    this.init().emit('game:start', { roomId });
  }

  public finishGame(roomId: string): void {
    this.init().emit('game:finish', { roomId });
  }

  public clearCanvas(roomId: string): void {
    this.init().emit('canvas:clear', { roomId });
  }
}

export const socketClient = new SocketClient();
