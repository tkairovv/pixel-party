import type { GameMode, MosaicConfig, RoomRecord } from '@pixel-party/shared';

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.error || fallback;
}

export interface CreateRoomInput {
  width: number;
  height: number;
  gameMode: GameMode;
  mosaicConfig?: MosaicConfig;
}

export async function createRoom(token: string, input: CreateRoomInput) {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res, 'Failed to create room'));
  return res.json();
}

export async function listRooms(token: string): Promise<RoomRecord[]> {
  const res = await fetch('/api/me/rooms', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res, 'Failed to load rooms'));
  const data = await res.json();
  return data.rooms ?? [];
}

export async function rehydrateRoom(roomId: string, token: string) {
  const res = await fetch(`/api/rooms/${roomId}/rehydrate`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, 'Failed to open room'));
  return res.json();
}

export async function deleteRoom(roomId: string, token: string) {
  const res = await fetch(`/api/rooms/${roomId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readError(res, 'Failed to delete room'));
  return res.json();
}
