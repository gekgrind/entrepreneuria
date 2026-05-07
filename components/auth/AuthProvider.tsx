"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toAuthContextUser, type AuthContextUser } from "@/lib/auth/user";

type AuthContextValue = {
  user: AuthContextUser | null;
  loading: boolean;
  refreshUser: () => Promise<AuthContextUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  initialUser: AuthContextUser | null;
  children: ReactNode;
};

export function AuthProvider({ initialUser, children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthContextUser | null>(initialUser);
  const [loading, setLoading] = useState(false);

  const refreshUser = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/auth/user", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        setUser(null);
        return null;
      }

      const payload = (await response.json()) as {
        user?: AuthContextUser | null;
      };
      const nextUser = payload.user ?? null;

      setUser(nextUser);

      return nextUser;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        setUser(toAuthContextUser(session.user));
        void refreshUser();
        return;
      }

      setUser(null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      refreshUser,
    }),
    [loading, refreshUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useUser() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useUser must be used within AuthProvider.");
  }

  return context;
}
