# Station flow and compact scheduling

Logistics contains travel, accommodation and its summary. Generate itinerary saves the existing complete_logistics action, then opens Itinerary as station 7 (station 6 for solo trips, which omit Vote). The existing persisted complete stage represents the Itinerary station. Reopening restores that station; Edit logistics uses the existing organiser-only action. Draft logistics remain labelled. No new database migration is required.

The synthetic planner packs nearby stops into earlier days, targeting up to four visits and about 420 minutes of visits/transfers plus a meal break. Remaining days stay free. When the available dates are exhausted, all remaining selections remain in a compressed draft, with approximate quarter-hour windows. This does not verify routes or opening hours.

# Current itinerary behavior

The trip UI now uses `buildSyntheticItinerary`: all selected places are included, missing durations receive suggested windows, and nearby places are ordered together where coordinates are available. Time, distance, metadata and cost rules no longer exclude stops. Times are draft suggestions, not verified routes. Unknown costs are not displayed as free activities. The strict planner below remains a legacy utility, not the active trip UI generator.

# Deterministic Chapter 5 itinerary

Build Our Trip saves the organiser's chosen attraction IDs through the existing quest RPC, then derives a structured activity plan from those IDs and the locked dates. Group voting, the map and the five-station quest remain in place. All active travellers must vote before the organiser selects a subset; solo trips select directly.

The domain function is `src/domain/itinerary-planner.ts`. It has no React, network, LLM, random or wall-clock dependency. The input adapter is `src/features/quest/planner-input.ts`. The result is rendered inline after a successful save and by `PlannedTripScreen` when the quest opens its itinerary. That route never invokes the legacy AI generator. The legacy generation endpoint rejects planner-enabled quest requests before claiming an operation or calling the LLM. Existing legacy destination-voting itinerary generation remains separate.

## Heuristic v1

- Expand ISO calendar dates inclusively in UTC, avoiding device timezone/DST date shifts.
- Validate unique selected IDs. Report missing metadata and unsupported special-access visits as unscheduled.
- Choose a feasible seed in the densest 25 km neighbourhood, then the smallest neighbourhood distance sum, vibe score and stable ID.
- Greedily choose nearby feasible stops. Vibes only break ties within 2 km of the nearest feasible next stop.
- Plan from 09:00, at most four stops and 480 total minutes daily, including 30-minute inter-stop buffers and a 60-minute meal break. Long visit windows crossing noon include the break without shortening estimated visit time.
- Estimate transfers from Haversine distance × 1.3 at 25 km/h, minimum ten minutes. Limit individual transfers to 80 km and require the same country. Transfers from the previous day's last stop consume the next day's capacity; there is no overnight teleport.
- Keep every date, even empty ones. Return omitted IDs, reasons, warnings and activity-only MYR totals.
- Compare per-person activity allowances with the per-person shared hard ceiling. Exceeding it produces a warning; a lower total does not imply the whole trip is affordable.

Settings live in PLANNER_DEFAULTS and can be overridden by callers. The result includes plannerVersion, costBasis and travelEstimateBasis. It is reusable by a future Plan Rescue implementation; no rescue feature is included here.

## Data and limits

The actual bundle has 120 attractions (24 countries × five), including the earlier 72. All existing descriptions, coordinates, IDs and source URLs are retained. `attraction-planning.ts` supplies consistent category profiles plus explicit overrides. Amounts are provisional category-based planning allowances, not sourced ticket prices. Operator/UNESCO links remain discovery sources and are not presented as price evidence.

Imported places retain their source information. They currently lack duration/cost metadata and remain named omissions instead of receiving invented values. Some expeditions, boat visits and timed evening events also need more metadata.

Travel estimates do not establish drivable routes, opening hours, access, terrain, ferries, queues or availability. Arrival/departure windows, hotels and travel bookings are not incorporated into this first activity planner. The result explicitly labels that limitation; it does not replace real navigation or a logistics schedule.

TripVibe uses the existing quiet/chill/lively/adventurous/balanced card IDs. The RPC returns only predefined IDs from revealed rounds, active members and non-removed participants, without names or private submissions. Duplicate IDs retain aggregate vote weight. No revealed preference means neutral weighting.

The saved source of truth is the quest input (dates, IDs, shared ceiling and revealed vibes). The structured result is deterministically recomputed on reload, not stored as a separate immutable itinerary version. Changes to planner defaults or bundled estimates can therefore change a future recomputation. Pinning historical planner/data versions is a later persistence enhancement.

## Rollout and validation

Apply migration `0039_deterministic_itinerary.sql` after the existing `0038_private_budget_ranges.sql`, then ship the matching app/contracts and affected Edge Function import maps. The migration preserves the existing RPC definitions and authorization, country validation, stage, idempotency and all-voted gates. Old callers without explicit IDs retain union compilation. The new group Build button requires the server's plannerVersion marker so older servers cannot silently discard the organiser subset.

No package was added. Focused Jest coverage includes date boundaries, geography, cross-day transfers, overflow, long visits, deterministic output, immutable inputs, sums, budget warnings, vibe constraints, all bundled metadata, organiser/member gates, save errors, solo flow and reloads. The pgTAP fixture `supabase/tests/0039_deterministic_itinerary.sql` exercises the migration's subset and authorization behavior.

This change does not deploy migrations or Edge Functions automatically.

## Online Explore recommendations

“Recommend more places” calls the OpenAI Responses API with required `web_search` and external web access, even when the bundled collection is exhausted. It sends destination/place context and revealed group vibes, not member names or private budgets. The default model is `gpt-4.1-mini`; override it with the server-only `OPENAI_EXPLORE_MODEL`.

Set `OPENAI_API_KEY` in Supabase Edge Function secrets (or `supabase/.env.local` for local serving), then deploy `recommend-explore` alongside the updated application. This function calls OpenAI directly; it does not use the shared Groq configuration. Never put the key in an `EXPO_PUBLIC_*` variable.

Each suggestion must cite a URL returned by the web search and match one unambiguous, same-country Photon/OpenStreetMap record. Existing IDs/names and duplicate results are removed. Missing or ambiguous map matches are omitted; online discovery does not guarantee opening hours, ticket prices, route feasibility, or exhaustive coverage.

Search reserves an existing `begin_place_import` operation before the paid API call, preserving membership, Explore-stage and 10-per-hour limits. Candidates stay private until Add invokes `confirm_trip_places`; the returned room updates the map and selection only after persistence succeeds. Existing confirmation limits, group voting and solo progression remain intact. No new migration is required; existing place-import migrations, including `0041_import_visit_selections.sql` for persisted visit selections, must already be applied.

Reference: [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search).

