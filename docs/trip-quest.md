# Trip quest

New trips use a shared, five-chapter planning quest. The lobby collects the group first; starting planning opens the quest and fixes its participant roster. Participants with the same member session or recovered identity can return to the saved stage on another device. Realtime updates, focus refresh, and a 15-second foreground poll keep the room current.

## Flow and roles

| Chapter | Everyone | Organiser | Unlock condition |
| --- | --- | --- | --- |
| Dates | Save an available date range; update it before dates are locked. | Choose a duration and request suggested travel windows, then lock one. | Everyone has submitted availability and the chosen period fits their shared window. |
| Wishlist | Choose 1–3 distinct favourite countries. Picks can be edited before the voting deck opens. | Participate with the same three-slot limit. | Everyone has submitted at least one country. |
| Vote | Swipe right to agree or left to pass on every country; equivalent buttons and vote review are available. | Break a positive tie by choosing one of the tied leaders, or restart wishlists after an all-pass result. | Everyone has voted on every distinct country. A sole positive leader is selected automatically. |
| Explore | Pan, zoom, and locate tourist attractions on the selected country's map. | Collect at least one attraction and save the group's stops. | The organiser saves valid attractions belonging to the winning country. |
| Budget | Submit a whole-MYR maximum per person for the entire trip. | Complete the quest after everyone submits a budget. | Everyone has a saved budget. |

Duplicate country nominations appear once in the voting deck. Results remain hidden until every participant finishes the deck. Each participant has one agree/pass vote per country and may revise it before the reveal. The organiser's tie-break choice is restricted to countries with the highest positive vote count.

The five stamps represent completed planning chapters. The final shared ticket contains the chosen dates, country, attraction wishlist, and spending ceiling. Attractions are ideas for the group; this flow does not automatically schedule an itinerary, calculate routes, or make bookings.

## Travel-window suggestions

The `suggest-trip-period` Edge Function reads the authenticated member's shared quest snapshot. Only the organiser can request suggestions. It generates feasible future periods of 2–14 days inside the intersection of all participants' availability, preferring Saturday–Sunday weekend coverage and distinct alternatives. The screen offers 2, 3, 5, 7, 10, and 14-day durations.

When `GROQ_API_KEY` and `GROQ_STRUCTURED_OUTPUT_MODEL` are configured, Groq ranks existing candidate IDs. It cannot supply different dates or unsupported travel claims: the response must contain the requested number of unique, known IDs, and date labels and explanations come from the validated calendar data. Only shared candidate dates and weekday/weekend counts are sent to the provider, not participants' individual availability ranges or identities.

Without the optional credentials, or if the provider times out, fails, or returns invalid output, the function returns calendar-ranked suggestions with a visible `calendar` source. AI responses use a visible `groq` source. These suggestions do not account for public holidays, weather, destination seasonality, visa requirements, flight schedules, or prices. The weekend convention is Saturday–Sunday.

## Country and map scope

The initial catalogue includes 24 countries with three real attraction locations each: Malaysia, Thailand, Indonesia, Vietnam, Japan, South Korea, Singapore, Taiwan, Philippines, Cambodia, Laos, India, Sri Lanka, Nepal, Australia, New Zealand, United Kingdom, France, Italy, Spain, Türkiye, United Arab Emirates, United States, and Canada.

`packages/contracts/src/countries.ts` contains the 72 attraction IDs, representative coordinates, descriptions, and primary reference links. SQL seeds the same IDs in `trip_quest_attractions`; adding a country or attraction requires updating both the application catalogue/contracts and a database migration. Map coordinates are for discovery, not entrance locations or turn-by-turn navigation. Country photos are remotely hosted inspiration images and may fall back to a flag if unavailable.

The map uses Web Mercator projection and real OpenStreetMap raster tiles through the existing Expo Image package. It requests only the tiles intersecting the current viewport, updates the requested viewport when dragging ends, and uses disk/memory image caching. There is no country download, tile prefetch, or offline-map feature. Native requests identify the application; web requests retain the browser's normal Referer and HTTP caching. Attribution links remain visible on the map. Usage follows the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/).

Pan gestures, zoom buttons, an overview reset, and per-attraction Locate buttons support exploration. Checkboxes in the text list provide an alternative to selecting map pins. If tiles fail, the attraction list remains usable and the map offers a retry. A network connection is needed for fresh map imagery; no map API key or additional map dependency is required.

## Budget meaning

Budgets are whole ringgit amounts from RM 1 to RM 1,000,000, per person for the entire trip, including transport, stays, food, and activities. The shared spending ceiling is the lowest submitted limit, so it does not exceed any participant's answer. It is a target the group must plan within, not an estimated price, quote, affordability guarantee, or cost breakdown.

The database restricts individual input rows to their owner. The room exposes submission progress and, after everyone submits, an aggregate budget summary. Aggregate values can reveal information in a small group; the feature does not promise that another person's limit can never be inferred.

## Backend deployment

The UI requires migration `supabase/migrations/0016_trip_quest.sql` and the `suggest-trip-period` Edge Function. From the repository with Supabase CLI authentication and the intended project already linked:

```sh
npx supabase db push
npx supabase functions deploy suggest-trip-period
```

Configure `GROQ_API_KEY` and `GROQ_STRUCTURED_OUTPUT_MODEL` as Supabase Edge Function secrets to enable AI ranking. The selected model must support Groq strict JSON-schema output. Both are optional; calendar suggestions work without them. Keep provider credentials out of `EXPO_PUBLIC_*` variables and the application bundle. Existing Supabase project URL/public client configuration is still required. The function's JWT verification is enabled in `supabase/config.toml`.

The migration creates shared quest state, private participant inputs, the attraction allowlist, membership checks, stage transitions, row-level security, idempotent mutations, and private realtime broadcasts. Quest creation closes invitations and rejects later joins/reactivations. Active member removal triggers reconciliation so removed travellers do not hold up the remaining group. Applying deployment commands is a separate operational step; creating these files does not deploy them.

## Validation and remaining QA

Automated coverage is in `__tests__/quest-screen.test.tsx`, `__tests__/trip-period.test.ts`, `__tests__/quest-map.test.tsx`, `supabase/tests/0010_trip_quest.sql`, and the Edge Function's provider tests. Coverage includes stage gates and roles, the three-country cap, hidden voting results, tie/all-pass behavior, cross-country attraction rejection, valid whole-MYR budgets, calendar boundaries and invented AI output rejection, idempotency, map projection across the antimeridian, visible-only tile selection, and accessible attraction selection.

Relevant commands:

```sh
npm run typecheck
npm run lint
npx jest __tests__/quest-screen.test.tsx __tests__/trip-period.test.ts __tests__/quest-map.test.tsx --runInBand
npx supabase test db
```

The database tests need a running local Supabase database with migrations applied. A native device or browser should also exercise the complete flow with multiple participants, including reconnecting during votes, ties, all-pass results, map gestures, image failures, small-screen wrapping, keyboard navigation, and screen-reader announcements.

During implementation, all 16 SQL migrations were applied unmodified in embedded PostgreSQL (PGlite 0.5.8 with pgcrypto), and all 87 assertions from `supabase/tests/0010_trip_quest.sql` passed. The harness supplied shims for Supabase auth/realtime and pgTAP assertion helpers. This validates database behavior in that harness; it does not replace a deployed Supabase or multiple-client realtime check.

Local validation passed: TypeScript, ESLint, the production Expo web export, all 189 app tests, and three Deno provider tests plus the Edge Function typecheck. After the final layout adjustments, all 42 affected screen/map tests passed again. The updated Maestro creation/restore/quest-entry flow has not been run on a device.

Visual QA has not been completed in the current development session: the connected browser runtime reported no available browsers, and a separate hidden local browser did not produce a usable screenshot. Compiler, lint, and automated tests do not establish native/web visual quality or live backend behavior. Live deployment and integration checks remain separate from local code validation.
