# CutiSama2: product and UX audit

Research date: 10 September 2026. Deliverable: audit and redesign specification only. No application code, database rules, or existing working changes were modified.

Companion: [Detailed redesign specification](./product-ux-redesign.md).

## Product judgement

CutiSama2 has useful planning capabilities, but its central experience is organised around completing a multiplayer ceremony. A traveller wants to answer “Where are we going, what can I afford, and what do I need to do?” The interface repeatedly asks them to understand rooms, lobbies, readiness, chapters, decks, reveals, and unlocks.

That is the wrong organising principle for a dependable travel planner. The proposed replacement is a shared trip workspace with independently accessible decisions, saved places, bookings, and itinerary. Guided assistance should help people make progress without controlling when they may access their own plan.

The product opportunity is focused: help Malaysian travellers turn scattered ideas and different constraints into a workable shared holiday. Competing on booking inventory, social feeds, and price prediction simultaneously would spread the experience too thin. A trustworthy, understandable planning workflow is the priority.

## Evidence and limits

This is a source-based expert review plus current web research, not an observed usability study. Reviewed routes and components cover home, creation, invitations, lobby, planning stages, saved inspiration, trips, profile/recovery, and itinerary. Relevant contracts and the local attraction-voting migration were also inspected. The workspace already contained uncommitted changes; findings describe that local state, not a verified production deployment.

Browser setup returned “No browser is available”; discovery returned no browsers. Consequently, actual screen composition, keyboard behaviour, screen-reader output, device performance, and touch behaviour remain unverified. Layout risks below are inferred from concrete component structure and styles. No claim of a full accessibility pass or measured conversion improvement is made.

Severity: **P0** means a release-blocking defect in a supported core experience; **P1** means a major obstacle or trust problem; **P2** means meaningful friction or inconsistency. Priorities are expert judgements, not measured incidence.

## Critical findings

| Priority | Finding and local evidence | Why it is weak | Replacement |
| --- | --- | --- | --- |
| P0 | Important itinerary details use 8–12 unit type; activity glyphs use brown on green or brown-orange. `src/features/itinerary/itinerary-screen.tsx`, `src/theme/tokens.ts`. | Times, costs, and places are the working content of a travel app. Making them miniature sacrifices utility for composition. Some foreground/background pairs have extremely low contrast. | Readable itinerary rows, semantic colour pairs, dynamic text layouts; verify on devices before release. |
| P1 | A global `BottomNavigation` sits outside the root stack, while an itinerary with a version supplies `TripBottomNav` as its footer. `src/app/_layout.tsx`, `src/features/itinerary/itinerary-screen.tsx`. | Two competing bottom navigation systems imply two definitions of Home, trip context, and the main action. They also consume valuable height. | One global navigation bar; trip sections under the trip header. Remove the itinerary's second bottom bar. |
| P1 | Create is a top-level tab; Saved has no selected tab; Social is a gateway page. `src/components/bottom-navigation.tsx`, `src/app/social.tsx`. | A creation action receives permanent destination status while a reusable collection is buried. The Social label promises more than a pair of navigation choices. | Home, Trips, Saved, Account. Put Create and Join in task context; retain public trip discovery through a clearly labelled secondary entry. |
| P1 | Lobby start waits for every active member to be ready; planning initialisation revokes invitations. `src/features/lobby/lobby-screen.tsx`, `supabase/migrations/0036_attraction_votes.sql`. | Real groups contribute at different times. Readiness is overhead before any travel decision, and closing invitations penalises late participants. | Open the workspace immediately. Support scoped invitations and late joining with explicit decision-version rules. Requires server changes. |
| P1 | Dates, destination picks/votes, attractions, and budgets repeatedly wait for all members. `timing-stage.tsx`, `country-vote.tsx`, `quest-screen.tsx`, `budget-stage.tsx`. | One absent person can stall the trip several times. Removing that person should not be the practical route around a product constraint. | Allow independent contributions and provisional planning. Separate missing responses, explicit abstention, agreement, and final confirmation. |
| P1 | Group creation forces `mode: 'undecided'`; the planning sequence puts dates first. Solo dates must start tomorrow or later. `create-trip-screen.tsx`, `timing-stage.tsx`. | A booked trip, a destination-led idea, an undated plan, and a trip already underway do not fit the same sequence. | Support known destination, deciding together, flexible dates, and current-trip entry. Respect existing constraints until contracts are extended. |
| P1 | Home destination cards are noninteractive `View`s. Copy says “Popular” although the catalogue comment describes curated inspiration. `src/features/home/destination-row.tsx`, `src/app/index.tsx`. | Attractive destinations lead nowhere; “popular” implies unsupported ranking evidence. | Label them “Ideas in Malaysia”; open a destination detail with Save and Plan actions, or remove the cards until supported. |
| P1 | An itinerary plus sign opens review; header people/more symbols are decorative; the active itinerary callback is a no-op. `src/features/itinerary/itinerary-chrome.tsx`. | Familiar controls imply actions they do not deliver. This is misleading affordance, not merely icon styling. | Use labelled “Edit plan” and “Add activity”; render actual member/menu controls only with working actions. |
| P1 | Saved starts with URL, folder, transcript, analysis explanation, then search/filter/results. `src/app/inspiration.tsx`. | Repeat users must pass the intake form to reach their collection. Capturing a link feels like filling out an import form. | Collection first; Add link opens a short capture flow. Default folder; disclose optional text only when needed. |
| P1 | The itinerary exposes a numerical “Draft confidence …%”. `src/features/itinerary/itinerary-screen.tsx`. | A percentage has ambiguous meaning to travellers and may imply calibrated reliability. Displaying it does not establish calibration. | Show specific evidence states on the affected item: estimated price, opening hours unverified, transport missing. Audit the scoring methodology separately. |
| P1 | Recovery explains “room identity” and anonymous membership; profile has linking and account switching with no trip merge. `identity-recovery-screen.tsx`, `src/app/profile.tsx`. | Technical explanations arrive when users fear losing their trip. Switching identities is materially different from protecting their current work. | Offer “Keep your trips across devices” after first value; distinguish linking from switching. Show exactly what remains accessible before switching. |
| P2 | Trips are paged one at a time with large Open, Complete, and Manage listing buttons. `src/features/profile/trip-carousel.tsx`. | Trips are a retrieval task. Serial browsing hides alternatives and gives secondary administration the same weight as opening a plan. | Vertical list with destination/date/status summaries; overflow for completion and listing management. |
| P2 | Creation explains six chapters and displays a flight path above the task. Planning repeats branding, a flight path, stage prose, and member avatars. `create-trip-screen.tsx`, `quest-screen.tsx`, `flight-path.tsx`. | Instruction and decoration compete with the field or decision the user came to complete. The flight metaphor also fits train, road, and local trips poorly. | Compact task heading and explicit progress/status. Contextual help only when needed. |
| P2 | Budget follows attraction choices and waits for every submission. The minimum becomes the group ceiling. `budget-stage.tsx`. | Affordability enters too late to guide destination choice. The minimum rule is understandable, but cannot resolve incompatible expectations by itself. | Collect optional budget early; explain aggregate rule, surface infeasible options, allow revision without exposing whose limit was lowest. |
| P2 | Shared components combine 10-unit labels, 12-unit supporting text, fixed line heights, opacity-disabled controls, and separate safe-area wrappers. `tokens.ts`, `screen.tsx`, `app-button.tsx`, `form-field.tsx`. | Dense small copy and inconsistent state treatment undermine a scalable mobile system. Nested insets may waste height depending on the route. | Readability floor, semantic state tokens, focus/error treatment, one clear owner for each safe-area inset. Device verification required. |

### Measured colour evidence

Calculated from the opaque sRGB hex values using relative luminance, without screenshots or disabled opacity:

| Pair | Contrast | Assessment |
| --- | --- | --- |
| `#5B402E` on `#4F7027` | 1.66:1 | Fails normal and large text; unsuitable for meaningful itinerary glyphs. |
| `#5B402E` on `#A64B08` | 1.64:1 | Same problem; also used by the vote stamp colour pairing. |
| `#969482` placeholder on white | 3.06:1 | Below the 4.5:1 normal-text threshold; use stronger placeholder text without replacing visible labels. |
| `#78614F` on `#FFFBF3` | 5.62:1 | Passes normal-text contrast; small size still needs correction. |
| White on `#4F7027` | 5.71:1 | A viable primary-button pairing. |

Normal text needs 4.5:1; large text has a 3:1 threshold. Contrast alone does not validate text size, target size, or readability. See [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Meaningful non-text indicators also need suitable contrast against adjacent colours; see [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## What to preserve

The existing implementation contains valuable safeguards. Vote cards include visible buttons, allow revision, honour reduced motion, and wait for server acknowledgement. The map offers a selectable list and an unavailable-map fallback. Budget copy identifies per-person, whole-trip scope and explains the minimum rule. Logistics can remain a draft. Itinerary generation handles slow or failed operations, and recovery code already considers stale data and connection failure.

These mechanisms deserve a clearer interface. A rewrite that replaces them with optimistic animation and happy-path mock data would be a regression. Keep the otter identity and a restrained green accent, but concentrate illustration in empty states and invitations rather than every working screen. Keep native system typography for legibility and platform behaviour; a novelty font swap is not a UX priority.

## Research and competitive lessons

The following are verified public product descriptions or guidance, followed by design inferences for CutiSama2. They are not hands-on audits of the latest competitor apps. Research was checked on the date above; older guidance is identified rather than presented as a new trend.

| Source | Verified observation | Application to CutiSama2 |
| --- | --- | --- |
| [Apple tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | Apple warns that inconsistent availability makes navigation unpredictable. | Keep stable global destinations and selected states; use separate focused editors when necessary. |
| [Apple onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding?changes=_1_1) | Guidance favours fast, optional onboarding and instruction near the relevant interaction. | Remove the chapter tutorial before trip creation. Explain a decision when it becomes relevant. |
| [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views?hl=en) | Android recommends touch targets of at least 48 × 48 dp. | Adopt 48 × 48 logical-unit targets across the shared design system; audit effective bounds. |
| [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | WCAG 2.2 AA specifies a 24 × 24 CSS-pixel minimum with exceptions. | Treat that as a web compliance floor, not the preferred mobile control size; units and standards are not interchangeable. |
| [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Longstanding guidance defers secondary options to reduce initial complexity. | Put folder naming, unavailable ranges, and manual booking detail behind clear expansion points. Keep prices and blockers visible. |
| [Airbnb shared wishlists](https://www.airbnb.com/help/article/1236) | Collaborators can add notes, vote, and update proposed dates and guest count. | Attach collaboration to concrete options and decisions. No need to reproduce an entire social network. |
| [Wanderlog help](https://help.wanderlog.com/hc/en-us) | The help structure includes a daily itinerary, map, and sharing. | Keep the plan, map, and people connected in one trip context. |
| [Google Maps lists](https://support.google.com/maps/answer/7280933?hl=en-AU) | Places can be collected in lists, shown on a map, and shared. | Preserve a recognisable place identity from save through itinerary placement. |
| [Hopper trip watching](https://help.hopper.com/en_us/how-to-watch-a-trip-for-price-notifications-HJGMLt_tD) | Hopper supports watching a trip for price notifications. | Make a supported recommendation actionable. Do not imitate prediction or urgency without the required data. |
| [Klook booking guide](https://www.klook.com/en-GB/blog/how-to-book-with-klook/) | Its guide describes inspiration and access to saved wishlists. | Separate browsing, saving, and booking intent; do not imply that adding an attraction purchases it. |
| [Trip.com Trip.Planner announcement](https://www.trip.com/newsroom/trip-com-launches-trip-planner-smart-itineraries-tailored-to-your-travel-style-with-real-time-recommendations/) | The announced planner emphasises preferences and itinerary recommendations. | Expose inputs and editable results; AI should support a plan rather than become the navigation model. |
| [Grab accessibility work](https://www.grab.com/inside-grab/stories/grabs-ai-voice-assistant-lets-visually-impaired-users-book-rides-with-ease/) | Grab describes involving visually impaired users in focus groups and product testing. | Include assistive-technology users in validation; semantic props alone are insufficient evidence. |

## Strategic decisions

1. **Make Trips the working centre.** Home offers a useful first action and resumption; the trip workspace holds decisions, itinerary, places, and bookings.
2. **Remove synchronous ceremony.** No readiness gate before a traveller can save ideas or start a draft. Finalising shared decisions remains explicit and permission-controlled.
3. **Put constraints before persuasion.** Budget, dates, origin, and important requirements should inform comparison, rather than arriving after an attractive destination wins.
4. **Keep Saved independent of a trip.** A person may collect ideas months before dates or companions exist.
5. **Use truthful, specific state.** “3 of 5 responded” is more useful than “Crew ready”; “Draft—transport not added” is more useful than “Quest complete”.
6. **De-emphasise public discovery and referrals.** Preserve access, but prioritise private planning until the core tasks work well. Public discovery needs a separate trust and moderation review before expansion; that review was not performed here.

## Delivery and validation priorities

First address contrast, tiny operational text, competing navigation, misleading icons, and incorrect selected states. Then simplify home, creation, Trips, and Saved while preserving the existing APIs. Deliver the asynchronous workspace after versioned decision and invitation contracts are ready. Finally improve comparison data, contextual reminders, and booking handoffs when their service foundations exist.

Validate with a first-time organiser, an invited member, a solo traveller, a returning planner, and someone using assistive technology. Tasks: create an undated trip; join from a link; respond while others are absent; compare destinations against a budget; save an ambiguous travel post; revise a vote; reopen a trip; inspect today's schedule offline; recover from a failed save. Measure completion, wrong turns, time to useful progress, and comprehension of draft versus confirmed state. Establish a baseline before claiming gains.

Do not call the redesign production-ready until narrow screens, large text, VoiceOver/TalkBack, keyboard avoidance, safe areas, slow networks, deep links, and concurrent edits are verified. The companion specification makes those acceptance conditions concrete.
