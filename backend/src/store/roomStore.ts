import {
  Room,
  Player,
  PixelState,
  PixelUpdate,
  PixelBatchItem,
  CanvasSnapshot,
  CanvasSyncResponse,
  RoomStatus,
} from '@pixel-party/shared';
import {
  INITIAL_ROOM_SEQUENCE,
  OPERATION_HISTORY_LIMIT,
  PLAYER_COLORS,
} from '@pixel-party/shared';
import {
  generateRoomId,
  generatePlayerId,
  pixelKey,
  validateNickname,
  isValidCoordinate,
} from '@pixel-party/shared';
import { config } from '../config.js';

interface InternalRoomData {
  room: Room;
  players: Map<string, Player>;
  socketToPlayer: Map<string, string>; // socketId -> playerId
  playerToSocket: Map<string, string>; // playerId -> socketId
  pixels: Map<string, PixelState>;     // "x:y" -> PixelState
  operationLog: PixelUpdate[];         // Sliding window
  recentOperations: Map<string, { seq: number; appliedAt: number; updates: PixelUpdate[] }>; // operationId -> result
  pixelStats: Map<string, number>;     // playerId -> count
}

export class RoomStore {
  private rooms = new Map<string, InternalRoomData>();

  public createRoom(options?: { width?: number; height?: number }): { room: Room; hostId: string } {
    let roomId = generateRoomId();
    while (this.rooms.has(roomId)) {
      roomId = generateRoomId();
    }

    const hostId = generatePlayerId();
    const width = options?.width || config.canvasWidth;
    const height = options?.height || config.canvasHeight;

    const room: Room = {
      id: roomId,
      hostId,
      status: 'waiting',
      sequence: INITIAL_ROOM_SEQUENCE,
      width,
      height,
      createdAt: Date.now(),
    };

    const roomData: InternalRoomData = {
      room,
      players: new Map(),
      socketToPlayer: new Map(),
      playerToSocket: new Map(),
      pixels: new Map(),
      operationLog: [],
      recentOperations: new Map(),
      pixelStats: new Map(),
    };

    this.rooms.set(roomId, roomData);
    return { room, hostId };
  }

  public getRoom(roomId: string): Room | null {
    const data = this.rooms.get(roomId);
    return data ? { ...data.room } : null;
  }

  public getRoomData(roomId: string): InternalRoomData | null {
    return this.rooms.get(roomId) || null;
  }

  public joinPlayer(
    roomId: string,
    nickname: string,
    socketId: string,
    existingPlayerId?: string
  ): { player: Player; isHost: boolean; isReconnect: boolean } | { error: string } {
    const roomData = this.rooms.get(roomId);
    if (!roomData) {
      return { error: 'Room not found' };
    }

    const trimmedNickname = nickname.trim();
    const validation = validateNickname(trimmedNickname);
    if (!validation.valid) {
      return { error: validation.error || 'Invalid nickname' };
    }

    // Check if this is a reconnecting player
    if (existingPlayerId && roomData.players.has(existingPlayerId)) {
      const player = roomData.players.get(existingPlayerId)!;
      player.connected = true;
      player.nickname = trimmedNickname; // allow updating if desired

      // Update socket mappings
      const oldSocket = roomData.playerToSocket.get(existingPlayerId);
      if (oldSocket) {
        roomData.socketToPlayer.delete(oldSocket);
      }
      roomData.socketToPlayer.set(socketId, existingPlayerId);
      roomData.playerToSocket.set(existingPlayerId, socketId);

      return {
        player: { ...player, pixelCount: roomData.pixelStats.get(existingPlayerId) || 0 },
        isHost: roomData.room.hostId === existingPlayerId,
        isReconnect: true,
      };
    }

    // Check nickname collision among currently active/connected players
    for (const p of roomData.players.values()) {
      if (p.connected && p.nickname.toLowerCase() === trimmedNickname.toLowerCase()) {
        return { error: `Nickname "${trimmedNickname}" is already taken in this room` };
      }
    }

    // Allocate player ID and unique color
    const playerId = existingPlayerId || generatePlayerId();
    const colorIndex = roomData.players.size % PLAYER_COLORS.length;
    const color = PLAYER_COLORS[colorIndex];

    const player: Player = {
      id: playerId,
      nickname: trimmedNickname,
      color,
      connected: true,
      joinedAt: Date.now(),
      pixelCount: 0,
    };

    roomData.players.set(playerId, player);
    roomData.socketToPlayer.set(socketId, playerId);
    roomData.playerToSocket.set(playerId, socketId);
    roomData.pixelStats.set(playerId, 0);

    // If hostId hasn't claimed a profile yet, assign host
    const isHost = roomData.room.hostId === playerId;

    return {
      player: { ...player },
      isHost,
      isReconnect: false,
    };
  }

  public disconnectSocket(socketId: string): { roomId: string; player: Player } | null {
    for (const [roomId, roomData] of this.rooms.entries()) {
      const playerId = roomData.socketToPlayer.get(socketId);
      if (playerId) {
        roomData.socketToPlayer.delete(socketId);
        roomData.playerToSocket.delete(playerId);

        const player = roomData.players.get(playerId);
        if (player) {
          player.connected = false;
          return {
            roomId,
            player: { ...player, pixelCount: roomData.pixelStats.get(playerId) || 0 },
          };
        }
      }
    }
    return null;
  }

  public getPlayerBySocket(socketId: string): { roomId: string; player: Player } | null {
    for (const [roomId, roomData] of this.rooms.entries()) {
      const playerId = roomData.socketToPlayer.get(socketId);
      if (playerId) {
        const player = roomData.players.get(playerId);
        if (player) {
          return {
            roomId,
            player: { ...player, pixelCount: roomData.pixelStats.get(playerId) || 0 },
          };
        }
      }
    }
    return null;
  }

  public getPlayers(roomId: string): Player[] {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return [];
    return Array.from(roomData.players.values()).map((p) => ({
      ...p,
      pixelCount: roomData.pixelStats.get(p.id) || 0,
    }));
  }

  public startGame(roomId: string, playerId: string): { success: boolean; error?: string } {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return { success: false, error: 'Room not found' };
    if (roomData.room.hostId !== playerId) return { success: false, error: 'Only host can start the game' };
    if (roomData.room.status !== 'waiting') return { success: false, error: 'Game is already started' };

    roomData.room.status = 'playing';
    return { success: true };
  }

  public finishGame(roomId: string, playerId: string): { success: boolean; error?: string } {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return { success: false, error: 'Room not found' };
    if (roomData.room.hostId !== playerId) return { success: false, error: 'Only host can finish the game' };

    roomData.room.status = 'finished';
    return { success: true };
  }

  public clearCanvas(roomId: string, playerId: string): { success: boolean; seq?: number; error?: string } {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return { success: false, error: 'Room not found' };
    if (roomData.room.hostId !== playerId) return { success: false, error: 'Only host can clear canvas' };

    roomData.room.sequence++;
    const seq = roomData.room.sequence;

    // Reset pixels
    roomData.pixels.clear();

    // Reset player stats
    for (const id of roomData.players.keys()) {
      roomData.pixelStats.set(id, 0);
    }

    return { success: true, seq };
  }

  /**
   * Authoritative LWW Pixel Update Batch with Idempotency & Monotonic Sequence
   */
  public applyPixelBatch(
    roomId: string,
    playerId: string,
    operationId: string,
    items: PixelBatchItem[]
  ): { updates: PixelUpdate[]; error?: string; alreadyApplied?: boolean } {
    const roomData = this.rooms.get(roomId);
    if (!roomData) {
      return { updates: [], error: 'Room not found' };
    }

    if (roomData.room.status === 'finished') {
      return { updates: [], error: 'Game is already finished' };
    }

    const player = roomData.players.get(playerId);
    if (!player) {
      return { updates: [], error: 'Player not in room' };
    }

    // Check Idempotency: Has this operationId already been applied?
    if (roomData.recentOperations.has(operationId)) {
      const existing = roomData.recentOperations.get(operationId)!;
      return { updates: existing.updates, alreadyApplied: true };
    }

    const updates: PixelUpdate[] = [];

    for (const item of items) {
      const { x, y, color } = item;

      // Validate bounds
      if (!isValidCoordinate(x, y, roomData.room.width, roomData.room.height)) {
        continue;
      }

      const key = pixelKey(x, y);
      const currentPixel = roomData.pixels.get(key);

      // Increment room-level sequence monotonically
      roomData.room.sequence++;
      const nextSeq = roomData.room.sequence;

      const isErase = color === null;
      const ownerId = isErase ? null : playerId;
      const finalColor = isErase ? null : color;
      const action = isErase ? 'erase' : 'draw';

      // Update player pixel counts in O(1)
      if (currentPixel && currentPixel.ownerId) {
        const oldOwnerCount = roomData.pixelStats.get(currentPixel.ownerId) || 0;
        roomData.pixelStats.set(currentPixel.ownerId, Math.max(0, oldOwnerCount - 1));
      }
      if (ownerId) {
        const newOwnerCount = roomData.pixelStats.get(ownerId) || 0;
        roomData.pixelStats.set(ownerId, newOwnerCount + 1);
      }

      // Update authoritative pixel map
      if (isErase) {
        roomData.pixels.delete(key);
      } else {
        roomData.pixels.set(key, {
          color: finalColor,
          ownerId,
          seq: nextSeq,
        });
      }

      const updateEvent: PixelUpdate = {
        type: 'pixel:update',
        roomId,
        seq: nextSeq,
        operationId,
        playerId,
        x,
        y,
        color: finalColor,
        ownerId,
        action,
      };

      updates.push(updateEvent);

      // Append to sliding window operation log
      roomData.operationLog.push(updateEvent);
      if (roomData.operationLog.length > OPERATION_HISTORY_LIMIT) {
        roomData.operationLog.shift();
      }
    }

    // Save operationId in recentOperations cache (bounded to 2,000 entries)
    roomData.recentOperations.set(operationId, {
      seq: roomData.room.sequence,
      appliedAt: Date.now(),
      updates,
    });
    if (roomData.recentOperations.size > 2000) {
      const oldestKey = roomData.recentOperations.keys().next().value;
      if (oldestKey) roomData.recentOperations.delete(oldestKey);
    }

    return { updates };
  }

  public getSnapshot(roomId: string): CanvasSnapshot | null {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return null;

    const pixelsObj: Record<string, PixelState> = {};
    for (const [k, p] of roomData.pixels.entries()) {
      pixelsObj[k] = { ...p };
    }

    return {
      roomId,
      width: roomData.room.width,
      height: roomData.room.height,
      sequence: roomData.room.sequence,
      pixels: pixelsObj,
    };
  }

  public getDeltaOrSnapshot(roomId: string, lastAppliedSeq: number): CanvasSyncResponse | null {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return null;

    // Up to date
    if (lastAppliedSeq === roomData.room.sequence) {
      return {
        type: 'delta',
        roomId,
        fromSeq: lastAppliedSeq,
        toSeq: lastAppliedSeq,
        updates: [],
      };
    }

    // If client has no sequence or sequence is before our log history, return full snapshot
    const oldestInLog = roomData.operationLog.length > 0 ? roomData.operationLog[0].seq : roomData.room.sequence;
    if (lastAppliedSeq < oldestInLog - 1 || roomData.operationLog.length === 0) {
      const snapshot = this.getSnapshot(roomId);
      if (!snapshot) return null;
      return {
        type: 'snapshot',
        roomId,
        snapshot,
      };
    }

    // Return deltas with seq > lastAppliedSeq
    const missingUpdates = roomData.operationLog.filter((op) => op.seq > lastAppliedSeq);
    return {
      type: 'delta',
      roomId,
      fromSeq: lastAppliedSeq,
      toSeq: roomData.room.sequence,
      updates: missingUpdates,
    };
  }
}

export const globalRoomStore = new RoomStore();
