import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config.js';
import { globalRoomStore } from './store/roomStore.js';
import { setupSocketHandlers } from './socket/socketHandler.js';
import { getSupabaseAdmin, getUserFromToken } from './supabase.js';
import type { GameMode, MosaicConfig } from '@pixel-party/shared';

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
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    supabaseConfigured: Boolean(config.supabaseServiceKey),
  });
});

// Create Room (authenticated creator)
app.post('/api/rooms', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Войдите в аккаунт, чтобы создать комнату' });
    }

    const { width, height, gameMode, mosaicConfig } = req.body || {};
    const allowedSizes = [16, 32, 48, 64, 96, 128];
    const w = allowedSizes.includes(Number(width)) ? Number(width) : config.canvasWidth;
    const h = allowedSizes.includes(Number(height)) ? Number(height) : config.canvasHeight;
    const mode: GameMode =
      gameMode === 'classic' || gameMode === 'blind_mosaic' ? gameMode : 'classic';
    const mosaic: MosaicConfig | undefined =
      mode === 'blind_mosaic' ? (mosaicConfig as MosaicConfig | undefined) : undefined;

    const { room, hostId } = globalRoomStore.createRoom({
      width: w,
      height: h,
      gameMode: mode,
      mosaicConfig: mosaic,
    });

    // Persist room ownership to Supabase (best-effort; the live game still runs in-memory)
    try {
      const { error: dbError } = await getSupabaseAdmin().from('rooms').insert({
        id: room.id,
        owner_id: user.id,
        host_id: hostId,
        status: room.status,
        game_mode: room.gameMode,
        width: room.width,
        height: room.height,
        mosaic_config: room.mosaicConfig ?? null,
      });
      if (dbError) {
        console.error('Failed to persist room to Supabase:', dbError.message);
      }
    } catch (dbErr) {
      console.error('Supabase unavailable during room creation:', dbErr instanceof Error ? dbErr.message : dbErr);
    }

    res.status(201).json({
      roomId: room.id,
      hostId,
      status: room.status,
      gameMode: room.gameMode,
      mosaicConfig: room.mosaicConfig,
      width: room.width,
      height: room.height,
      createdAt: room.createdAt,
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// List rooms owned by the authenticated user (for the dashboard)
app.get('/api/me/rooms', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('rooms')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load rooms:', error.message);
      return res.status(500).json({ error: 'Не удалось загрузить комнаты' });
    }

    res.json({ rooms: data ?? [] });
  } catch (error) {
    console.error('Error loading rooms:', error);
    res.status(500).json({ error: 'Failed to load rooms' });
  }
});

// Rehydrate a persisted room that is no longer in memory (e.g. after a server restart)
app.post('/api/rooms/:roomId/rehydrate', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const roomId = req.params.roomId.toUpperCase();
    const existing = globalRoomStore.getRoom(roomId);
    if (existing) {
      return res.json({ roomId: existing.id, hostId: existing.hostId });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (data.owner_id !== user.id) {
      return res.status(403).json({ error: 'Not your room' });
    }

    const { room, hostId } = globalRoomStore.createRoom({
      id: roomId,
      hostId: data.host_id,
      width: data.width,
      height: data.height,
      gameMode: data.game_mode,
      mosaicConfig: data.mosaic_config ?? undefined,
    });

    res.json({ roomId: room.id, hostId });
  } catch (error) {
    console.error('Error rehydrating room:', error);
    res.status(500).json({ error: 'Failed to open room' });
  }
});

// Delete a room from the dashboard list
app.delete('/api/rooms/:roomId', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const roomId = req.params.roomId.toUpperCase();
    const { data, error } = await getSupabaseAdmin()
      .from('rooms')
      .select('owner_id')
      .eq('id', roomId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Failed to delete room' });
    }
    if (!data) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (data.owner_id !== user.id) {
      return res.status(403).json({ error: 'Not your room' });
    }

    await getSupabaseAdmin().from('rooms').delete().eq('id', roomId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
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
