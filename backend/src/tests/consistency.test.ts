import { describe, it, expect, beforeEach } from 'vitest';
import { RoomStore } from '../store/roomStore.js';
import { pixelKey } from '@pixel-party/shared';

describe('Realtime Consistency & Authoritative LWW Engine Tests', () => {
  let store: RoomStore;
  let roomId: string;
  let hostId: string;
  let alexId: string;
  let maxId: string;

  beforeEach(() => {
    store = new RoomStore();
    const created = store.createRoom({ width: 64, height: 64 });
    roomId = created.room.id;
    hostId = created.hostId;

    // Join Alex (Host)
    const joinAlex = store.joinPlayer(roomId, 'Alex', 'socket_alex', hostId);
    if ('error' in joinAlex) throw new Error(joinAlex.error);
    alexId = joinAlex.player.id;

    // Join Max
    const joinMax = store.joinPlayer(roomId, 'Max', 'socket_max');
    if ('error' in joinMax) throw new Error(joinMax.error);
    maxId = joinMax.player.id;

    // Start game
    store.startGame(roomId, alexId);
  });

  // Scenario 1: Standard authoritative change
  it('Test 1: Normal change - Authoritative sequence and ownership assignment', () => {
    const res = store.applyPixelBatch(roomId, alexId, 'op_alex_1', [
      { x: 10, y: 10, color: '#FF0000' },
    ]);

    expect(res.error).toBeUndefined();
    expect(res.updates).toHaveLength(1);
    const update = res.updates[0];
    expect(update.x).toBe(10);
    expect(update.y).toBe(10);
    expect(update.color).toBe('#FF0000');
    expect(update.ownerId).toBe(alexId);
    expect(update.seq).toBe(1001);

    const snapshot = store.getSnapshot(roomId);
    expect(snapshot).not.toBeNull();
    const pixel = snapshot!.pixels[pixelKey(10, 10)];
    expect(pixel).toBeDefined();
    expect(pixel.color).toBe('#FF0000');
    expect(pixel.ownerId).toBe(alexId);
    expect(pixel.seq).toBe(1001);
  });

  // Scenario 2: Two different pixels concurrent draw
  it('Test 2: Two different pixels - Both persist without interference', () => {
    const resAlex = store.applyPixelBatch(roomId, alexId, 'op_alex_2', [
      { x: 10, y: 10, color: '#FF0000' },
    ]);
    const resMax = store.applyPixelBatch(roomId, maxId, 'op_max_2', [
      { x: 20, y: 20, color: '#0000FF' },
    ]);

    expect(resAlex.updates[0].seq).toBe(1001);
    expect(resMax.updates[0].seq).toBe(1002);

    const snapshot = store.getSnapshot(roomId)!;
    expect(snapshot.pixels[pixelKey(10, 10)]).toEqual({
      color: '#FF0000',
      ownerId: alexId,
      seq: 1001,
    });
    expect(snapshot.pixels[pixelKey(20, 20)]).toEqual({
      color: '#0000FF',
      ownerId: maxId,
      seq: 1002,
    });

    const players = store.getPlayers(roomId);
    const alex = players.find((p) => p.id === alexId);
    const max = players.find((p) => p.id === maxId);
    expect(alex?.pixelCount).toBe(1);
    expect(max?.pixelCount).toBe(1);
  });

  // Scenario 3: Conflict resolution on same pixel (LWW by sequence)
  it('Test 3: Conflict on same pixel - Server sequence determines winner', () => {
    // Alex draws (10,10) RED
    store.applyPixelBatch(roomId, alexId, 'op_alex_3', [{ x: 10, y: 10, color: '#FF0000' }]);
    // Max overwrites (10,10) with BLUE
    store.applyPixelBatch(roomId, maxId, 'op_max_3', [{ x: 10, y: 10, color: '#0000FF' }]);

    const snapshot = store.getSnapshot(roomId)!;
    const pixel = snapshot.pixels[pixelKey(10, 10)];
    expect(pixel.color).toBe('#0000FF');
    expect(pixel.ownerId).toBe(maxId);
    expect(pixel.seq).toBe(1002);

    // Ownership stats updated properly
    const players = store.getPlayers(roomId);
    const alex = players.find((p) => p.id === alexId);
    const max = players.find((p) => p.id === maxId);
    expect(alex?.pixelCount).toBe(0);
    expect(max?.pixelCount).toBe(1);
  });

  // Scenario 4: Duplicate operation idempotency
  it('Test 4: Duplicate operation - Idempotent, does not re-apply or increment sequence', () => {
    const res1 = store.applyPixelBatch(roomId, alexId, 'op_unique_123', [
      { x: 15, y: 15, color: '#00FF00' },
    ]);
    expect(res1.alreadyApplied).toBeUndefined();
    expect(res1.updates[0].seq).toBe(1001);

    // Send the exact same operationId again
    const res2 = store.applyPixelBatch(roomId, alexId, 'op_unique_123', [
      { x: 15, y: 15, color: '#00FF00' },
    ]);
    expect(res2.alreadyApplied).toBe(true);
    expect(res2.updates[0].seq).toBe(1001);

    // Sequence remains 1001
    const room = store.getRoom(roomId)!;
    expect(room.sequence).toBe(1001);
  });

  // Scenario 5: Out-of-order events & Delta Resync
  it('Test 5: Delta resync - Client missing sequence receives delta updates', () => {
    store.applyPixelBatch(roomId, alexId, 'op_1', [{ x: 1, y: 1, color: '#111111' }]); // seq 1001
    store.applyPixelBatch(roomId, maxId, 'op_2', [{ x: 2, y: 2, color: '#222222' }]);  // seq 1002
    store.applyPixelBatch(roomId, alexId, 'op_3', [{ x: 3, y: 3, color: '#333333' }]); // seq 1003

    // Client who only saw up to 1001 asks for delta
    const syncRes = store.getDeltaOrSnapshot(roomId, 1001);
    expect(syncRes).not.toBeNull();
    expect(syncRes!.type).toBe('delta');
    expect(syncRes!.updates).toHaveLength(2);
    expect(syncRes!.updates![0].seq).toBe(1002);
    expect(syncRes!.updates![1].seq).toBe(1003);
  });

  // Scenario 6: Reconnect synchronization
  it('Test 6: Reconnect - Disconnected client retrieves delta or snapshot on reconnect', () => {
    // Client disconnects
    store.disconnectSocket('socket_alex');
    const playersBefore = store.getPlayers(roomId);
    const alexBefore = playersBefore.find((p) => p.id === alexId);
    expect(alexBefore?.connected).toBe(false);

    // Server mutates canvas while Alex is disconnected
    store.applyPixelBatch(roomId, maxId, 'op_while_offline', [
      { x: 5, y: 5, color: '#555555' },
    ]);

    // Alex reconnects with new socket ID
    const reconnectRes = store.joinPlayer(roomId, 'Alex', 'socket_alex_new', alexId);
    expect('player' in reconnectRes).toBe(true);
    if ('player' in reconnectRes) {
      expect(reconnectRes.player.connected).toBe(true);
      expect(reconnectRes.isReconnect).toBe(true);
    }

    // Alex asks for sync from last sequence 1000
    const sync = store.getDeltaOrSnapshot(roomId, 1000);
    expect(sync!.type).toBe('delta');
    expect(sync!.updates).toHaveLength(1);
    expect(sync!.updates![0].x).toBe(5);
    expect(sync!.updates![0].y).toBe(5);
  });

  // Scenario 7: Simultaneous reconnect snapshot consistency
  it('Test 7: Simultaneous reconnect - Multiple clients receive identical authoritative snapshot', () => {
    store.applyPixelBatch(roomId, alexId, 'op_a', [{ x: 10, y: 10, color: '#AAAAAA' }]);
    store.applyPixelBatch(roomId, maxId, 'op_b', [{ x: 20, y: 20, color: '#BBBBBB' }]);

    const snap1 = store.getSnapshot(roomId);
    const snap2 = store.getSnapshot(roomId);

    expect(JSON.stringify(snap1)).toBe(JSON.stringify(snap2));
    expect(snap1?.sequence).toBe(1002);
  });

  // Scenario 8: Optimistic conflict rollback
  it('Test 8: Client authoritative update reconciliation', () => {
    // Simulated Client local state
    const clientLocalPixels: Record<string, { color: string | null; ownerId: string | null; seq: number }> = {};

    function clientApplyAuthoritative(update: any) {
      const key = pixelKey(update.x, update.y);
      const current = clientLocalPixels[key];
      // Only apply if incoming seq >= current seq
      if (!current || update.seq >= current.seq) {
        if (update.color === null) {
          delete clientLocalPixels[key];
        } else {
          clientLocalPixels[key] = {
            color: update.color,
            ownerId: update.ownerId,
            seq: update.seq,
          };
        }
      }
    }

    // Client optimistically painted RED locally with tentative seq 0
    clientLocalPixels[pixelKey(10, 10)] = { color: '#FF0000', ownerId: alexId, seq: 0 };

    // Server accepted Max's operation with seq 1001 (BLUE)
    const res = store.applyPixelBatch(roomId, maxId, 'op_conflict_server', [
      { x: 10, y: 10, color: '#0000FF' },
    ]);

    // Client receives server update
    clientApplyAuthoritative(res.updates[0]);

    // Client's state now matches server authoritative state
    expect(clientLocalPixels[pixelKey(10, 10)].color).toBe('#0000FF');
    expect(clientLocalPixels[pixelKey(10, 10)].ownerId).toBe(maxId);
    expect(clientLocalPixels[pixelKey(10, 10)].seq).toBe(1001);
  });
});
