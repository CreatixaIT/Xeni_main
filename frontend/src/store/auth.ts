import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string;
  country_code?: string;
  preferred_language: string;
  is_email_verified: boolean;
  two_fa_enabled: boolean;
}

interface Subscription {
  plan_tier: string;
  agents: string[];
  max_tasks_per_day: number;
  storage_mb: number;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  subscription: Subscription | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setSubscription: (sub: Subscription) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      subscription: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      setSubscription: (subscription) => set({ subscription }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, subscription: null, isAuthenticated: false }),
    }),
    { name: 'xeni-auth' }
  )
);
