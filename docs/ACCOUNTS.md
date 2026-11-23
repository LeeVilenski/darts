# Accounts & cloud save (optional)

The game is guest-first: with no configuration it stores settings and lifetime stats
in the browser only, and no account UI is shown. Accounts add sign-in (email magic link
or Google) and sync settings, lifetime stats and a match history across devices.

## Setup

1. Create a Supabase project (directly, or via the Vercel Marketplace integration,
   which also sets the env vars for you).
2. Apply `supabase/migrations/0001_profiles_and_matches.sql` (SQL editor or
   `supabase db push`). It creates `profiles` and `matches` with row-level security so
   each user can only read and write their own rows.
3. Auth → URL configuration: set the Site URL to `https://mem-darts.vercel.app` and add
   your preview domain pattern to the redirect allow-list.
4. Optional: Auth → Providers → enable Google (needs a Google OAuth client).
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel (Production and
   Preview) and redeploy. The anon key is public by design; RLS protects the data.
   Never put the service-role key in a `VITE_` variable.

## Sync rules

- First sign-in on a device with guest stats: those stats become the account's.
- Later sign-ins: stats merge per player name (the most recently updated record wins);
  the account's settings replace the device's.
- While signed in, changes are pushed (debounced) and each finished match is logged.
