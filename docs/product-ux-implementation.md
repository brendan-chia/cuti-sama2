# UX redesign implementation

Implemented locally on 10 September 2026 against the audit and redesign specification. This is a substantial implementation of phases 1–3, not a claim that every release criterion in the specification has been met.

## Implemented

- Four retained root tabs: Home, Trips, Saved, Account. Existing public URLs remain valid. Trip work uses Overview, Plan, Places and Bookings instead of a second bottom navigation bar.
- Home prioritises creating, joining and returning to a trip. Destination inspiration opens a real detail screen and can seed creation. Trips use a searchable vertical list with secondary management actions.
- A short shared solo/group creation form permits undecided dates and destinations. Recovery retains the created trip instead of encouraging duplicate creation.
- Saved opens with the collection. Link entry and optional metadata are progressively disclosed; original sources remain available after extraction failure. Extracted places can be reviewed individually before adding to a trip.
- Account opens with concise navigation to profile editing and account protection. Switching to another existing identity requires an explicit choice.
- Larger essential itinerary text, labelled controls, focused input borders, readable loading labels, and removal of misleading decorative controls and unsupported confidence displays.
- A new shared workspace allows independent dates, destination and budget responses, explicit abstention, organiser confirmation and versioned reopening. Missing responses never count as agreement. Budget responses are filtered on the server, although the confirmed minimum can reveal information in small groups.
- Places can be saved without decisions, assigned a day and time, edited or removed. An organiser can distribute unscheduled places into a provisional outline. Maps open through a labelled external handoff. Transport and stay records distinguish selected options from manually recorded bookings and label total MYR costs.
- Revision checks and idempotent mutations protect shared edits. Failed edits remain in the form. When the trip changes, the user can retain/copy their draft before explicitly discarding it and reviewing the latest version. Cached workspace content is read-only when refresh fails; confirmed access loss clears it.
- Existing quest outcomes seed known shared decisions without inventing individual consent. Prior generated itineraries and guided planning routes remain accessible. Late joiners can participate in workspace decisions without altering historical quest ballots.

## Backend handoff

`supabase/migrations/0037_trip_workspace.sql` was **deployed successfully** to the linked CutiSama2 Supabase project (`cvgwxbirijgggkkfbojo`) on 10 September 2026, following explicit user authorization. Remote migration history confirms version `0037`. All five workspace tables have RLS enabled and deny direct authenticated access; both workspace RPCs allow authenticated execution and deny anonymous execution. A post-deployment dry run of the scoped migration set reports no pending changes.

The remote history lacks older local migrations `0025_social_post_media.sql` and `0031_modern_attractions.sql`. Deployment used an isolated copy of the migration set excluding those two files, verified by dry run to apply only `0037`. Their files and migration history were not altered; reconcile that pre-existing mismatch separately before a future full `db push`.

For future deployments, apply migrations through the project's normal Supabase deployment process, first against a staging copy with all existing migrations. Exercise existing invitations, solo/group creation, active and completed quest trips, membership removal/rejoin, and the retained generated itinerary flows before enabling the new workspace in production. The migration changes the existing quest membership/invitation guard functions for trips that have opened a workspace. A code rollback can restore the previous client while retaining additive workspace data; review guard behaviour separately before reverting database functions.

## Validation completed

- `npm run lint`: passed without warnings.
- `npm run typecheck`: passed.
- Jest: 55 suites, 301 tests passed, including workspace contribution, save recovery, missing-response confirmation, member permissions and stale-draft protection.
- `npx expo export --platform web --output-dir .tmp/ux-web`: passed, 31 exported routes.
- `scripts/workspace-db-test.sql`: passed on isolated PostgreSQL 18 with a minimal fixture. Checks cover permissions, budget filtering, explicit responses, confirmation, history, late joining, idempotency, stale revisions, provisional scheduling, unsafe links and removed-member access. This fixture is **not** a substitute for testing the complete Supabase migration history and live integrations. Run it only in an empty disposable database.

## Outstanding specification and release work

- Browser tools report no connected browser, despite localhost being open. No rendered-screen inspection, mobile viewport screenshots, keyboard review or browser interaction test was possible. Native VoiceOver/TalkBack, large text and device safe-area testing remain unverified.
- Date responses currently use exact ranges; flexible-date comparison and automatic overlap selection are not implemented. Destinations use text responses and require matching proposals; catalogue-based suggestions and richer comparisons remain future work.
- The workspace outline distributes places in saved order. It does not optimise geographic routes or validate opening hours. Existing generated itineraries remain in their retained route rather than becoming editable workspace activities automatically.
- Map display is an external map handoff, not an integrated map/list switch. Provider search, booking integrations, reliable reminders, durable offline writes and the richer assistance described in phase 4 remain unimplemented.
- Navigating away from an unsaved editor can discard local form state; durable cross-navigation draft recovery remains outstanding.
- Formative usability sessions, production analytics, measured accessibility compliance and full staging migration integration remain necessary before describing this as production-ready.
