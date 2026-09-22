import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase, syncProfile, type AccountProfile, type AccountRole } from './supabase';

type AuthContextValue = {
  loading: boolean;
  profile: AccountProfile | null;
  session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
  signIn: (email: string, password: string) => Promise<AccountProfile>;
  signUp: (email: string, password: string, role: 'tenant' | 'landlord') => Promise<AccountProfile | null>;
  signInWithGoogle: (role: 'tenant' | 'landlord') => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthContextValue['session']>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        try {
          const pendingRole = window.localStorage.getItem('rentfaster.pending-role') as 'tenant' | 'landlord' | null;
          const nextProfile = await syncProfile(pendingRole ?? undefined);
          if (pendingRole) window.localStorage.removeItem('rentfaster.pending-role');
          setProfile(nextProfile);
        } finally {
          if (mounted) setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    void load();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const pendingRole = window.localStorage.getItem('rentfaster.pending-role') as 'tenant' | 'landlord' | null;
      void syncProfile(pendingRole ?? undefined).then((nextProfile) => {
        if (pendingRole) window.localStorage.removeItem('rentfaster.pending-role');
        setProfile(nextProfile);
        setLoading(false);
      }).catch(() => setLoading(false));
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    profile,
    session,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const nextProfile = await syncProfile();
      if (!nextProfile) throw new Error('Your account profile could not be loaded.');
      setProfile(nextProfile);
      return nextProfile;
    },
    async signUp(email, password, role) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role } },
      });
      if (error) throw error;
      if (data.session) {
        const nextProfile = await syncProfile(role);
        setProfile(nextProfile);
        return nextProfile;
      }
      return null;
    },
    async signInWithGoogle(role) {
      window.localStorage.setItem('rentfaster.pending-role', role);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${window.location.pathname}`,
          queryParams: { access_type: 'offline', prompt: 'consent', role },
        },
      });
      if (error) throw error;
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  }), [loading, profile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}