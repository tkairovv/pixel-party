import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config.js';
import { globalRoomStore } from './store/roomStore.js';
import { setupSocketHandlers } from './socket/socketHandler.js';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

setupSocketHandlers(io, globalRoomStore);

// REST API Endpoints
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Create Room
app.post('/api/rooms', (req, res) => {
  try {
    const { width, height } = req.body || {};
    const { room, hostId } = globalRoomStore.createRoom({ width, height });
    res.status(201).json({
      roomId: room.id,
      hostId,
      status: room.status,
      width: room.width,
      height: room.height,
      createdAt: room.createdAt,
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get Room Information
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = globalRoomStore.getRoom(roomId.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const players = globalRoomStore.getPlayers(room.id);
  res.json({
    room,
    playersCount: players.length,
    activePlayersCount: players.filter((p) => p.connected).length,
  });
});

// Get Authoritative Snapshot
app.get('/api/rooms/:roomId/snapshot', (req, res) => {
  const { roomId } = req.params;
  const snapshot = globalRoomStore.getSnapshot(roomId.toUpperCase());
  if (!snapshot) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json(snapshot);
});

// Serve frontend static files if built (Production / Unified server mode)
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.resolve(__dirname, '../../frontend/dist');

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

server.listen(config.port, config.host, () => {
  console.log(`🎮 Pixel Party Backend running on http://${config.host}:${config.port}`);
});

export { app, server, io };
