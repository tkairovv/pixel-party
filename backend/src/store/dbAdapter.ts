/**
 * PostgreSQL Persistence Schema and Storage Adapter Architecture
 *
 * This file outlines the exact PostgreSQL DDL and transaction-safe queries
 * that can be backed by pg/kysely/prisma if connected to a real PostgreSQL instance.
 */

export const POSTGRESQL_SCHEMA_SQL = `
-- 1. Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(16) PRIMARY KEY,
    host_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'waiting',
    sequence BIGINT NOT NULL DEFAULT 1000,
    width INT NOT NULL DEFAULT 64,
    height INT NOT NULL DEFAULT 64,
    created_at BIGINT NOT NULL
);

-- 2. Players Table
CREATE TABLE IF NOT EXISTS players (
    id VARCHAR(64) PRIMARY KEY,
    room_id VARCHAR(16) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    nickname VARCHAR(64) NOT NULL,
    color VARCHAR(32) NOT NULL,
    connected BOOLEAN NOT NULL DEFAULT true,
    joined_at BIGINT NOT NULL
);

-- 3. Pixels Current State Table (Fast Authoritative Reads)
CREATE TABLE IF NOT EXISTS pixels (
    room_id VARCHAR(16) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    x INT NOT NULL,
    y INT NOT NULL,
    color VARCHAR(32),
    owner_id VARCHAR(64),
    sequence BIGINT NOT NULL,
    PRIMARY KEY (room_id, x, y)
);

-- 4. Pixel Operations Log (Audit & Delta Resync)
CREATE TABLE IF NOT EXISTS pixel_operations (
    id BIGSERIAL PRIMARY KEY,
    room_id VARCHAR(16) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL,
    operation_id VARCHAR(64) NOT NULL,
    player_id VARCHAR(64) NOT NULL,
    x INT NOT NULL,
    y INT NOT NULL,
    color VARCHAR(32),
    owner_id VARCHAR(64),
    action VARCHAR(16) NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pixel_ops_room_seq ON pixel_operations(room_id, sequence);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pixel_ops_unique ON pixel_operations(room_id, operation_id, x, y);
`;

export interface IDatabaseAdapter {
  init(): Promise<void>;
  saveRoomState(roomId: string): Promise<void>;
  loadRoomState(roomId: string): Promise<any>;
}

export class InMemoryAdapter implements IDatabaseAdapter {
  async init(): Promise<void> {
    // In-memory initialization
  }
  async saveRoomState(): Promise<void> {}
  async loadRoomState(): Promise<any> {
    return null;
  }
}
