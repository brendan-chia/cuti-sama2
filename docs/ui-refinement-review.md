# CutiSama UI refinement — September 2026

## Research and direction

The requested browser tool and Windows computer-use runtime failed to initialize. With the user's approval, research began through web search and by opening the original pages. An isolated installed Edge browser later provided screenshot-based inspection through its local debugging protocol. No reference assets, copy, fonts or branding were imported into the application.

| Reference opened | Evidence and principle used |
| --- | --- |
| [Wanderlog](https://wanderlog.com/) | Rendered desktop page and product preview: readable itinerary rows beside a map, one dominant action, secondary details quieter than place names. Keep CutiSama's map/list relationship and shared decisions. |
| [Linear UI refresh](https://linear.app/now/behind-the-latest-design-refresh) | Read the design team's explanation and inspected the page: predictable action locations and fewer, softer separators. Apply through shared components rather than independent screen themes. |
| [Todoist](https://www.todoist.com/) and [teamwork](https://www.todoist.com/teamwork) | Opened both; desktop screenshot shows clear primary/secondary hierarchy and compact task grouping. Preserve the distinction between personal inputs and shared readiness. |
| [Airbnb](https://www.airbnb.com/) | Mobile capture: stable labelled bottom navigation, horizontally scrollable categories, clear selected underline. Keep labels readable rather than compressing every item into one row. |
| [Headspace](https://www.headspace.com/app) | Mobile capture and product page: friendly illustration and direct language. Borrow the approachable tone; its broad saturated surfaces are outside CutiSama's cream-led direction. Cookie panel limited the captured viewport. |
| [Notion](https://www.notion.com/product) | Desktop capture: restrained illustrated personalities, limited accent colour, strong type hierarchy. Keep the otter as the existing brand anchor. |
| [Roadtrippers](https://roadtrippers.com/) | Desktop capture: distinct planning choices combine a visible radio indicator and descriptive copy. Align existing choice cards with both visual and accessible state. |
| [Mobbin](https://mobbin.com/explore/mobile) | Opened the public mobile gallery and inspected its category/flow navigation. Public browsing only; no claim of inspecting gated app flows. |
| [TripIt sample itinerary](https://help.tripit.com/en/support/solutions/articles/103000063427/) | Read the official sample itinerary page. Use chronological grouping and practical information hierarchy; no live TripIt account flow was tested. |
| [AllTrails](https://www.alltrails.com/) | Opened the page and read its search/discovery structure. The browser capture was blank, so it provided no usable visual evidence. |
| [SaaSFrame](https://www.saasframe.io/) | Opened the public reference library to compare its organisation by UI pattern. Supplementary source, not a production-app interaction test. |

Awwwards and Land-book could not be opened through the web tool and were not used as evidence.

## Applied system

- Keep the existing logo, cream/cocoa/leaf palette, platform font, route structure and business logic.
- Use dark green for primary actions and completion, pale green for selected surfaces, and lime/orange selectively. Pair disabled surfaces with readable muted labels instead of fading the entire control.
- Retain 54-point primary controls; provide a visible focus border and retain text during loading.
- Use 16-point phone gutters and 24-point larger-screen gutters. Keep the existing 720-point content limit and global navigation.
- Raise shared small text to 13 and labels to 12; reduce large panel corners from 24 to 20. Keep body text at 15 with comfortable leading.
- Keep Dates → Budget → Wishlist → Vote → Explore → Logistics. Solo still omits Vote. Narrow layouts scroll the same flight route and bring the current stop into view, instead of shrinking station labels. Completion remains based on the supplied real stage.
- Align the create-trip explanation with the actual quest order. Exact budget values remain private.
- Reflow country choices on narrow screens/enlarged type; allow preference-card copy to determine its height. Preserve selection limits and submission guards.
- Bring the older planning-mode, destination confidence and voting cards into the same readable selection treatment.
- Refine shared quest headers, lobby/readiness typography, group reveal, home composition and itinerary wrapping.

## Validation

Validation results and remaining limitations are recorded below after final checks. Local screenshots, baseline file copies and the isolated browser profile are in ignored `.tmp/ui-review/`. Temporary preview routes are removed before delivery. Fixture screenshots exercise actual components with local sample data; they do not prove a live multi-user backend session.

### Final checks

- `npm run typecheck` and `npm run lint` pass.
- 125 tests pass across 17 affected suites: quest, map, preference accessibility, preference room, group reveal, calendar, lobby, itinerary, trip carousel, itinerary day views, voting, place import, inspiration, destinations, constraints, budget and budget recommendation screens.
- A production Expo web export succeeds with 25 routes and no temporary preview route.
- Captured 19 application/fixture cases at widths 320, 390 and 1280. The visible-viewport DOM overflow check reported no horizontal overflow. Intentionally horizontal collections and the flight route were excluded from that overflow check.
- Visually inspected the home before/after, narrow create-trip journey, budget form, voting, selected country cards, loading/disabled controls, completed and solo flight routes, and calendar. Additional captures cover social, solo/create choice, inspiration, account, empty trips, quest dates, Wishlist, Explore, Logistics, member budget, loading and error states.
- Fixed home helper-copy clipping after screenshot inspection. Rechecked desktop columns and live resize to a 320-wide viewport.
- Clicked Japan in the real country component: visible green/check selection and browser `aria-checked=true`. Entered a maximum below comfortable spending: the inline error appeared and saving remained disabled.
- Opened the date picker and verified `aria-expanded=true`. Corrected its remaining orange endpoint to dark green with cream text; calendar behavior tests still pass.
- Verified loading `aria-busy=true`, disabled `aria-disabled=true`, a 2-point keyboard focus border, and Enter-key navigation from the create-choice page to the solo route.
- The installed React Native Web renderer did not expose the existing native `accessibilityState` object as DOM state. Explicit supported `aria-*` aliases now mirror the same expressions throughout existing controls. Native props, guards and business decisions remain in place.

### Limits

Screenshots were taken in an isolated desktop Edge browser, including phone-sized viewports. No physical iOS/Android device, native screen reader, native enlarged-font setting, or live multi-user backend session was tested. Loaded quest state screenshots use local fixtures. Loaded lobby/group-match/itinerary behavior is covered by automated tests; those live account-specific screens were not fully visually exercised. No production data model, server permissions, dependencies or assets were changed.
