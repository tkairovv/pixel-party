import { create } from 'zustand';
import { Room, Player, RoomStatus } from '@pixel-party/shared';

interface RoomState {
  room: Room | null;
  players: Player[];
  isHost: boolean;
  setRoom: (room: Room, isHost: boolean) => void;
  setStatus: (status: RoomStatus) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  resetRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  players: [],
  isHost: false,

  setRoom: (room, isHost) => set({ room, isHost }),

  setStatus: (status) =>
    set((state) => (state.room ? { room: { ...state.room, status } } : {})),

  setPlayers: (players) => set({ players }),

  addPlayer: (player) =>
    set((state) => {
      const exists = state.players.some((p) => p.id === player.id);
      if (exists) {
        return {
          players: state.players.map((p) => (p.id === player.id ? player : p)),
        };
      }
      return { players: [...state.players, player] };
    }),

  removePlayer: (playerId) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, connected: false } : p
      ),
    })),

  resetRoom: () => set({ room: null, players: [], isHost: false }),
}));
