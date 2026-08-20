import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface UIState {
  isJoinModalOpen: boolean;
  isQRModalOpen: boolean;
  isPlayersDrawerOpen: boolean;
  isPaletteDrawerOpen: boolean;
  isClearModalOpen: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
  toasts: ToastMessage[];

  setJoinModalOpen: (open: boolean) => void;
  setQRModalOpen: (open: boolean) => void;
  setPlayersDrawerOpen: (open: boolean) => void;
  setPaletteDrawerOpen: (open: boolean) => void;
  setClearModalOpen: (open: boolean) => void;
  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting') => void;

  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  isJoinModalOpen: false,
  isQRModalOpen: false,
  isPlayersDrawerOpen: false,
  isPaletteDrawerOpen: false,
  isClearModalOpen: false,
  connectionStatus: 'disconnected',
  toasts: [],

  setJoinModalOpen: (open) => set({ isJoinModalOpen: open }),
  setQRModalOpen: (open) => set({ isQRModalOpen: open }),
  setPlayersDrawerOpen: (open) => set({ isPlayersDrawerOpen: open }),
  setPaletteDrawerOpen: (open) => set({ isPaletteDrawerOpen: open }),
  setClearModalOpen: (open) => set({ isClearModalOpen: open }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  showToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));

    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
