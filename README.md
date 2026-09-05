# CutiSama2

CutiSama2 is an Expo React Native app that turns group trip planning into a five-chapter quest, from shared availability to a saved destination, attraction wishlist and budget.

## Current system

Name a room, invite the crew and confirm everyone is ready in the lobby. The quest then awards one shared stamp per chapter:

1. **Dates:** everyone submits availability. The organiser requests AI-ranked feasible travel windows, with a clearly labelled calendar fallback, then locks the dates.
2. **Wishlist:** each traveller submits one to three countries from the 24-country collection. Picks stay private until all active travellers submit.
3. **Vote:** the group’s unique countries become a swipe deck. Left means pass, right means agree; buttons provide an accessible alternative. Results reveal after all ballots. The most-liked country wins, ties go to the organiser, and zero likes reopen wishlists.
4. **Explore:** the winning country opens on an interactive OpenStreetMap map, with 72 bundled attractions across the collection. The organiser selects the group’s stops.
5. **Budget:** everyone enters a maximum whole-trip budget in MYR. The shared spending ceiling uses the lowest limit. The organiser completes the quest after all budgets arrive.

The final plan saves the dates, country, attraction wishlist and budget. It is not a scheduled or priced itinerary. See [Trip quest mechanics and release notes](docs/trip-quest.md).

Apply migration `0016_trip_quest.sql` and deploy the `suggest-trip-period` Edge Function before using the new quest. Existing preference, destination and itinerary routes remain available for older workflows; their data has not been migrated into quest records. New rooms use the quest flow.

## Technical stack

- Expo SDK 57 and Expo Router
- React 19.2 and React Native 0.86
- TypeScript 6
- React Native Gesture Handler and Reanimated
- Supabase Auth, Postgres, Row Level Security, Realtime, and Edge Functions
- Zod contracts shared across the app and backend
- Groq structured output for optional reveal wording, itinerary generation, and bounded revisions
- Jest, React Native Testing Library, pgTAP, Deno tests, and Maestro

## Reliability and privacy

- Anonymous identities persist in secure device storage and have an explicit recovery path when an identity is lost.
- Room data is cached for offline recovery and refreshed from the authoritative backend after reconnecting.
- Realtime broadcasts carry only scoped identifiers; clients refetch RLS-protected state after receiving an event.
- Preference choices stay private during collection and are returned only after reveal.
- Accessibility requirements remain private unless the member explicitly consents to group attribution.
- Mutating workflows use persistent idempotency keys to prevent duplicate submissions and generated versions.
- Group-match facts are deterministic and source-linked. AI can rewrite display prose but cannot create new conclusions.
- Generated itineraries are schema checked and rejected when they conflict with locked destinations, hard constraints, provenance, or privacy rules.

## Requirements

- Node.js 22.13 or later
- npm
- Android Studio, Xcode, or an Expo-compatible device
- A Supabase project with Anonymous Sign-Ins enabled
- Supabase CLI and Docker for local database tests
- Deno for Edge Function tests
- Maestro for end-to-end mobile tests

## Configure the app

1. Install dependencies:

   ```text
   npm install
   ```

2. Copy `.env.example` to `.env`.

3. Set the public Expo variables:

   ```text
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
   ```

4. Start Supabase locally with `npx supabase start`, or link a hosted project with the Supabase CLI.

Only the Supabase URL and publishable key belong in the Expo environment. Never expose a service-role key, Groq key, or other server secret through an `EXPO_PUBLIC_` variable.

## Configure the backend

Apply the database migrations and deploy the Edge Functions:

```text
npx supabase db push
npx supabase functions deploy
```

Configure these Edge Function secrets:

- `INVITE_BASE_URL` — HTTPS origin that opens the Expo Router app, without a trailing path.
- `GROQ_API_KEY` — server-only Groq API key.
- `GROQ_STRUCTURED_OUTPUT_MODEL` — model used for group-match wording and provenance-assisted output.
- `GROQ_ITINERARY_MODEL` — optional itinerary-specific model; falls back to `GROQ_STRUCTURED_OUTPUT_MODEL` when omitted.

Structured itinerary output currently expects a compatible model such as `openai/gpt-oss-20b` or `openai/gpt-oss-120b`. Unsupported or malformed AI output fails closed and is not stored.

Supabase automatically supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. Do not place the service-role key in the mobile app.

## Run

```text
npm start
```

Platform shortcuts:

```text
npm run android
npm run ios
npm run web
```

## Verify

Run the app checks:

```text
npm run typecheck
npm run lint
npm test
npx expo export --platform web
```

Run backend checks:

```text
npx supabase test db
deno test --allow-env supabase/functions
```

Run mobile end-to-end scenarios:

```text
maestro test e2e/create-trip.yaml e2e/invite-and-join.yaml
```

The Supabase database tests require Docker. Deno and Maestro commands require their respective local toolchains. Jest tests do not require a live backend.

## Project structure

```text
src/app/                 Expo Router screens
src/features/            Feature UI and client-side services
src/domain/              Deterministic matching and state logic
src/lib/                 Supabase, identity, storage, and recovery utilities
packages/contracts/      Shared Zod request and response contracts
supabase/functions/      Authenticated Edge Functions
supabase/migrations/     Database schema and security migrations
supabase/tests/          pgTAP database tests
__tests__/               Jest unit and component tests
e2e/                     Maestro mobile journeys
```

## App links

The custom `cutisama2://` scheme is available during development. Production HTTPS invitation links also require:

- the chosen domain in `ios.associatedDomains`;
- Android intent filters; and
- the domain's Apple and Android association files.
