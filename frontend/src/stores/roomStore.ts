import { create } from 'zustand';
import { Room, Player, RoomStatus } from '@pixel-party/shared';

interface RoomState {
  room: Room | null;
  players: Player[];
  isHost: boolean;
  isHostSpectator: boolean;
  isHostPeekActive: boolean; // For host spectator toggle in Blind Mosaic mode

  setRoom: (room: Room, isHost: boolean, isHostSpectator?: boolean) => void;
  updateRoomConfig: (room: Room) => void;
  setStatus: (status: RoomStatus) => void;
  setRevealStep: (step: number) => void;
  toggleHostPeek: () => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  resetRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  players: [],
  isHost: false,
  isHostSpectator: false,
  isHostPeekActive: false,

  setRoom: (room, isHost, isHostSpectator = false) => set({ room, isHost, isHostSpectator }),

  updateRoomConfig: (room) => set({ room }),

  setStatus: (status) =>
    set((state) => (state.room ? { room: { ...state.room, status } } : {})),

  setRevealStep: (revealStep) =>
    set((state) => (state.room ? { room: { ...state.room, revealStep } } : {})),

  toggleHostPeek: () => set((state) => ({ isHostPeekActive: !state.isHostPeekActive })),

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

  resetRoom: () => set({ room: null, players: [], isHost: false, isHostPeekActive: false }),
}));
