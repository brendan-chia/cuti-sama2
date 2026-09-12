# Screen patterns

Repository snapshot: 2026-09-12, source-inspected. Paths are repository-relative. Read the current target before adapting a pattern. Use [design-system.md](design-system.md) for measured colour pairs and existing-versus-proposed tokens.

## Existing patterns

| Pattern | Source and observed structure | Preserve when adapting |
| --- | --- | --- |
| Chapter header | `src/features/quest/quest-screen.tsx`: lobby back link + compact `BrandLogo`, trip name, `FlightPath`, chapter kicker, main question and support; compact voting header | Actual stage, solo-specific wording and less chrome in voting; header roles; do not create a second competing main question |
| Quest progress | `src/components/flight-path.tsx`: Dates → Wishlist → Vote → Explore → Budget → Logistics, dashed route, moving plane, green current outline and completed checks, textual progress label | Solo omits Vote. Completion depends on quest/logistics draft state; this is not arbitrary clickable navigation |
| Selectable country grid | `src/features/quest/country-picks.tsx`: country search, 1 solo/3 group slots, wrapping two-column photo cards, flag fallback, selected check, remaining-count message, empty search, submit/edit | Selection limits and busy guards; own submitted countries stay private until all submit. Fix selected text contrast in the touched component |
| Private submission | `CountryPicks`: green confirmation panel with own choices + Edit my picks. `src/features/cards/shared-table.tsx`: face-down card stack, readiness count, own-submitted copy | Public readiness does not imply public choices. Preserve existing replacement/edit semantics, reveal gates and contract fields |
| Waiting for participants | `quest-screen.tsx`: ready count and horizontal crew initials/checks. `src/features/trip-room/trip-room-screen.tsx`: READY/THINKING/LEFT states, waiting-for-organiser panel and copy | Role and participant membership, readable text indicator in addition to avatar colour, live readiness updates, stale/reconnecting banner |
| Preference hand | `src/features/cards/card-hand.tsx`, `preference-card.tsx`, `shared-table.tsx`: horizontal illustrated single-choice cards, swipe-to-play plus tap, table drop feedback | Existing radio semantics, custom Must-Have sheet, busy guards and reduced-motion input; this is a separate flow from Wishlist |
| Reveal/results | `src/features/cards/round-reveal.tsx`: Cards on the table, count summary, named revealed submissions. `src/features/group-reveal/group-reveal-screen.tsx`: agreements, minority Must-haves, dealbreakers, unresolved facts and expandable input sources | Minority choices and empty sections, source attribution/privacy, blocked versus matched state, retry and matched-only next action; never invent agreement |
| Destination reveal | `src/features/quest/destination-announcement.tsx`: centred scrollable safe-area fade modal, destination heading and Explore CTA | Triggered on group voting → explore transition; dismiss/back behaviour; no new vote or automatic navigation side effects |
| Organiser actions | `TripRoomScreen` footer start/close/reveal/advance gates; `quest-screen.tsx` Explore organiser compile button with all-voted and dirty guards | Explain member waiting state. Never expose organiser-only actions to members or loosen server/business readiness for visual convenience |
| Bottom CTA | `src/components/screen.tsx` footer sits outside scroll. Used by preference table, lobby, group reveal, itinerary; quest also has inline stage CTAs | One clear next action, supporting secondary action only when needed; keyboard, scrolling and global bottom navigation must coexist |
| Map + information list | `src/features/quest/attraction-map.tsx`: count/legend, tile map, selectable pins, zoom/reset/attribution, retry, attraction rows + Locate. `crew-choices.tsx`: ranked votes, counts, expandable voter names and show-all | List remains usable without map tiles. Keep map/list selection in sync, disabled states, geographic legibility and action permissions |
| Success/completion | `questStyles.success`: tinted green panel with green left rule. `QuestSummary` in quest screen: beige ticket, dates/stops/budget, dashed dividers and itinerary CTA. Preference room has a gold-bordered completion panel | Confirm saved state before celebrating; logistics can still be draft even at `complete`; retain next action and solo/group language |
| Itinerary generation/recovery | `src/features/itinerary/itinerary-screen.tsx`: destination-required state, labelled generation notice, slow request copy, Check progress, retry-same-request action, then photo hero/stats/day timeline | Existing request identity, pending/slow/error distinctions and organiser gates; visual polish must not cause duplicate generation |
| Home discovery | `src/app/index.tsx`, `src/features/home/destination-row.tsx`: logo/action area, inspiration panel and horizontal destination photos with labelled 44-size navigation controls | Photo fallback and disabled carousel boundaries; keep travel imagery subordinate to the otter-led colours and typography |

## Proposed Wishlist trip-vibe pattern

The requested eight-ID private trip-vibe selector was **not found** in this checkout's Wishlist. `CountryPicks` currently submits country codes. The separate preference `vibe` round in `src/features/cards/card-definitions.ts` has `quiet`, `chill`, `lively`, `adventurous`, `balanced`; it is not the requested eight-ID model. Do not rename those IDs, merge the flows, invent persistence, or claim a new component already exists. When implementing this feature in a future authorised task, inspect current contracts and privacy/submission behaviour first.

Required IDs for the proposed Wishlist UI are below; names, emoji and descriptors are proposed display copy, not existing records:

| ID | Display | Descriptor |
| --- | --- | --- |
| `foodie` | 🍜 Foodie | Follow the local flavours |
| `chill` | ☁️ Chill | Slow mornings, easy days |
| `nature` | 🌿 Nature | Find trails and fresh air |
| `adventure` | 🧭 Adventure | Try something bold |
| `shopping` | 🛍️ Shopping | Browse markets and local finds |
| `culture` | 🏛️ Culture | Meet the stories of a place |
| `nightlife` | 🌙 Nightlife | Explore after sunset |
| `sightseeing` | 📍 Sightseeing | See the places you came for |

Use expressive, fully tappable cards: icon/emoji, name, short descriptor, persistent visible check when selected, green outline and pale leaf fill with cocoa text. Avoid checkbox-looking forms and generic filter chips. Checkbox accessibility semantics remain appropriate **if** the actual contract permits multiple selection; use radio semantics for single choice. The visual direction does not define selection limits.

Prefer a responsive two-column phone grid with 8–12 gap, 16-radius cards and comfortable padding based on `CountryPicks`; let height grow with text, and collapse to one column when width or dynamic text requires it. Do not copy its percentage widths without checking available width and gaps. Keep the name and description visible. Screen-reader name/state must convey selection without reading the decorative emoji twice.

Place privacy copy near the task and a clear saved/waiting state after successful submission. Keep choices private according to the real feature's contract; do not expose individual answers in crew readiness or carry over the preference round's reveal rules without checking. Treat this as choosing the personality of the trip.

## Other proposed patterns, not shipped components

- **Mascot companion state:** short helpful message, modest art, one useful next action for onboarding, empty/waiting/error recovery or completion. Reuse existing full `BrandLogo` only when appropriate; isolated poses need explicitly identified assets. Plan Rescue was not found and is not an available screen.
- **Milestone stamp:** gold fill with readable cocoa label plus completion check/date when backed by real state; one short reduced-motion-aware reveal. Existing ticket/check language is the foundation; no stamp component exists.
- **Special hero gradient:** limited to chapter intro, major CTA or completion, with verified text contrast across its full area. No gradient helper/dependency currently exists; a flat leaf panel is already supported.

## Review a whole screen

Check initial loading, loaded empty, normal, selected/unselected, press, busy, disabled, saved/waiting, error/retry, success and offline states as applicable. Verify small-phone width, large system text, safe areas, keyboard, back/modal dismissal and navigation together. Retain data/role gates and avoid unrelated changes.

Relevant existing tests include `__tests__/quest-screen.test.tsx`, `quest-map.test.tsx`, `preference-card-accessibility.test.tsx`, `trip-room-screen.test.tsx`, `group-reveal-screen.test.tsx`, `date-field.test.tsx`, `stale-state-banner.test.tsx`, `itinerary-screen.test.tsx`, and `trip-carousel.test.tsx`. Run only relevant tests alongside project lint/typecheck after UI implementation. A passing test suite does not replace visual/device accessibility review.
