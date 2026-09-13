# Trip quest

New trips use a shared, five-chapter planning quest followed by Logistics. The lobby collects the group first; starting planning opens the quest and fixes its participant roster. Participants with the same member session or recovered identity can return to the saved stage on another device. Realtime updates, focus refresh, and a 15-second foreground poll keep the room current.

## Flow and roles

| Chapter | Everyone | Organiser | Unlock condition |
| --- | --- | --- | --- |
| Dates | Save an available date range; update it before dates are locked. | Choose a duration and request suggested travel windows, then lock one. | Everyone has submitted availability and the chosen period fits their shared window. |
| Budget | Privately save comfortable spending and an absolute maximum for the whole trip. | Continue to Wishlist when all active travellers submit. | Every active traveller has a valid saved pair. |
| Wishlist | Choose 1–3 distinct favourite countries. Picks can be edited before the voting deck opens. | Participate with the same three-slot limit. | Everyone has submitted at least one country. |
| Vote | Swipe right to agree or left to pass on every country; equivalent buttons and vote review are available. | Break a positive tie by choosing one of the tied leaders, or restart wishlists after an all-pass result. | Everyone has voted on every distinct country. A sole positive leader is selected automatically. |
| Explore | Pan, zoom, and locate tourist attractions on the selected country's map. | Collect at least one attraction and save the group's stops. | The organiser saves valid attractions belonging to the winning country. |
| Logistics | Save personal inbound/return transport; add stay options; vote for one stay. | Confirm one stay, review the summary and generate, or skip for a draft. | Budget is complete; unknown logistics do not block draft generation. |

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

Each private `trip_quest_inputs` row stores `comfortable_budget_myr` and `max_budget_myr`, exposed only to its owner as `ownBudget.comfortableBudgetMYR` and `ownBudget.maxBudgetMYR`. Both are whole-trip, per-person amounts from RM 1 to RM 1,000,000; maximum must be at least comfortable spending.

After every active traveller submits, `budgetSummary` contains only `submittedCount`, `crewComfortCeiling` (minimum comfortable spending), `crewHardCeiling` (minimum maximum), and `currency`. There is no averaging, median constraint, individual budget list, or lowest-budget owner. Inactive travellers neither block readiness nor contribute to ceilings. Existing input RLS remains owner-only; realtime broadcasts are invalidation notices with no budget values.

Costs up to and including the comfort ceiling are comfortable. Costs above comfort through the hard ceiling are stretch. Costs above the hard ceiling are infeasible. Logistics and itinerary hard constraints use the hard ceiling. The Budget screen shows the comfort and flexible zones only after all submissions; equal endpoints show no extra stretch room. Destination-specific AI recommendations are no longer mounted in Chapter 2 because the destination has not been chosen yet; the existing recommendation service remains available to later logistics.

`packages/contracts/src/budget.ts` contains pure validation, crew aggregation, affordability and participant strain helpers. Strain is zero at/below comfort, `(cost - comfort) / (maximum - comfort)` within the range, and `{ strain: null, infeasible: true }` above maximum. Equal endpoints never divide by zero. Positive strain up to 0.25 is `slight_stretch`, up to 0.75 is `stretch`, and above 0.75 is `near_limit`; the thresholds live in one constant. Anonymous affordability counts are available for future use in a trusted context. Do not send private input arrays to other clients. Crew Fit is not implemented.

### Existing rooms and rollout

Apply `0038_private_budget_ranges.sql` with the matching client and Edge Function updates. The new client intentionally rejects the old single-value response; old clients cannot submit ambiguous single-amount budget actions. No live database is modified by adding this migration file.

The migration renames the existing private budget column to the maximum field and backfills comfort with the same old amount, preserving historical affordability without granting additional flexibility. Old Budget-stage rooms resume Logistics after confirmation. Other rooms with missing active budgets temporarily return to Budget and resume their previous stage via `budget_resume_stage`; saved dates, picks, ballots, destination, attractions and logistics are retained. Rooms with complete legacy budgets retain their stage. Revisions increase to invalidate previous itinerary inputs and refresh observers.

Quest screens load authoritative RPC snapshots directly rather than using the generic offline room cache. Persisted operation metadata contains only a key and payload fingerprint; new two-field payloads receive new keys. Completed request retries return a fresh room snapshot through the new RPC contract.

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


## Quest 6: Logistics

This MVP covers transport and accommodation only. Each traveller saves one inbound and one return journey (flight, train, bus or car), with local timestamps and explicit UTC offsets, a per-person MYR estimate, optional provider link, and proposed/selected/booked status. Editing the saved entry changes their choice; only selected/booked entries constrain generation. No group voting on individual transport.

Travellers add provider stay listings with an image URL, area, map coordinates, dates, total group price, rating out of 10, distance description and provider booking link. Listings are member-entered estimates, not live availability or hotel-search results. Multiple options can be compared in-app, with equal per-person price and one changeable vote per traveller. Only the organiser confirms the stay. View / Book opens an HTTP(S) provider link; payment remains with the provider.

The Quest 5 spending ceiling remains the whole-trip limit. Logistics subtracts each person's selected inbound/return costs and an equal, conservatively rounded stay share. The generator's activity ceiling is the lowest remaining amount across active travellers, so a traveller with expensive transport is not forced over budget by an average. Missing costs are explicitly provisional; selected costs exceeding the ceiling must be corrected.

The organiser reviews arrivals, departures, stay, average transport and remaining budget before completing. Confirmation includes the reviewed quest revision, preventing stale summary approval. Skip for now leads to the same review and allows draft generation with incomplete journeys or no stay. The app and saved AI output display: “Schedule may change once transport and accommodation are confirmed.” Existing completed quests without logistics also generate drafts. Edit logistics reopens the stage; subsequent generation uses a new revision and invalidates stale generated plans.

Generation receives a normalized logistics snapshot, excluding booking links, images, vote records and provider text. It enforces the latest arrival and earliest departure across time zones, deducts known logistics once, and prompts for accommodation-based daily starts and realistic transfers. Empty activity days are valid when travel leaves no group time. Hotel proximity and estimated transfer accuracy still depend on the generated plan; only supplied coordinates, travel-window boundaries and numeric budgets receive deterministic checks.

Deploy the app and `generate-itinerary` Edge Function with the updated contracts, then apply migration `0026_quest_logistics.sql`. Update any other deployed functions that parse the strict QuestRoom schema as part of the same rollout. The new `logistics` payload is not compatible with old strict room parsers. No new provider API key is required.

Validation for this change: app/contract tests, generator tests through a Node compatibility harness, TypeScript, lint, and all 26 migrations applied to isolated PGlite with Supabase auth/realtime/storage shims. Logistics RPC tests cover persistence, supported modes, URLs, voting, organiser checks, stale summaries, budget limits, draft completion, retries and reopening. This does not establish live realtime or device behaviour; no production deployment was performed.

Backend deployment completed on 7 September 2026 to Supabase project `cvgwxbirijgggkkfbojo`: migration `0026`, `generate-itinerary` v12, `revise-itinerary` v8, and `suggest-trip-period` v7. Both quest-consuming functions include the Deno import mapping for the shared logistics contract. All three functions report ACTIVE. The 12 assertions in `supabase/tests/0015_logistics.sql` passed on the remote database in a rollback transaction. The unrelated pending migration `0025_social_post_media.sql` was excluded using an isolated deployment workdir; a later rollout of that feature will need `db push --include-all`. This deployment updates the backend; the changed screens are in the local Expo app, with no store release or hosted frontend publication performed.


### Logistics access correction

Migration `0027_logistics_edit_access.sql` is deployed to the same project. Completed legacy quests and draft plans keep the transport and accommodation inputs available. Opening a trip does not mutate it; saving transport, a stay option, a vote or a stay decision reopens Logistics and increments the revision atomically. Members edit their own transport, add options and vote; organisers can also enter transport for any active traveller in the trip and retain the final stay decision. Nonparticipants cannot be targeted. Incomplete logistics display Chapter 6 rather than a completed flight plan. Empty accommodation lists open directly into the stay form, and section navigation resets the scroll position so its inputs are visible.

Verification: 231 app tests, TypeScript, lint and the production web export passed. Remote rollback-only suites passed 14 Logistics and 7 access-control assertions. An isolated Edge preview with fixture RPC responses exercised organiser transport entry for another traveller, member self-entry, stay creation, organiser confirmation, member voting and mobile overflow. The static preview still reports the previously documented React hydration warning on direct dynamic-trip navigation; native-device QA has not been performed.

Deployment numbering: remote 0037 was already occupied by `trip_workspace`; its applied SQL is restored locally as `0037_trip_workspace.sql`. The private budget migration is 0038 and also updates the workspace legacy importer to read the renamed hard maximum.
