# CutiSama2 design system

## Evidence and status

Inspected 2026-09-12: the actual 1884 × 835 `assets/images/yellow otter.png`, `src/theme/{tokens,motion}.ts`, shared components, app root/home, quest stages, preference table, group reveal and itinerary. Screen findings below are source inspection, not a claim of live device visual verification. Paths are repository-relative.

The artwork has a fresh lime rounded backdrop, brown otter and cocoa wordmark, pale green folded map, cream muzzle, and vivid orange backpack. It does **not** contain a distinct dominant golden-yellow reward swatch despite its filename. Gold below is an explicitly adapted warm highlight. The image has textured shading: no single pixel is the definitive brand colour.

**Existing** means implemented at inspection. **Proposed** means guidance for future authorised work, not code or an available component/token. This skill does not migrate the theme.

## Logo-derived target palette (proposed semantic names)

Samples were taken directly from the original PNG after visual inspection. Coordinates below use its original pixels, origin at top left; representative colours are frequent exact pixels in those regions. Adaptations are labelled rather than claimed as literal samples.

| Proposed role/name | Exact hex | Visual derivation and use | Implementation status |
| --- | --- | --- | --- |
| `brandLime` | `#8CB64A` | Frequent backdrop sample in x245–630/y230–310; primary CTA fill and local selection highlights | New; existing `leaf` is nearby `#91B947` |
| `actionStrong` | `#4F7027` | Darkened map-pin/leaf family for readable links, active navigation, progress, success and selected outlines | Existing `colors.sky`; proposed semantic alias |
| `onLime` | `#382819` | Deepened nose/outline brown, adjusted for contrast; text/icons on bright lime | New accessible adaptation |
| `leafSurface` | `#D9E5B2` | Exact pale-map sample in x420–540/y485–600; supporting badges and selected-card surfaces | New |
| `selectedSurface` | `#EDF4DB` | Lighter adaptation of map greens; subtle selected and success panels | Existing `surfaceTint` |
| `heading` | `#593D2C` | Frequent wordmark sample in x735–1650/y350–490, ignoring white surround | New exact sample; existing `ink`/`cocoa` is close `#5B402E` |
| `textSecondary` | `#78614F` | Muted warm-fur adaptation for supporting text | Existing `textMuted` |
| `canvas` | `#FFFBF3` | Near-white adaptation of cream muzzle and map paper; dominant background | Existing `background` |
| `surfaceWarm` | `#FAE2BF` | Exact muzzle sample in x345–550/y410–470; beige secondary cards/inputs/panels, used with cream spacing | New; existing `sand` is `#FCE6BE` |
| `accentCaramel` | `#85571F` | Dark warm-brown adaptation of fur/backpack shadows; small accent labels on cream | Existing `gold` |
| `accentOrange` | `#FE7B22` | Exact backpack sample in x265–310/y460–580; occasional notification/detail accent | New; existing `orange` is `#F58A20` |
| `rewardGold` | `#F6C777` | Golden adaptation between orange backpack and cream muzzle; milestone/stamp fill | Existing `sun`; not a literal dominant logo sample |
| `separator` | `#D9DFC5` | Desaturated map-green adaptation; subtle separators | Existing `border` |
| `error` | `#AE3C32` | Semantic red for errors/destructive actions; not a logo-derived swatch | Existing `danger` |

Use green for positive actions, important travel highlights and active/progress states. For a future bright-lime primary button use `onLime`, not white or ordinary cocoa. The existing dark-green/white `AppButton` remains a valid accessible green variant. Do not change its background alone. Large bright-lime surfaces and orange primary CTAs are outside this direction.

These semantic names are recommendations only. Prefer existing tokens for scoped polish. If a palette migration is requested, add shared semantics in `src/theme/tokens.ts` and update both foregrounds and backgrounds in the affected scope; explain new exports. Do not scatter this table's hex values through screens.

### Measured accessible pairs

WCAG sRGB relative-luminance ratios, opaque colours, rounded to two decimals. Use at least 4.5:1 for ordinary text, 3:1 for large text and meaningful control/state graphics. Recheck actual composites, images, gradients and pressed opacity.

| Foreground / background | Ratio | Use |
| --- | --- | --- |
| `#382819` / `#8CB64A` | 5.99:1 | Proposed lime CTA label/check |
| `#593D2C` / `#FFFBF3` | 9.56:1 | Proposed cocoa headings/body |
| `#593D2C` / `#D9E5B2` | 7.42:1 | Leaf-surface card copy |
| `#593D2C` / `#FAE2BF` | 7.84:1 | Beige card/input copy |
| `#593D2C` / `#F6C777` | 6.27:1 | Reward labels |
| `#382819` / `#FE7B22` | 5.43:1 | Small orange badge label |
| Existing `ink` / `background` | 9.17:1 | Current main text |
| Existing `textMuted` / `background` | 5.62:1 | Current supporting text |
| `#FFFBF3` / existing `sky` | 5.53:1 | Warm alternative to white on dark green |
| Existing `sky` / `surfaceTint` | 5.05:1 | Green selected/success copy |
| Existing `danger` / `background` | 5.83:1 | Error copy |

White on sampled lime is only 2.36:1; sampled cocoa on that lime is 4.18:1. Existing `ink` on `leaf` is 4.16:1; existing `gold` on `sun` is 3.95:1. None is a normal-size text pairing. Pale borders are decorative, not sufficient focus/selection indicators: add a dark-green outline and a check or label when the boundary conveys state.

## Existing tokens and layout

`src/theme/tokens.ts` currently exports:

- Colours: `background #FFFBF3`, `surface #FFFFFF`, `surfaceTint #EDF4DB`, `ink #5B402E`, `paper #FFFFFF`, `coral #A64B08`, `coralPressed #813805`, `sand #FCE6BE`, `sky #4F7027`, `gold #85571F`, `sun #F6C777`, `textMuted #78614F`, `border #D9DFC5`, `danger #AE3C32`, `disabled #969482`, `overlay rgba(255, 251, 243, 0.96)`, `leaf #91B947`, `orange #F58A20`, `cocoa #5B402E`.
- Compatibility aliases: `midnight` is cream, `midnightRaised` is white, `midnightSoft` is pale green, and `white` is brown. Names are misleading; inspect values and callers.
- Spacing: `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`, `xxl 32`, `hero 48` logical units. Screen horizontal gutter is 16; panels commonly pad 24; related items gap 8–12; sections gap 16–32. Some screens use local numbers.
- Radii: `sm 10`, `md 16`, `lg 24`, `pill 999`. Inputs/buttons/choice cards use 16; panels use 24; avatars use circles. `FlightPath` locally uses 22. Do not apply pill radii to every rectangle.
- No shared shadow/elevation tokens or `shadow`/`elevation`/`boxShadow` styles were found under `src`. Existing depth comes from surfaces, borders and transforms. **Proposed:** only if a screen needs elevation, add a restrained warm-cocoa shared shadow appropriate to the platform and verify it. Flat is the default; no heavy black outlines, glass layers or nested card stacks.

## Typography

**Existing:** React Native platform default fonts. No `fontFamily`, `useFonts` or custom font loading was found in `src`; installed `expo-font` does not establish a font choice. Do not infer the illustrated logo lettering is a usable UI font.

Tokens: `display 40`, `title 28`, `heading 19`, `body 15`, `small 12`, `label 10`. `questStyles.title` uses 32/37 line height, weight 900; heading 19/26 weight 800; body 15/23; small 12/19. Home title is 34/40; announcement title 30/38; many labels use 700–900 and uppercase kickers.

**Recommended hierarchy using existing fonts:** page/chapter title 28–32 bold cocoa; main question 19–28 depending on whether it is the page title; support 15 with 23–24 line height; choice labels 15–19 semibold/bold; helper text at least 12, preferably 14 for actionable guidance (14 is a proposed shared helper size, although local 14s exist). Avoid duplicating two competing giant headings. Restrict uppercase to short nonessential kickers; use few weights per screen. Let enlarged text wrap; replace fixed-height copy regions before reducing font size.

## Components and states

| Existing source/component | Existing behaviour | Guidance / proposed improvement |
| --- | --- | --- |
| `src/components/screen.tsx` — `Screen` | Scrollable by default; safe top/bottom; iOS keyboard avoidance; max width 560; optional footer outside scroll; decorative cloud hidden from accessibility | Reuse, check combined bottom inset with global navigation; footer must not obscure content or keyboard |
| `src/components/app-button.tsx` — `AppButton` | Primary `sky`/`paper`; secondary `surface`/`ink` with border; radius 16, minimum height 54; pressed opacity .82/scale .99; inactive opacity .48; loading spinner; disabled/busy accessibility states | Preserve guards; proposed warm/lime variants need paired label/spinner colours and measured pressed contrast. Keep accessible name while loading (currently label is replaced). No existing destructive/outline variant; use semantic danger for destructive actions |
| `src/components/form-field.tsx` — `FormField` | Label, hint, 52-min-height white input, radius 16, brown text, `coral` selection, red border/error live region; multiline minimum 108 | Proposed beige/cream input, green focus border and selection. Focus styling does not currently exist. Keep helper and error text; use numeric modes as in `BudgetStage` (`number-pad`) without changing validation |
| `src/components/date-field.tsx` — `DateField` | Inline month calendar, minimum-date guards, 44-high day cells, green selection, disabled opacity, clear action, labelled errors | Preserve date/business rules; ensure narrow cells have adequate touch width as well as height |
| `src/features/cards/preference-card.tsx` — `PreferenceCard` | Illustrated radio card, selected text and lift/scale; 154×232 or compact 140×206; per-card accent | Reuse for its existing preference flow; do not copy fixed heights/truncation into a new dynamic-text grid. Selected green plus check is proposed for new choice patterns |
| `src/features/quest/country-picks.tsx` — `CountryPicks` | Photo/flag fallback grid, selected checks and slots, disabled limit states, submit/edit/empty search | Strong basis for expressive choices; audit selected caption foreground before reuse |
| `src/components/StaleStateBanner.tsx` | Gold-bordered offline/reconnecting alert | Preserve stale data and retry semantics; do not show a false saved/success state |

Other reusable pieces: `BrandLogo`, `BottomNavigation`, `FlightPath`, `FlightStopIcon`, `CardHand`, `SharedTable`, `RoundReveal`, `AttractionMap`, `DestinationAnnouncement`, `CrewChoices`, and `questStyles`. There is no generic shared `Card`, `ChapterHeader`, `VibeCard`, `MascotState`, or gradient component in the inspected implementation.

## Navigation, maps and quest identity

`src/app/_layout.tsx` uses Expo Router Stack and global `BottomNavigation`, with custom headers hidden for quest/itinerary. Bottom navigation has Home, Trips, Create, Social, Account, SVG stroke icons, selected pale-green capsule, green active text, selected accessibility state and 58-min-height tabs. Itinerary also uses feature `TripBottomNav`; check both bars together before changing navigation.

Icons are custom `react-native-svg` paths (`BottomNavigation`, `FlightStopIcon`) plus text glyphs, flags and emoji in feature screens. Preserve the existing stroke language and label icons; no new icon/font dependency is needed. `expo-symbols` being installed does not make it the app's shared icon system.

Quest imagery is already expressed through a dashed flight path, plane, country-photo collection, face-down cards, checkmarked crew avatars, destination reveal and beige ticket with dashed dividers. Preserve that collaborative narrative. Active/progress is green; completion currently mixes green checks and gold-accented preference completion. **Proposed:** sparse golden stamp treatment for milestones, never a fake completion while requests are pending.

`AttractionMap` uses unmodified OpenStreetMap raster tiles via `expo-image`, custom projection and `PanResponder`; it is not a `react-native-maps` view. It has a 310-high rounded viewport, numbered pins turning into checks when selected, zoom/reset controls, attribution, loading/error/retry and a usable attraction list when tiles fail. Current unselected pins are burnt orange (`coral`), selected pins dark green. **Proposed:** green important pins and leafy secondary pins with dark legible numbers; orange/gold only special places. Keep geographic detail, attribution, list selection/locate alternatives, zoom limits and error recovery intact.

## Mascot and special moments

Primary identity reference is the original spaced filename. Existing `BrandLogo` renders the processed `assets/images/yellow-otter-logo.png` using `expo-image`, contain fit, 1443/431 aspect ratio, max width 400 or compact width 148. Do not confuse the full wordmark with an existing isolated mascot asset.

**Proposed usage:** a modest companion at onboarding, chapter introductions, waiting/empty states, success, quest completion or a future Plan Rescue experience. No Plan Rescue screen was found in `src`. A mascot-only cutout or new pose would be a new asset; identify it as such. Avoid placing a large full logo on every screen or crowding choices beneath illustrations.

No gradient implementation or `expo-linear-gradient` dependency was found. **Proposed:** sparse green-to-yellow or lime-to-leafy gradients for a chapter intro, milestone, completion or selected hero, only when justified and implemented with available capabilities or an explicitly identified addition. Flat surfaces remain the default.

## Motion and accessibility

Existing dependencies: Reanimated 4.5.1, Gesture Handler ~2.32.0, Worklets 0.10.1; React Native `Animated` is used too. `src/theme/motion.ts` exports `useReducedMotion`, `roundMotion`, and durations 260ms throw, 420ms reveal, 120ms reduced fade. `FlightPath` uses a cancellable 850ms native-driver timing animation (0 with reduced motion); `CountryVote` uses `Animated`/PanResponder spring/reset; `CardHand` uses Reanimated drag/spring and a local 240ms throw; photo transitions use 180–240ms; announcement is a native modal fade. Reuse the library already used by the target component, without adding dependencies.

Proposed interactions: quick card press/selection, brief reveal or stamp, one restrained completion celebration. Stop/cancel on interruption/unmount; avoid loops and excessive bounce. Respect reduced motion throughout, including gesture resets and image/modal transitions; existing support is not universal. Keep tap alternatives to swiping. `Vibration.vibrate(12)` exists after preference submission; it is not an installed haptics abstraction.

Accessibility rules: minimum 44×44 effective touch area, preferably 48 where practical; visible state plus `accessibilityState`; meaningful names for icon controls and busy buttons; header roles and restrained live announcements; modal focus/dismissal; hidden decorative graphics; safe areas and keyboard access. Test at narrow phone widths and enlarged system text, including long names and translated-length copy. Loading must remain labelled, errors actionable, disabled reasons understandable. Never shrink important copy to force a layout to fit.

## Observed inconsistencies to address only within scope

- White `surface`/`paper` dominates cards/navigation despite warm canvas; beige surfaces are a proposed direction, not the current default.
- Semantic-looking legacy aliases obscure actual colours; `sky` is green and `white` is brown.
- `CountryPicks` selected card background is `sky`, while `countryName` remains `ink`; selected foreground needs review. Group-reveal blocking chips use `ink` on `coral` (1.64:1). Preference `chill` uses pale `sand` for accent/selected text. Do not copy these pairings.
- Map loading spinner uses cream `background` over white `paper`; its visibility is poor. Error text in `QuestScreen` is wrapped in green `s.success` styling.
- 9–11-size labels, uppercase kickers, fixed card heights and `numberOfLines` truncation are common. These are observed constraints, not accessibility endorsements.
- Primary loading buttons replace their visible label with a spinner; disabled styling relies mainly on opacity. Input selection is orange-brown and lacks a green focus treatment.
- Navigation has both global and itinerary-local bars; inspect inset/density together. Modal backdrop is a local cool `rgba(18, 32, 42, 0.6)` rather than a shared warm token.
- No central shadow, gradient, stamp, trip-vibe-grid or mascot-state component exists. Do not imply those additions have shipped.
