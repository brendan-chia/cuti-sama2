---
name: cutisama-ui
description: Design, redesign, or polish user-facing Expo React Native screens and components in CutiSama2 using its otter-led visual identity and existing quest UI patterns. Use for application UI work, not backend-only changes or unrelated websites.
---

# CutiSama UI

Make the app feel like a warm, polished collaborative travel quest: youthful, adventurous, friendly and trustworthy. The otter is a travelling companion; its map, backpack, rounded silhouette and cocoa lettering are the visual anchors. Avoid booking-app templates, corporate dashboards, recoloured Material UI, Trip.com imitation, childish cartoon saturation and neon gaming styling. Use wanderlog as reference for layout, spacing, typography and colour hierarchy, but not for visual identity. Use the existing quest UI patterns and shared components; do not invent new ones without approval.

## Start with evidence

- Read repository instructions, including the exact [Expo v57 docs](https://docs.expo.dev/versions/v57.0.0/) before writing code. Check installed versions; do not upgrade dependencies as part of styling.
- Inspect the target screen, neighbouring components, state handling and shared tokens before editing. Inspect `assets/images/yellow otter.png` directly for identity decisions.
- Consult [design-system.md](references/design-system.md) for colours, type, component treatment, motion and accessibility. It separates existing implementation from proposed additions; proposed names are not exports.
- Consult [screen-patterns.md](references/screen-patterns.md) for chapter, choice, private submission, reveal, map, organiser and completion work. Recheck source paths because this is a repository snapshot, not a replacement for current code.

## Design principles

- Lead with cream backgrounds, cocoa hierarchy and green actions/progress. Keep lime local to meaningful interaction; reserve orange/gold for rewards and small highlights. Use measured foreground/background pairs.
- Prefer flat warm surfaces, rounded tactile choices, efficient breathing room and restrained borders. Gradients and mascot moments are occasional accents, not screen-wide defaults.
- Show selected, pressed, disabled, loading, empty, error and success states deliberately. Pair colour with checks, labels or other visible indicators.
- Keep the whole screen usable on small phones and with enlarged text. Reflow content instead of shrinking important text; preserve safe areas, keyboard access and screen-reader states.

## Implementation guardrails

Reuse `Screen`, `AppButton`, `FormField`, `DateField`, navigation and relevant feature components where sensible. Use shared semantic tokens; explicitly identify any proposed token, component, font or dependency before introducing it in an authorised UI task. Do not blindly remap legacy colour aliases across the app.

Preserve business logic, private data boundaries, solo/group differences, organiser permissions, persistence, validation, offline recovery and action gates unless the user requests UX changes. Do not infer a new data model from a visual pattern. Keep changes scoped; avoid unrelated refactors and unnecessary dependencies. Follow existing Expo Router, React Native `StyleSheet`, TypeScript and `@/` imports. Use existing motion tools and reduced-motion support.

After implementation, review the complete screen and adjacent navigation in relevant states. Run `npm run lint`, `npm run typecheck` and relevant Jest tests (`npm test -- --runTestsByPath <test paths>`) when available. Report checks and any unverified device behaviour honestly. Documentation-only skill edits need skill validation rather than application test runs.
