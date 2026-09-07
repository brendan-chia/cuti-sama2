# Traveller profiles, solo travel and discovery

The home screen links to **My profile & trips**, **Plan a solo adventure**, and **Discover public trips**.

Profiles support a display name, a cropped photo (up to approximately 1 MB, stored privately with the profile), 30 favourite places, a copyable referral code and one-time referral redemption. Email/password linking upgrades the existing guest identity; confirm the email before using it on another device. Signing into an existing account does not merge guest data.

Trip history comes from the traveller's accessible trips. **Record as completed** saves a personal memory only after the trip end date (including quest dates). The first recorded trip unlocks the first-adventure badge. Completion is self-reported, not verified attendance. Completing itinerary planning does not award the badge.

Solo trips persist `travel_party = solo`, mark the creator ready and start planning atomically. Creation retries reuse an idempotency key. The traveller enters the existing quest alone and cannot accept other members.

An organiser can publish a group trip from **My profile & trips → Manage public listing**. Discovery exposes only the trip name, description, dates and member count. Private trip rows, profiles, budgets and quest inputs retain member-only access. Joining locks the trip row, checks publication, dates, planning state and the eight-person capacity, and creates one membership per user. Joining closes when planning starts. Organisers can hide listings; removed members cannot rejoin through discovery.

The budget stage calls `recommend-budget`, which authenticates the caller and loads trip facts through the membership-checked quest RPC. The existing server-side Groq configuration provides a whole-trip estimate per person in MYR, including accommodation, food, local transport, activities, return travel and contingency. Users supply departure city and travel style. Validated estimates are advisory, not live fares. Applying one only fills the budget form; the existing submit action persists the personal limit.

## Deployment

Apply `supabase/migrations/0028_traveller_community.sql` after migrations 0026 and 0027, then deploy the `recommend-budget` Edge Function. It uses the existing `GROQ_API_KEY` and optional `GROQ_STRUCTURED_OUTPUT_MODEL`; no provider key belongs in the app. Email/password authentication and guest-account email linking must be enabled in Supabase Auth. Existing guest authentication remains required for planning.

Run `npm run typecheck`, `npm run lint`, `npm test`, and `supabase test db`. The community database regression file is `supabase/tests/0017_traveller_community.sql`.
