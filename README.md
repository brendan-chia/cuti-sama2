# CutiSama2

CutiSama2 is an Expo React Native application for collaborative group-trip planning. Slices 1–3 implement anonymous Trip Room creation, private expiring guest invitations, and a realtime Lobby with persisted readiness and organiser controls.

## Requirements

- Node.js 24 or later
- Android Studio, Xcode, or an Expo-compatible device
- A Supabase project with Anonymous Sign-Ins enabled
- Supabase CLI and Docker for local database and Edge Function tests

## Configure

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Start the local Supabase stack with `npx supabase start` or link a hosted project.
4. Apply the migrations in filename order and deploy all functions under `supabase/functions`.
5. Set the Edge Function secret `INVITE_BASE_URL` to the HTTPS origin that opens the Expo Router app. Do not include a trailing path.

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
deno test supabase/functions/create-trip/index.test.ts supabase/functions/manage-invite/index.test.ts supabase/functions/join-trip/index.test.ts
maestro test e2e/create-trip.yaml e2e/invite-and-join.yaml
```

The Supabase, Deno, and Maestro commands require their respective local toolchains. Jest tests do not require a live backend.

Production HTTPS app links also require the chosen domain in `ios.associatedDomains`, Android intent filters, and the domain's Apple/Android association files. The custom `cutisama2://` scheme remains available for development.

The Lobby uses a private Supabase Realtime channel. Broadcast payloads contain only scoped entity/member identifiers; clients refetch the authoritative RLS-protected lobby after each event. Readiness and planning-start state are persisted independently from transient online presence.
