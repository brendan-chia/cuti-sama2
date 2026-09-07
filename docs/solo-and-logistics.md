# Solo planning and travel suggestions

Migration `0030_solo_direct_choices.sql` adds `travelParty` to the quest snapshot. Solo travellers submit exactly one country and move directly to Explore. Country and accommodation ballots are rejected for solo trips; group voting is unchanged, including groups with only one current participant. Existing unfinished solo ballots return to destination choice without automatically choosing for the traveller.

Deploy `recommend-budget`, `recommend-logistics`, `suggest-trip-period` and `generate-itinerary` together with this migration: the latter two validate the quest response contract.

The recommendation endpoints authenticate the user and obtain trip facts through the membership-enforcing RPC. They use the configured Groq structured-output model and server-side `GROQ_API_KEY`. Structured JSON follows [Groq's documented strict-output format](https://console.groq.com/docs/structured-outputs); GPT-OSS requests use low reasoning effort to limit latency and token consumption. The UI displays rate-limit errors and supports retry.

Transport suggestions load as a list for each direction and departure city (initially Kuala Lumpur). Selecting a suggestion saves its estimated planning window and one-way MYR cost as selected transport, never as a booked service. Accommodation suggestions include estimated totals for all travellers and nights; adding one saves it for comparison, followed by confirmation. Manual booking editors remain optional. Suggestions are cached in memory for five minutes per authenticated owner and trip context to avoid repeated calls when switching tabs.

These are AI planning suggestions, not live inventory. Search links let users verify routes, properties, locations, availability and prices. No flight numbers, provider ratings or verified prices are invented by the UI. AI stay cards omit the schema's legacy rating/image fields. Hotel locations and prices remain model estimates and should be checked before booking. One-day trips return no overnight stays.

Validation: `npm test`, `npm run typecheck`, `npm run lint`; database regression `supabase/tests/0019_solo_direct_choices.sql` covers direct selection, idempotency, rejected solo ballots and preserved group voting.
