import { create } from 'zustand';
import type { User } from '../lib/api';
import { getStoredUser, setSession, clearSession, me } from '../lib/api';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: getStoredUser(),
  loading: false,
  error: null,

  setAuth: (user, token) => {
    setSession(token, user);
    set({ user });
  },

  logout: () => {
    clearSession();
    set({ user: null });
  },

  refresh: async () => {
    const { user } = await me();
    set({ user });
  },

  hydrate: async () => {
    const stored = getStoredUser();
    if (!stored) return;
    set({ user: stored, loading: true });
    try {
      const { user } = await me();
      set({ user, loading: false });
    } catch {
      clearSession();
      set({ user: null, loading: false });
    }
  }
}));