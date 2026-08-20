import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { RoomStore } from '../store/roomStore.js';
import { setupSocketHandlers } from '../socket/socketHandler.js';
import { PixelUpdate, RoomStatePayload } from '@pixel-party/shared';

describe('End-to-End Realtime Multi-User Socket Flow', () => {
  let server: http.Server;
  let ioServer: SocketIOServer;
  let serverUrl: string;
  let roomStore: RoomStore;
  let roomId: string;
  let hostId: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = http.createServer(app);
    ioServer = new SocketIOServer(server, { cors: { origin: '*' } });
    roomStore = new RoomStore();
    setupSocketHandlers(ioServer, roomStore);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    const created = roomStore.createRoom({ width: 64, height: 64 });
    roomId = created.room.id;
    hostId = created.hostId;
  });

  afterAll(async () => {
    ioServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('Simulates full multi-user party lifecycle: Join -> Start -> Realtime Draw -> Ownership -> Reconnect -> Finish', async () => {
    // 1. Client A (Alex / Host) connects
    const socketAlex: ClientSocketType = ClientSocket(serverUrl, { autoConnect: true });
    // 2. Client B (Max) connects
    const socketMax: ClientSocketType = ClientSocket(serverUrl, { autoConnect: true });

    await Promise.all([
      new Promise<void>((resolve) => socketAlex.on('connect', resolve)),
      new Promise<void>((resolve) => socketMax.on('connect', resolve)),
    ]);

    // Join Alex as host
    const alexJoinPromise = new Promise<RoomStatePayload>((resolve) => {
      socketAlex.once('room:state', resolve);
    });
    socketAlex.emit('room:join', { roomId, nickname: 'Alex', playerId: hostId });
    const alexState = await alexJoinPromise;
    expect(alexState.isHost).toBe(true);
    expect(alexState.room.status).toBe('waiting');

    // Join Max
    const maxJoinPromise = new Promise<RoomStatePayload>((resolve) => {
      socketMax.once('room:state', resolve);
    });
    socketMax.emit('room:join', { roomId, nickname: 'Max' });
    const maxState = await maxJoinPromise;
    expect(maxState.isHost).toBe(false);
    expect(maxState.players.length).toBe(2);

    // Host starts game
    const gameStartPromiseAlex = new Promise<void>((resolve) => {
      socketAlex.once('game:started', () => resolve());
    });
    const gameStartPromiseMax = new Promise<void>((resolve) => {
      socketMax.once('game:started', () => resolve());
    });
    socketAlex.emit('game:start', { roomId });
    await Promise.all([gameStartPromiseAlex, gameStartPromiseMax]);

    // Alex draws RED pixel at (10, 15)
    const alexDrawPromise = new Promise<PixelUpdate>((resolve) => {
      socketMax.once('pixel:updated', resolve);
    });
    socketAlex.emit('pixel:draw', {
      roomId,
      x: 10,
      y: 15,
      color: '#FF0000',
      operationId: 'op_alex_test_1',
    });
    const update1 = await alexDrawPromise;
    expect(update1.x).toBe(10);
    expect(update1.y).toBe(15);
    expect(update1.color).toBe('#FF0000');
    expect(update1.ownerId).toBe(alexState.myPlayerId);

    // Max overwrites same pixel (10, 15) with BLUE
    const maxDrawPromise = new Promise<PixelUpdate>((resolve) => {
      socketAlex.once('pixel:updated', resolve);
    });
    socketMax.emit('pixel:draw', {
      roomId,
      x: 10,
      y: 15,
      color: '#0000FF',
      operationId: 'op_max_test_1',
    });
    const update2 = await maxDrawPromise;
    expect(update2.x).toBe(10);
    expect(update2.y).toBe(15);
    expect(update2.color).toBe('#0000FF');
    expect(update2.ownerId).toBe(maxState.myPlayerId);
    expect(update2.seq).toBeGreaterThan(update1.seq);

    // Disconnect Max
    socketMax.disconnect();

    // Alex draws (20, 20) GREEN while Max is disconnected
    socketAlex.emit('pixel:draw', {
      roomId,
      x: 20,
      y: 20,
      color: '#00FF00',
      operationId: 'op_alex_test_2',
    });
    await new Promise((r) => setTimeout(r, 50));

    // Max reconnects and requests sync
    const socketMax2: ClientSocketType = ClientSocket(serverUrl, { autoConnect: true });
    await new Promise<void>((resolve) => socketMax2.on('connect', resolve));

    const max2StatePromise = new Promise<RoomStatePayload>((resolve) => {
      socketMax2.once('room:state', resolve);
    });
    socketMax2.emit('room:join', { roomId, nickname: 'Max', playerId: maxState.myPlayerId });
    const max2State = await max2StatePromise;

    // Verify snapshot received by Max includes both (10,15) BLUE and (20,20) GREEN
    expect(max2State.snapshot.pixels['10:15'].color).toBe('#0000FF');
    expect(max2State.snapshot.pixels['10:15'].ownerId).toBe(maxState.myPlayerId);
    expect(max2State.snapshot.pixels['20:20'].color).toBe('#00FF00');

    // Finish game
    const finishPromise = new Promise<void>((resolve) => {
      socketMax2.once('game:finished', () => resolve());
    });
    socketAlex.emit('game:finish', { roomId });
    await finishPromise;

    socketAlex.disconnect();
    socketMax2.disconnect();
  });
});
