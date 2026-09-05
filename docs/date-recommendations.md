# Shared date recommendations

Each traveller saves a preferred period, start flexibility (exact, ±3 days, ±7 days, or any start in the same month), usual days off, and up to 20 private unavailable ranges. Existing proposals default to ±7 days and Saturday/Sunday off; travellers can edit these before requesting a recommendation.

`buildCombinedCandidates` intersects permitted start windows, uses only submitted trip lengths (1–30 days), and rejects any trip overlapping a hard exclusion. An exact preference preserves both endpoints. The ordering is duration deviation, maximum individual leave, total leave, then maximum start shift. Any length changes appear per traveller before confirmation.

The organiser calls `suggest-trip-period`. The edge function authenticates membership, loads private inputs on the server, calculates feasible candidates and sends only anonymous candidate metrics plus verified nationwide holidays to Groq. The LLM returns candidate IDs. Validation rejects invented IDs and a main recommendation that worsens primary fairness criteria. Display explanations are built from verified metrics, preventing invented holiday or leave claims. Provider timeout, invalid output or missing configuration uses a labelled calendar fallback.

The recommendation is persisted on `trip_quests` and shared through the existing realtime/polling flow. Generation uses compare-and-set against quest revision and calendar version. Input edits, participant removal and calendar updates invalidate it. Confirmation accepts only a currently saved recommendation, copies canonical dates/text, and opens the wishlist stage. Blackout ranges are never included in another member's room response or the LLM request.

## Calendar maintenance

`data/malaysia-national-holidays.json` records the official 2026 and 2027 schedules and source links. Only rows applying across all states/federal territories are included. Chinese New Year day two, Deepavali, state holidays and conditional substitute days are excluded because applicability differs by state. Custom usual days off do not establish a state's statutory substitute rules. No substitute holiday is inferred from a weekend. Published dates can change; leave figures are estimates.

Review the BKPP annual schedules and announcements monthly, when a new year is published, and after special holiday announcements. Verify any change against the official source, update the JSON's dates, coverage, checkedAt, notice and version, then run:

```
node scripts/holiday-calendar-sql.mjs data/malaysia-national-holidays.json
```

The command prints an UPDATE statement for a new reviewed Supabase migration. It does not write to the database. Always use a new version when facts change; deploying it invalidates old recommendations automatically. Add a covered year only after its entire nationwide schedule has been verified. Missing years are explicitly disclosed in the recommendation and use usual days off only. This is a curated calendar, not an automatic web scraper.

## Deployment and checks

Apply migrations `0020_combined_date_recommendations.sql` and `0021_scope_date_recommendation_fields.sql`, deploy `suggest-trip-period`, and use the updated app. The edge function needs existing `GROQ_API_KEY`, `GROQ_STRUCTURED_OUTPUT_MODEL`, and standard Supabase environment variables. No client API keys are added.

Tests: `__tests__/combined-dates.test.ts`, `__tests__/quest-screen.test.tsx`, `supabase/functions/suggest-trip-period/combined-groq_test.ts`, and transactional `supabase/tests/0013_combined_dates.sql`. The latter rolls back all fixtures.
