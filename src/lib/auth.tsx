import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, auth, onSessionExpired } from './api';
import type { Role, User } from '@/types';

interface AuthState {
  user: User | null;
  ready: boolean;
  bootError: string | null;
  login: (email: string, password: string, remember: boolean) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const clear = useCallback(() => {
    qc.clear();
    setUser(null);
  }, [qc]);

  const logout = useCallback(async () => {
    await auth.logout();
    clear();
  }, [clear]);

  useEffect(() => {
    onSessionExpired((reason) => {
      clear();
      toast.error(reason);
    });
    (async () => {
      if (!(await auth.hasSession())) return;
      try {
        setUser((await api.get<{ user: User }>('/auth/me')).user);
      } catch (e) {
        if (!(e instanceof ApiError && (e.status === 401 || e.status === 403))) setBootError((e as Error).message);
      }
    })().finally(() => setReady(true));
  }, [clear]);

  const login = useCallback(
    async (email: string, password: string, remember: boolean) => {
      const u = await auth.login(email, password, remember, navigator.userAgent.slice(0, 120));
      qc.clear();
      setBootError(null);
      setUser(u);
      return u;
    },
    [qc],
  );

  return <AuthCtx.Provider value={{ user, ready, bootError, login, logout, setUser }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Signed-in user (only call inside protected routes). */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('No user');
  return user;
}

export const homeFor = (role: Role) => (role === 'accounts' ? '/finance' : '/');

export const can = {
  manageLeads: (r: Role) => r === 'admin' || r === 'manager',
  assignLeads: (r: Role) => r === 'admin' || r === 'manager',
  sales: (r: Role) => r === 'admin' || r === 'manager' || r === 'sales',
  finance: (r: Role) => r === 'admin' || r === 'accounts',
  editProperties: (r: Role) => r === 'admin' || r === 'manager',
  reports: (r: Role) => r === 'admin' || r === 'manager' || r === 'accounts',
  resetCodes: (r: Role) => r === 'admin' || r === 'manager',
  admin: (r: Role) => r === 'admin',
};
