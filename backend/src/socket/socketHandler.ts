import { Server, Socket } from 'socket.io';
import { RoomStore } from '../store/roomStore.js';
import { rateLimiter } from './rateLimiter.js';
import { PixelBatchItem } from '@pixel-party/shared';

export function setupSocketHandlers(io: Server, roomStore: RoomStore): void {
  io.on('connection', (socket: Socket) => {
    // console.log(`[Socket] Connected: ${socket.id}`);

    // 1. Join Room
    socket.on('room:join', (data: { roomId: string; nickname: string; playerId?: string }) => {
      const { roomId, nickname, playerId } = data;
      if (!roomId || !nickname) {
        socket.emit('error', { code: 'INVALID_ARGS', message: 'Room ID and Nickname are required' });
        return;
      }

      const joinResult = roomStore.joinPlayer(roomId, nickname, socket.id, playerId);
      if ('error' in joinResult) {
        socket.emit('error', { code: 'JOIN_FAILED', message: joinResult.error });
        return;
      }

      const { player, isHost } = joinResult;
      const room = roomStore.getRoom(roomId);
      const snapshot = roomStore.getSnapshot(roomId);
      const players = roomStore.getPlayers(roomId);

      if (!room || !snapshot) {
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room could not be loaded' });
        return;
      }

      // Join socket.io room channel
      socket.join(roomId);

      // Send initial authoritative state to the newly connected player
      socket.emit('room:state', {
        room,
        players,
        isHost,
        myPlayerId: player.id,
        snapshot,
      });

      // Broadcast to other players that someone joined/updated
      socket.to(roomId).emit('player:joined', player);
      io.to(roomId).emit('players:updated', players);
    });

    // 2. Draw Single Pixel
    socket.on(
      'pixel:draw',
      (data: { roomId: string; x: number; y: number; color: string; operationId: string }) => {
        const { roomId, x, y, color, operationId } = data;
        const playerInfo = roomStore.getPlayerBySocket(socket.id);

        if (!playerInfo || playerInfo.roomId !== roomId) {
          socket.emit('error', { code: 'UNAUTHORIZED', message: 'Not in room' });
          return;
        }

        if (!rateLimiter.allow(socket.id, 1)) {
          return; // Dropping throttled requests to protect server
        }

        const res = roomStore.applyPixelBatch(roomId, playerInfo.player.id, operationId, [{ x, y, color }]);
        if (res.error) {
          socket.emit('error', { code: 'DRAW_ERROR', message: res.error });
          return;
        }

        // Broadcast authoritative update to ALL players in the room (including sender)
        for (const update of res.updates) {
          io.to(roomId).emit('pixel:updated', update);
        }

        // Update player stats
        io.to(roomId).emit('players:updated', roomStore.getPlayers(roomId));
      }
    );

    // 3. Erase Single Pixel
    socket.on('pixel:erase', (data: { roomId: string; x: number; y: number; operationId: string }) => {
      const { roomId, x, y, operationId } = data;
      const playerInfo = roomStore.getPlayerBySocket(socket.id);

      if (!playerInfo || playerInfo.roomId !== roomId) {
        socket.emit('error', { code: 'UNAUTHORIZED', message: 'Not in room' });
        return;
      }

      if (!rateLimiter.allow(socket.id, 1)) {
        return;
      }

      const res = roomStore.applyPixelBatch(roomId, playerInfo.player.id, operationId, [{ x, y, color: null }]);
      if (res.error) {
        socket.emit('error', { code: 'ERASE_ERROR', message: res.error });
        return;
      }

      for (const update of res.updates) {
        io.to(roomId).emit('pixel:updated', update);
      }

      io.to(roomId).emit('players:updated', roomStore.getPlayers(roomId));
    });

    // 4. Batch Drawing (e.g. continuous mouse strokes with Bresenham)
    socket.on(
      'pixel:batch',
      (data: { roomId: string; operationId: string; pixels: PixelBatchItem[] }) => {
        const { roomId, operationId, pixels } = data;
        const playerInfo = roomStore.getPlayerBySocket(socket.id);

        if (!playerInfo || playerInfo.roomId !== roomId) {
          socket.emit('error', { code: 'UNAUTHORIZED', message: 'Not in room' });
          return;
        }

        if (!pixels || pixels.length === 0) return;

        // Rate limit according to number of pixels
        if (!rateLimiter.allow(socket.id, Math.min(pixels.length, 10))) {
          return;
        }

        const res = roomStore.applyPixelBatch(roomId, playerInfo.player.id, operationId, pixels);
        if (res.error) {
          socket.emit('error', { code: 'BATCH_ERROR', message: res.error });
          return;
        }

        // Broadcast batch updates
        if (res.updates.length > 0) {
          io.to(roomId).emit('pixel:batch_updated', res.updates);
          io.to(roomId).emit('players:updated', roomStore.getPlayers(roomId));
        }
      }
    );

    // 5. Canvas Resync / Delta Sync
    socket.on('canvas:sync', (data: { roomId: string; lastAppliedSeq: number }) => {
      const { roomId, lastAppliedSeq } = data;
      const syncResult = roomStore.getDeltaOrSnapshot(roomId, lastAppliedSeq);

      if (syncResult) {
        socket.emit('canvas:sync_response', syncResult);
      } else {
        const fullSnapshot = roomStore.getSnapshot(roomId);
        if (fullSnapshot) {
          socket.emit('canvas:sync_response', {
            type: 'snapshot',
            roomId,
            snapshot: fullSnapshot,
          });
        }
      }
    });

    // 6. Game Start (Host only)
    socket.on('game:start', (data: { roomId: string }) => {
      const { roomId } = data;
      const playerInfo = roomStore.getPlayerBySocket(socket.id);
      if (!playerInfo || playerInfo.roomId !== roomId) return;

      const result = roomStore.startGame(roomId, playerInfo.player.id);
      if (result.success) {
        io.to(roomId).emit('game:started', { roomId, status: 'playing' });
      } else {
        socket.emit('error', { code: 'START_GAME_FAILED', message: result.error || 'Failed to start game' });
      }
    });

    // 7. Game Finish (Host only)
    socket.on('game:finish', (data: { roomId: string }) => {
      const { roomId } = data;
      const playerInfo = roomStore.getPlayerBySocket(socket.id);
      if (!playerInfo || playerInfo.roomId !== roomId) return;

      const result = roomStore.finishGame(roomId, playerInfo.player.id);
      if (result.success) {
        io.to(roomId).emit('game:finished', { roomId, status: 'finished' });
      } else {
        socket.emit('error', { code: 'FINISH_GAME_FAILED', message: result.error || 'Failed to finish game' });
      }
    });

    // 8. Clear Canvas (Host only)
    socket.on('canvas:clear', (data: { roomId: string }) => {
      const { roomId } = data;
      const playerInfo = roomStore.getPlayerBySocket(socket.id);
      if (!playerInfo || playerInfo.roomId !== roomId) return;

      const result = roomStore.clearCanvas(roomId, playerInfo.player.id);
      if (result.success && result.seq) {
        io.to(roomId).emit('canvas:cleared', {
          roomId,
          seq: result.seq,
          clearedBy: playerInfo.player.id,
        });
        io.to(roomId).emit('players:updated', roomStore.getPlayers(roomId));
      } else {
        socket.emit('error', { code: 'CLEAR_FAILED', message: result.error || 'Failed to clear canvas' });
      }
    });

    // 9. Disconnect
    socket.on('disconnect', () => {
      rateLimiter.remove(socket.id);
      const disconnected = roomStore.disconnectSocket(socket.id);
      if (disconnected) {
        const { roomId } = disconnected;
        // Notify room that player disconnected, but retain their pixels and player listing
        io.to(roomId).emit('players:updated', roomStore.getPlayers(roomId));
      }
    });
  });
}
