import {
  Room,
  Player,
  PixelState,
  PixelUpdate,
  PixelBatchItem,
  CanvasSnapshot,
  CanvasSyncResponse,
  RoomStatus,
  GameMode,
  MosaicConfig,
} from '@pixel-party/shared';
import {
  INITIAL_ROOM_SEQUENCE,
  OPERATION_HISTORY_LIMIT,
  PLAYER_COLORS,
} from '@pixel-party/shared';
import {
  generateRoomId,
  generatePlayerId,
  generateOperationId,
  pixelKey,
  validateNickname,
  isValidCoordinate,
  isCoordInSector,
} from '@pixel-party/shared';
import { config } from '../config.js';

interface PersonalStroke {
  operationId: string;
  priorPixels: Map<string, PixelState | null>; // state before stroke
  appliedItems: PixelBatchItem[];
}

interface InternalRoomData {
  room: Room;
  players: Map<string, Player>;
  socketToPlayer: Map<string, string>; // socketId -> playerId
  playerToSocket: Map<string, string>; // playerId -> socketId
  pixels: Map<string, PixelState>;     // "x:y" -> PixelState
  operationLog: PixelUpdate[];         // Sliding window
  recentOperations: Map<string, { seq: number; appliedAt: number; updates: PixelUpdate[] }>; // operationId -> result
  pixelStats: Map<string, number>;     // playerId -> count
  undoStacks: Map<string, PersonalStroke[]>; // playerId -> undo stack
  redoStacks: Map<string, PersonalStroke[]>; // playerId -> redo stack
}

export class RoomStore {
  private rooms = new Map<string, InternalRoomData>();

  public createRoom(options?: {
    width?: number;
    height?: number;
    gameMode?: GameMode;
    mosaicConfig?: MosaicConfig;
    id?: string;
    hostId?: string;
  }): { room: Room; hostId: string } {
    let roomId = options?.id ? options.id.toUpperCase() : generateRoomId();
    if (!options?.id) {
      while (this.rooms.has(roomId)) {
        roomId = generateRoomId();
      }
    }

    const hostId = options?.hostId || generatePlayerId();
    const width = options?.width || config.canvasWidth;
    const height = options?.height || config.canvasHeight;
    const gameMode: GameMode = options?.gameMode || 'classic';

    const defaultMosaicConfig: MosaicConfig = {
      sectorsCount: 3,
      sectorTitles: ['Голова 🎩', 'Туловище 👕', 'Ноги 👖'],
      direction: 'horizontal',
      roundDurationSeconds: 0,
    };

    const mosaicConfig = options?.mosaicConfig || (gameMode === 'blind_mosaic' ? defaultMosaicConfig : undefined);

    const room: Room = {
      id: roomId,
      hostId,
      status: 'waiting',
      gameMode,
      mosaicConfig,
      revealStep: 0,
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
      undoStacks: new Map(),
      redoStacks: new Map(),
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

  public setGameMode(
    roomId: string,
    playerId: string,
    gameMode: GameMode,
    mosaicConfig?: MosaicConfig
  ): { success: boolean; error?: string } {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return { success: false, error: 'Room not found' };
    if (roomData.room.hostId !== playerId) return { success: false, error: 'Only host can change game mode' };

    roomData.room.gameMode = gameMode;
    if (mosaicConfig) {
      roomData.room.mosaicConfig = mosaicConfig;
    } else if (gameMode === 'blind_mosaic' && !roomData.room.mosaicConfig) {
      roomData.room.mosaicConfig = {
        sectorsCount: 3,
        sectorTitles: ['Голова 🎩', 'Туловище 👕', 'Ноги 👖'],
        direction: 'horizontal',
        roundDurationSeconds: 0,
      };
    }

    // Rebalance teams if blind_mosaic
    if (roomData.room.gameMode === 'blind_mosaic' && roomData.room.mosaicConfig) {
      const sectorsCount = roomData.room.mosaicConfig.sectorsCount;
      let idx = 0;
      for (const player of roomData.players.values()) {
        player.teamSector = idx % sectorsCount;
        idx++;
      }
    }

    return { success: true };
  }

  public setPlayerTeamSector(roomId: string, targetPlayerId: string, sectorIndex: number): boolean {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return false;
    const player = roomData.players.get(targetPlayerId);
    if (!player) return false;
    player.teamSector = sectorIndex;
    return true;
  }

  public joinHost(
    roomId: string,
    socketId: string,
    hostId: string
  ): { isHost: boolean; hostId: string } | { error: string } {
    const roomData = this.rooms.get(roomId);
    if (!roomData) {
      return { error: 'Room not found' };
    }

    if (roomData.room.hostId !== hostId) {
      return { error: 'Invalid host credentials' };
    }

    roomData.socketToPlayer.set(socketId, hostId);
    roomData.playerToSocket.set(hostId, socketId);
    if (!roomData.pixelStats.has(hostId)) roomData.pixelStats.set(hostId, 0);
    if (!roomData.undoStacks.has(hostId)) roomData.undoStacks.set(hostId, []);
    if (!roomData.redoStacks.has(hostId)) roomData.redoStacks.set(hostId, []);

    return { isHost: true, hostId };
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
      player.nickname = trimmedNickname;

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

    // Assign team sector if blind_mosaic mode
    let teamSector: number | undefined = undefined;
    if (roomData.room.gameMode === 'blind_mosaic' && roomData.room.mosaicConfig) {
      teamSector = roomData.players.size % roomData.room.mosaicConfig.sectorsCount;
    }

    const player: Player = {
      id: playerId,
      nickname: trimmedNickname,
      color,
      connected: true,
      joinedAt: Date.now(),
      pixelCount: 0,
      teamSector,
      isHostSpectator: false,
    };

    roomData.players.set(playerId, player);
    roomData.socketToPlayer.set(socketId, playerId);
    roomData.playerToSocket.set(playerId, socketId);
    roomData.pixelStats.set(playerId, 0);
    roomData.undoStacks.set(playerId, []);
    roomData.redoStacks.set(playerId, []);

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
    roomData.room.revealStep = 0;
    return { success: true };
  }

  public finishGame(roomId: string, playerId: string): { success: boolean; error?: string } {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return { success: false, error: 'Room not found' };
    if (roomData.room.hostId !== playerId) return { success: false, error: 'Only host can finish the game' };

    if (roomData.room.gameMode === 'blind_mosaic') {
      roomData.room.status = 'revealing';
      roomData.room.revealStep = 0;
    } else {
      roomData.room.status = 'finished';
    }

    return { success: true };
  }

  public setRevealStep(roomId: string, playerId: string, step: number): { success: boolean; status: RoomStatus; revealStep: number; error?: string } {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return { success: false, status: 'finished', revealStep: 0, error: 'Room not found' };
    if (roomData.room.hostId !== playerId) return { success: false, status: roomData.room.status, revealStep: 0, error: 'Only host can change reveal step' };

    roomData.room.revealStep = step;
    const maxSteps = roomData.room.mosaicConfig?.sectorsCount || 3;
    if (step >= maxSteps) {
      roomData.room.status = 'finished';
    } else {
      roomData.room.status = 'revealing';
    }

    return { success: true, status: roomData.room.status, revealStep: roomData.room.revealStep };
  }

  public clearCanvas(roomId: string, playerId: string): { success: boolean; seq?: number; error?: string } {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return { success: false, error: 'Room not found' };
    if (roomData.room.hostId !== playerId) return { success: false, error: 'Only host can clear canvas' };

    roomData.room.sequence++;
    const seq = roomData.room.sequence;

    // Reset pixels
    roomData.pixels.clear();

    // Reset player stats & undo stacks
    for (const id of roomData.players.keys()) {
      roomData.pixelStats.set(id, 0);
      roomData.undoStacks.set(id, []);
      roomData.redoStacks.set(id, []);
    }

    return { success: true, seq };
  }

  /**
   * Authoritative LWW Pixel Update Batch with Idempotency, Personal Undo Stack & Sector Boundary Enforcement
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

    // Check Idempotency
    if (roomData.recentOperations.has(operationId)) {
      const existing = roomData.recentOperations.get(operationId)!;
      return { updates: existing.updates, alreadyApplied: true };
    }

    const updates: PixelUpdate[] = [];
    const priorPixelsMap = new Map<string, PixelState | null>();
    const validItems: PixelBatchItem[] = [];

    const isBlindMosaic = roomData.room.gameMode === 'blind_mosaic' && roomData.room.mosaicConfig;

    for (const item of items) {
      const { x, y, color } = item;

      // Validate global bounds
      if (!isValidCoordinate(x, y, roomData.room.width, roomData.room.height)) {
        continue;
      }

      // In Blind Mosaic mode, validate that pixel is strictly inside player's sector!
      if (isBlindMosaic && player.teamSector !== undefined) {
        const inSector = isCoordInSector(
          x,
          y,
          player.teamSector,
          roomData.room.mosaicConfig!.sectorsCount,
          roomData.room.width,
          roomData.room.height,
          roomData.room.mosaicConfig!.direction
        );
        if (!inSector) continue;
      }

      const key = pixelKey(x, y);
      const currentPixel = roomData.pixels.get(key);

      // Record prior pixel state for Personal Undo
      if (!priorPixelsMap.has(key)) {
        priorPixelsMap.set(key, currentPixel ? { ...currentPixel } : null);
      }

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
      validItems.push(item);

      // Append to sliding window operation log
      roomData.operationLog.push(updateEvent);
      if (roomData.operationLog.length > OPERATION_HISTORY_LIMIT) {
        roomData.operationLog.shift();
      }
    }

    // Save to Personal Undo Stack (bounded to 40 strokes per player)
    if (updates.length > 0) {
      let uStack = roomData.undoStacks.get(playerId);
      if (!uStack) {
        uStack = [];
        roomData.undoStacks.set(playerId, uStack);
      }
      uStack.push({
        operationId,
        priorPixels: priorPixelsMap,
        appliedItems: validItems,
      });
      if (uStack.length > 40) uStack.shift();

      // Clear redo stack on new action
      roomData.redoStacks.set(playerId, []);
    }

    // Save operationId in recentOperations cache
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

  /**
   * Personal Undo: Reverts the player's last stroke without wiping other players' contributions
   */
  public undoPersonalStroke(
    roomId: string,
    playerId: string
  ): { updates: PixelUpdate[]; canUndo: boolean; canRedo: boolean } {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return { updates: [], canUndo: false, canRedo: false };

    const uStack = roomData.undoStacks.get(playerId);
    if (!uStack || uStack.length === 0) {
      return { updates: [], canUndo: false, canRedo: (roomData.redoStacks.get(playerId)?.length || 0) > 0 };
    }

    const lastStroke = uStack.pop()!;
    const updates: PixelUpdate[] = [];

    for (const [key, prior] of lastStroke.priorPixels.entries()) {
      const [xStr, yStr] = key.split(':');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);

      const current = roomData.pixels.get(key);

      // Only revert if the pixel is still owned by the undoing player
      if (current && current.ownerId === playerId) {
        roomData.room.sequence++;
        const nextSeq = roomData.room.sequence;

        // Decrement current player count
        const oldOwnerCount = roomData.pixelStats.get(playerId) || 0;
        roomData.pixelStats.set(playerId, Math.max(0, oldOwnerCount - 1));

        if (!prior || prior.color === null) {
          // Reverted to empty
          roomData.pixels.delete(key);
          const update: PixelUpdate = {
            type: 'pixel:update',
            roomId,
            seq: nextSeq,
            operationId: generateOperationId(),
            playerId,
            x,
            y,
            color: null,
            ownerId: null,
            action: 'erase',
          };
          updates.push(update);
          roomData.operationLog.push(update);
        } else {
          // Reverted to prior color and prior owner
          if (prior.ownerId) {
            const priorOwnerCount = roomData.pixelStats.get(prior.ownerId) || 0;
            roomData.pixelStats.set(prior.ownerId, priorOwnerCount + 1);
          }
          roomData.pixels.set(key, {
            color: prior.color,
            ownerId: prior.ownerId,
            seq: nextSeq,
          });
          const update: PixelUpdate = {
            type: 'pixel:update',
            roomId,
            seq: nextSeq,
            operationId: generateOperationId(),
            playerId,
            x,
            y,
            color: prior.color,
            ownerId: prior.ownerId,
            action: 'draw',
          };
          updates.push(update);
          roomData.operationLog.push(update);
        }
      }
    }

    // Push to redo stack
    let rStack = roomData.redoStacks.get(playerId);
    if (!rStack) {
      rStack = [];
      roomData.redoStacks.set(playerId, rStack);
    }
    rStack.push(lastStroke);

    return {
      updates,
      canUndo: uStack.length > 0,
      canRedo: rStack.length > 0,
    };
  }

  /**
   * Personal Redo: Re-applies the player's last undone stroke
   */
  public redoPersonalStroke(
    roomId: string,
    playerId: string
  ): { updates: PixelUpdate[]; canUndo: boolean; canRedo: boolean } {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return { updates: [], canUndo: false, canRedo: false };

    const rStack = roomData.redoStacks.get(playerId);
    if (!rStack || rStack.length === 0) {
      return { updates: [], canUndo: (roomData.undoStacks.get(playerId)?.length || 0) > 0, canRedo: false };
    }

    const strokeToRedo = rStack.pop()!;
    const res = this.applyPixelBatch(roomId, playerId, generateOperationId(), strokeToRedo.appliedItems);

    const uStack = roomData.undoStacks.get(playerId);

    return {
      updates: res.updates,
      canUndo: (uStack?.length || 0) > 0,
      canRedo: rStack.length > 0,
    };
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

    if (lastAppliedSeq === roomData.room.sequence) {
      return {
        type: 'delta',
        roomId,
        fromSeq: lastAppliedSeq,
        toSeq: lastAppliedSeq,
        updates: [],
      };
    }

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
