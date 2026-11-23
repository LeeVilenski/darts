import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { LifetimeStats } from '../engine/stats/lifetime';
import type { CloudProfile } from './sync';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Accounts are optional: without these env vars the game is guest-only. */
export const cloudConfigured = Boolean(URL && KEY);

let client: Promise<SupabaseClient> | null = null;

/** The Supabase SDK is only downloaded when accounts are configured and used. */
function supabase(): Promise<SupabaseClient> {
  if (!cloudConfigured) throw new Error('Accounts are not configured');
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL!, KEY!, { auth: { persistSession: true, detectSessionInUrl: true } }),
  );
  return client;
}

export type CloudUser = Pick<User, 'id' | 'email'>;

export async function currentUser(): Promise<CloudUser | null> {
  const { data } = await (await supabase()).auth.getSession();
  return data.session?.user ?? null;
}

export async function onAuthChange(cb: (user: CloudUser | null) => void): Promise<() => void> {
  const { data } = (await supabase()).auth.onAuthStateChange((_e, session) =>
    cb(session?.user ?? null),
  );
  return () => data.subscription.unsubscribe();
}

export async function signInWithEmail(email: string) {
  const { error } = await (
    await supabase()
  ).auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const { error } = await (
    await supabase()
  ).auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  await (await supabase()).auth.signOut();
}

export async function fetchProfile(userId: string): Promise<CloudProfile | null> {
  const { data, error } = await (
    await supabase()
  )
    .from('profiles')
    .select('settings, lifetime, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as CloudProfile | null;
}

export async function saveProfile(userId: string, settings: object, lifetime: LifetimeStats) {
  const { error } = await (
    await supabase()
  )
    .from('profiles')
    .upsert({ user_id: userId, settings, lifetime, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function saveMatch(userId: string, mode: string, summary: object) {
  const { error } = await (
    await supabase()
  )
    .from('matches')
    .insert({ user_id: userId, mode, summary });
  if (error) throw error;
}
