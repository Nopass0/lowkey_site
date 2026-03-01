import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserInfo {
  login: string;
  avatarHash: string; // generated hash for avatar
}

interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  login: (login: string) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      login: (loginStr) => {
        // simple hash mock for avatar
        let hash = 0;
        for (let i = 0; i < loginStr.length; i++) {
          hash = loginStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        const avatarHash = Math.abs(hash).toString(16).substring(0, 6) + "ff";

        set({
          isAuthenticated: true,
          user: { login: loginStr, avatarHash },
        });
      },
      logout: () => set({ isAuthenticated: false, user: null }),
    }),
    {
      name: "lowkey-auth",
    },
  ),
);
