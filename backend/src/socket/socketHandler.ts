import { Server, Socket } from 'socket.io';
import { RoomStore } from '../store/roomStore.js';
import { rateLimiter } from './rateLimiter.js';
import { PixelBatchItem, GameMode, MosaicConfig } from '@pixel-party/shared';

export function setupSocketHandlers(io: Server, roomStore: RoomStore): void {
  io.on('connection', (socket: Socket) => {
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

      socket.join(roomId);

      socket.emit('room:state', {
        room,
        players,
        isHost,
        myPlayerId: player.id,
        snapshot,
      });

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

        if (!rateLimiter.allow(socket.id, 1)) return;

        const res = roomStore.applyPixelBatch(roomId, playerInfo.player.id, operationId, [{ x, y, color }]);
        if (res.error) {
          socket.emit('error', { code: 'DRAW_ERROR', message: res.error });
          return;
        }

        for (const update of res.updates) {
          io.to(roomId).emit('pixel:updated', update);
        }

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

      if (!rateLimiter.allow(socket.id, 1)) return;

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

    // 4. Batch Drawing
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

        if (!rateLimiter.allow(socket.id, Math.min(pixels.length, 10))) return;

        const res = roomStore.applyPixelBatch(roomId, playerInfo.player.id, operationId, pixels);
        if (res.error) {
          socket.emit('error', { code: 'BATCH_ERROR', message: res.error });
          return;
        }

        if (res.updates.length > 0) {
          io.to(roomId).emit('pixel:batch_updated', res.updates);
          io.to(roomId).emit('players:updated', roomStore.getPlayers(roomId));
        }
      }
    );

    // 5. Personal Undo
    socket.on('pixel:undo', (data: { roomId: string }) => {
      const { roomId } = data;
      const playerInfo = roomStore.getPlayerBySocket(socket.id);
      if (!playerInfo || playerInfo.roomId !== roomId) return;

      const undoRes = roomStore.undoPersonalStroke(roomId, playerInfo.player.id);
      if (undoRes.updates.length > 0) {
        io.to(roomId).emit('pixel:batch_updated', undoRes.updates);
        io.to(roomId).emit('players:updated', roomStore.getPlayers(roomId));
      }
      socket.emit('undo:status', { canUndo: undoRes.canUndo, canRedo: undoRes.canRedo });
    });

    // 6. Personal Redo
    socket.on('pixel:redo', (data: { roomId: string }) => {
      const { roomId } = data;
      const playerInfo = roomStore.getPlayerBySocket(socket.id);
      if (!playerInfo || playerInfo.roomId !== roomId) return;

      const redoRes = roomStore.redoPersonalStroke(roomId, playerInfo.player.id);
      if (redoRes.updates.length > 0) {
        io.to(roomId).emit('pixel:batch_updated', redoRes.updates);
        io.to(roomId).emit('players:updated', roomStore.getPlayers(roomId));
      }
      socket.emit('undo:status', { canUndo: redoRes.canUndo, canRedo: redoRes.canRedo });
    });

    // 7. Request Full Operation History (For Timelapse Playback)
    socket.on('timelapse:request', (data: { roomId: string }) => {
      const { roomId } = data;
      const roomData = roomStore.getRoomData(roomId);
      if (roomData) {
        socket.emit('timelapse:history', {
          roomId,
          width: roomData.room.width,
          height: roomData.room.height,
          operations: roomData.operationLog,
        });
      }
    });

    // 8. Set Game Mode & Config (Host only)
    socket.on('game:set_mode', (data: { roomId: string; gameMode: GameMode; mosaicConfig?: MosaicConfig }) => {
      const { roomId, gameMode, mosaicConfig } = data;
      const playerInfo = roomStore.getPlayerBySocket(socket.id);
      if (!playerInfo || playerInfo.roomId !== roomId) return;

      const res = roomStore.setGameMode(roomId, playerInfo.player.id, gameMode, mosaicConfig);
      if (res.success) {
        const room = roomStore.getRoom(roomId);
        const players = roomStore.getPlayers(roomId);
        io.to(roomId).emit('room:config_updated', { room, players });
      }
    });

    // 9. Change Team Sector
    socket.on('game:set_team', (data: { roomId: string; playerId: string; sectorIndex: number }) => {
      const { roomId, playerId, sectorIndex } = data;
      const playerInfo = roomStore.getPlayerBySocket(socket.id);
      if (!playerInfo || playerInfo.roomId !== roomId) return;

      if (roomStore.setPlayerTeamSector(roomId, playerId, sectorIndex)) {
        io.to(roomId).emit('players:updated', roomStore.getPlayers(roomId));
      }
    });

    // 10. Reveal Step Update (Blind Mosaic Stage)
    socket.on('game:reveal_step', (data: { roomId: string; step: number }) => {
      const { roomId, step } = data;
      const playerInfo = roomStore.getPlayerBySocket(socket.id);
      if (!playerInfo || playerInfo.roomId !== roomId) return;

      const res = roomStore.setRevealStep(roomId, playerInfo.player.id, step);
      if (res.success) {
        io.to(roomId).emit('game:status_changed', {
          roomId,
          status: res.status,
          revealStep: res.revealStep,
        });
      }
    });

    // 11. Canvas Resync / Delta Sync
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

    // 12. Game Start (Host only)
    socket.on('game:start', (data: { roomId: string }) => {
      const { roomId } = data;
      const playerInfo = roomStore.getPlayerBySocket(socket.id);
      if (!playerInfo || playerInfo.roomId !== roomId) return;

      const result = roomStore.startGame(roomId, playerInfo.player.id);
      if (result.success) {
        io.to(roomId).emit('game:started', { roomId, status: 'playing', revealStep: 0 });
      } else {
        socket.emit('error', { code: 'START_GAME_FAILED', message: result.error || 'Failed to start game' });
      }
    });

    // 13. Game Finish (Host only)
    socket.on('game:finish', (data: { roomId: string }) => {
      const { roomId } = data;
      const playerInfo = roomStore.getPlayerBySocket(socket.id);
      if (!playerInfo || playerInfo.roomId !== roomId) return;

      const result = roomStore.finishGame(roomId, playerInfo.player.id);
      if (result.success) {
        const room = roomStore.getRoom(roomId);
        io.to(roomId).emit('game:finished', {
          roomId,
          status: room?.status || 'finished',
          revealStep: room?.revealStep || 0,
        });
      } else {
        socket.emit('error', { code: 'FINISH_GAME_FAILED', message: result.error || 'Failed to finish game' });
      }
    });

    // 14. Clear Canvas (Host only)
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

    // 15. Disconnect
    socket.on('disconnect', () => {
      rateLimiter.remove(socket.id);
      const disconnected = roomStore.disconnectSocket(socket.id);
      if (disconnected) {
        const { roomId } = disconnected;
        io.to(roomId).emit('players:updated', roomStore.getPlayers(roomId));
      }
    });
  });
}
