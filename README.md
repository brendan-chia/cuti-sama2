# CutiSama2

CutiSama2 is an Expo React Native application for collaborative group-trip planning. Slice 1 implements anonymous organiser authentication and persistent Trip Room creation for locked, shortlist, and undecided planning modes.

## Requirements

- Node.js 24 or later
- Android Studio, Xcode, or an Expo-compatible device
- A Supabase project with Anonymous Sign-Ins enabled
- Supabase CLI and Docker for local database and Edge Function tests

## Configure

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Start the local Supabase stack with `npx supabase start` or link a hosted project.
4. Apply `supabase/migrations/0001_trips_members.sql` and deploy the `create-trip` function.

Only the Supabase URL and publishable key belong in the Expo environment. Never add a secret/service-role key or future Groq credentials to an `EXPO_PUBLIC_` variable.

## Run

```text
npm install
npm start
```

## Verify

```text
npm run typecheck
npm test
npx expo export --platform web
npx supabase test db
deno test --allow-env supabase/functions/create-trip/index.test.ts
maestro test e2e/create-trip.yaml
```

The Supabase, Deno, and Maestro commands require their respective local toolchains. Jest tests do not require a live backend.
