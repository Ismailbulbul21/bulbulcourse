import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types/db";

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True until the initial getSession + profile load resolves. */
  initializing: boolean;
  isAdmin: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  initializing: true,
  isAdmin: false,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) =>
    set({ profile, isAdmin: profile?.role === "admin" }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, isAdmin: false });
  },
}));

async function loadProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  useAuthStore.getState().setProfile((data as Profile | null) ?? null);
}

/** Call once at app start. Keeps the store in sync with Supabase Auth. */
export function initAuth() {
  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      useAuthStore.getState().setSession(session);
      if (session?.user) {
        return loadProfile(session.user.id);
      }
    })
    .finally(() => useAuthStore.setState({ initializing: false }));

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session);
    if (session?.user) {
      // Defer Supabase calls out of the auth callback to avoid deadlocks.
      const userId = session.user.id;
      setTimeout(() => void loadProfile(userId), 0);
    } else {
      useAuthStore.getState().setProfile(null);
    }
  });
}
