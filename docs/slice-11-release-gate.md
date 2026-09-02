# Slice 11 release-gate audit

Audited 2026-09-02. This file distinguishes implemented controls from evidence that still requires release infrastructure or physical devices.

| Gate | Status | Evidence / remaining action |
| --- | --- | --- |
| Privacy-safe analytics | Pending | No production analytics sink is configured. Do not add events until an allowlisted schema rejects invitation tokens, accessibility data, private text, and itinerary content. |
| CI coverage | Partial | Local scripts cover TypeScript, lint, Jest, Deno tests, pgTAP, and Maestro specs. A hosted CI workflow has not yet been configured in this repository. |
| Non-sensitive error telemetry | Partial | Edge Functions return stable operation/error codes and operation-key status is persisted. A Sentry-equivalent sink with latency, schema version, and model fields still needs production configuration. |
| Four-device planning modes | Pending physical run | Existing multi-client harnesses cover preferences and voting; `offline-four-client-convergence.js` adds the 60-second reconnect gate. Run all three planning modes on four release-build devices. |
| Mid-range Android | Pending physical run | Verify initial lobby load, realtime delivery, reconnect under five seconds, and preference-card animation frame rate on representative hardware. |
| Accessibility | Partial | Components use semantic roles/live regions, 48–68px controls, reduced motion, and contrast tokens. Screen-reader, dynamic-text, visible-focus, and device-level contrast audits remain release evidence. |
| Production secret inspection | Pending bundle run | Client code references only `EXPO_PUBLIC_SUPABASE_URL` and the publishable key. Inspect the signed production bundle for `GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and token fixtures before release. |
| Product exclusions | Pass by source audit | No booking, payment, live-price guarantee, expense splitting, or public-social feature is implemented. |

The release gate is not complete until every Pending or Partial row has attached CI or device-run evidence.
