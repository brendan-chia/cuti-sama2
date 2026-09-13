# Trip Mode and Rescue My Day

My trips exposes **Change plan** on current, started trip cards. It checks that the itinerary is generated, then opens `/trip/[tripId]/mode?changePlan=true` with rescue options expanded. The itinerary no longer contains the old View trip entry. Back to my trips returns to the trip list.

Trip Mode shows a selectable day, suggested start/end times, Completed / Next / Upcoming status, and **Plans changed**. Today uses the device calendar date; other days are clearly labelled previews. Only the organiser (including a solo trip owner) records crew completion or applies a rescue. Members can inspect proposals. Refreshing or returning to the screen retrieves shared state.

## Rescue behavior

- Bad weather replaces unfinished outdoor or mixed stops with explicitly indoor catalog alternatives.
- Attraction unavailable asks which unfinished stop to replace.
- Running late offers 15, 30, 60 or 90 minute shifts to unfinished stops. It refuses midnight overflow or overlap rather than dropping stops.

Replacement candidates must be unscheduled, in the same country, within a 25 km local area, have usable coordinates/duration/cost metadata, and not require special planning. Duration and transfer estimates must fit the affected slot and leave enough time for the following stop. Shared revealed vibes influence ranking; absent preferences are not invented. Other days and completed stops are preserved. If any affected stop has no suitable replacement, the current plan stays intact.

The preview lists removals/additions, revised times, reasons and per-person activity allowance changes. Travel times are straight-line estimates, not live routing. Costs are provisional MYR category allowances, not fetched ticket prices. Full budget fit is reported only when all activity costs and confirmed accommodation/transport allowances are available. Opening hours and timed ticket availability are not verified. No automatic weather feed is required: the user reports the disruption.

**Use New Plan** saves only after an explicit tap. Cancellation and failed saves preserve the existing timeline. The original generated outline remains unchanged; the adjusted execution schedule lives in Trip Mode.

## Storage and rollout

Apply `supabase/migrations/0042_trip_mode.sql` to enable the two RPCs and private `trip_mode_states` table. The frontend requires this migration; it reports a load error if unavailable. No dependencies or edge functions are added.

RPCs require active quest membership; writes additionally require organiser role and a completed quest. Quest revision guards reject regenerated inputs; a newly generated quest starts a fresh execution state. State revision guards reject concurrent writes, and retries of an identical successful write return the saved state. Direct table access is revoked. No individual private preferences or private budget amounts are copied into execution state.

## Validation

- `__tests__/trip-rescue.test.ts`: selection, timing, budget, missing metadata, immutability and invalid state.
- `__tests__/trip-mode-screen.test.tsx`: entry navigation, preview, cancel/apply, completion, roles and conflict recovery.
- Existing quest generation and synthetic itinerary tests.
- `supabase/tests/0042_trip_mode.sql`: transactional save/reload, retries, conflicts, completed-stop protection and membership checks. Test fixtures roll back.
- Expo web export verifies the route builds. Native-device appearance has not been manually verified.
