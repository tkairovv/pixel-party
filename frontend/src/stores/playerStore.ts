import { create } from 'zustand';

interface PlayerState {
  myPlayerId: string | null;
  nickname: string;
  color: string;
  selectedFilterPlayerId: string | null;
  hoveredPlayerId: string | null;

  setMyPlayer: (id: string, nickname: string, color: string) => void;
  setSelectedFilterPlayerId: (id: string | null) => void;
  togglePlayerFilter: (id: string) => void;
  setHoveredPlayerId: (id: string | null) => void;
  loadStoredProfile: () => { storedId: string | null; storedNickname: string | null };
}

export const usePlayerStore = create<PlayerState>((set) => ({
  myPlayerId: localStorage.getItem('pixel_party_player_id') || null,
  nickname: localStorage.getItem('pixel_party_nickname') || '',
  color: '#F97316',
  selectedFilterPlayerId: null,
  hoveredPlayerId: null,

  setMyPlayer: (id, nickname, color) => {
    localStorage.setItem('pixel_party_player_id', id);
    localStorage.setItem('pixel_party_nickname', nickname);
    set({ myPlayerId: id, nickname, color });
  },

  setSelectedFilterPlayerId: (id) => set({ selectedFilterPlayerId: id }),

  togglePlayerFilter: (id) =>
    set((state) => ({
      selectedFilterPlayerId: state.selectedFilterPlayerId === id ? null : id,
    })),

  setHoveredPlayerId: (id) => set({ hoveredPlayerId: id }),

  loadStoredProfile: () => ({
    storedId: localStorage.getItem('pixel_party_player_id'),
    storedNickname: localStorage.getItem('pixel_party_nickname'),
  }),
}));
