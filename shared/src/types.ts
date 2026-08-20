export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Player {
  id: string;
  nickname: string;
  color: string;
  connected: boolean;
  joinedAt: number;
  pixelCount?: number;
}

export interface Room {
  id: string;
  hostId: string;
  status: RoomStatus;
  sequence: number;
  width: number;
  height: number;
  createdAt: number;
}

export interface Pixel {
  x: number;
  y: number;
  color: string | null;
  ownerId: string | null;
}

export interface PixelState {
  color: string | null;
  ownerId: string | null;
  seq: number;
}

export interface PixelUpdate {
  type: 'pixel:update';
  roomId: string;
  seq: number;
  operationId: string;
  playerId: string;
  x: number;
  y: number;
  color: string | null;
  ownerId: string | null;
  action: 'draw' | 'erase';
}

export interface PixelBatchItem {
  x: number;
  y: number;
  color: string | null;
}

export interface PixelBatch {
  operationId: string;
  pixels: PixelBatchItem[];
}

export interface CanvasSnapshot {
  roomId: string;
  width: number;
  height: number;
  sequence: number;
  pixels: Record<string, PixelState>;
}

export interface CanvasSyncResponse {
  type: 'delta' | 'snapshot';
  roomId: string;
  fromSeq?: number;
  toSeq?: number;
  updates?: PixelUpdate[];
  snapshot?: CanvasSnapshot;
}

export interface RoomStatePayload {
  room: Room;
  players: Player[];
  isHost: boolean;
  myPlayerId: string;
  snapshot: CanvasSnapshot;
}

export interface CanvasClearedPayload {
  roomId: string;
  seq: number;
  clearedBy: string;
}

export interface GameStatusPayload {
  roomId: string;
  status: RoomStatus;
}

export interface AppErrorPayload {
  code: string;
  message: string;
}
