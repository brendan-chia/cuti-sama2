# Travel-post discovery in Explore

Implemented scope: public-link/caption/screenshot input → candidate place extraction → real place lookup → explicit member confirmation. This feature does not generate routes, schedules, transit connections, fares, or bookings.

## Using it

After the crew chooses a country, open **Explore → Add a travel post**. Paste a TikTok, Instagram, or YouTube URL, a caption, or place names. A screenshot with visible names is another input. Check each candidate's address and OpenStreetMap record, select the correct alternatives, and confirm. Candidates start unselected. Confirmed places appear on the crew's discovery map, with a Locate action. The organiser can include them in the existing final stop collection.

Every active quest participant, including the organiser, can import and confirm their own results. Unconfirmed candidates are private to their importer. Confirmed places and source links are shared with active participants. Confirmation identifies a location; it is not a group vote or a promise that the crew will visit. The existing country ballot gives the organiser the same votes as everyone else; only tied-result resolution is organiser-specific.

## Sources and fallback

- TikTok: the official oEmbed endpoint can provide public caption metadata. Short URLs are resolved with a bounded redirect chain and an exact HTTPS host allowlist. Embedded markup is never executed by the backend, and videos are not downloaded.
- Instagram and YouTube: links are retained as inspiration references. Automatic extraction from these platforms is not implemented; users supply a caption or screenshot.
- Inaccessible/private/deleted links: the UI requests supplied text or an image. There is no social credential collection or login bypass.
- Groq extracts up to four named places into validated JSON. It must not infer unnamed landmarks from appearance. Without text-model configuration, explicit newline-separated names still serve as search queries. Screenshot extraction requires the AI provider.
- Photon resolves up to three alternatives per extracted name, and results are filtered to the quest's country. Coordinates and OSM identifiers are validated; AI coordinates are never accepted. Search results are possible matches, not automatic verification of what the post intended.
- Photon public service is suitable only for modest usage and has no availability guarantee. `PHOTON_API_URL` can point to an operated Photon service when usage grows. The UI includes OpenStreetMap attribution and record links.

## Backend and configuration

Migration `0017_place_imports.sql` adds private import jobs and shared confirmed places. `begin_place_import` reserves a request under the trip lock, enforces Explore membership, and limits each member to 10 imports per trip per hour. The Edge Function alone writes candidates. `confirm_trip_places` accepts only IDs from the caller's stored result, checks the active country/stage, deduplicates records, caps the crew collection at 40, and increments quest revision for existing realtime broadcasts. The organiser's existing final collection remains capped at 20 stops. Screenshot bytes and full captions are not stored in these database tables; short extracted evidence is included with candidates.

Existing secrets: `GROQ_API_KEY`, `GROQ_STRUCTURED_OUTPUT_MODEL`. Optional: `GROQ_VISION_MODEL` (default `qwen/qwen3.6-27b`, verified against Groq's current vision documentation), `PHOTON_API_URL`. Never put provider keys in `EXPO_PUBLIC_*` settings. Screenshots are limited to roughly 3 MB and request bodies to 4.1 MB including base64. Users are informed before sending input to the AI provider.

Deploy both Edge Functions when the shared quest schema changes:

```sh
npx supabase db push
npx supabase functions deploy import-trip-places
npx supabase functions deploy suggest-trip-period
```

Expo ImagePicker is installed at the SDK 57-compatible version. Native custom development builds need rebuilding to include a newly added native module/configuration. This feature requests photo selection, not camera or microphone access.

## Design

The application uses a shared sky/paper/navy palette with sun-yellow accents. Welcome uses locally bundled travel postcards, creation and the quest use a five-stop animated flight plan, and the lobby uses departure-lounge/boarding-pass details. The plane stays at the current stop, advances with quest state, and honours reduced-motion preferences. Existing screens retain their functionality under the shared theme.

Welcome photo sources, reused from the existing catalogue:
- Japan: https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e
- Malaysia: https://images.unsplash.com/photo-1596422846543-75c6fc197f07

## Verification

App tests cover explicit confirmation, no preselected candidates, inaccessible-post fallback, and the existing organiser ballot. Provider tests cover unsafe URLs, private-source fallback, malicious redirects, metadata-only reading, and rejection of wrong-country or invalid coordinates. `supabase/tests/0011_place_imports.sql` runs rollback-only checks for membership, ownership, deduplication, forged IDs, stage gates, shared visibility, selecting imported stops, and organiser voting.

Live checks on a disposable trip verified an organiser vote, caption extraction, screenshot extraction, and persisted confirmation. Local browser checks exercise the production web build. The Expo development preview rendered without page errors. Direct dynamic-trip URLs on the temporary static-file preview reported a React hydration warning despite successful interaction; deployment-specific static routing/hydration needs further validation before publishing a static website. No native-device visual verification has been performed.

References: [Expo ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/), [TikTok embeds](https://developers.tiktok.com/docs/en/embed-videos), [Photon](https://github.com/komoot/photon), [Groq vision](https://console.groq.com/docs/vision).
