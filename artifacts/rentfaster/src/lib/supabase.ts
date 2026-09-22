import { createClient } from '@supabase/supabase-js';
import { setAuthTokenGetter } from '@workspace/api-client-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anon key must be configured for RentFaster.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

setAuthTokenGetter(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null);

export type AccountRole = 'tenant' | 'landlord' | 'admin';

export type AccountProfile = {
  id: string;
  role: AccountRole;
  name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  verified?: boolean;
};

export async function syncProfile(role?: Exclude<AccountRole, 'admin'>, name?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const response = await fetch('/api/auth/profile', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role, name }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? 'Could not load your RentFaster profile.');
  }

  return response.json() as Promise<AccountProfile>;
}