# Local social-post imports

In Explore, paste an Instagram post/Reel or TikTok video URL and choose **Find the places**. The worker detects the actual media. Instagram `/p/` posts can contain a single photo, a video, or a mixed carousel; all items are analysed automatically. The `img_index` query is preserved in the source link, but the whole post is analysed. Public Reels and TikTok videos retain video analysis. Caption/screenshot input is offered only as a fallback after a failed or empty automatic result.

The local worker uses Instaloader for Instagram `/p/` media metadata and yt-dlp for Reels/TikTok. It uses no account credentials or saved login sessions. CDN downloads allow only HTTPS Instagram/Facebook media hosts, validate redirects and cap the complete post at 150 MB. Up to 20 media items and two minutes per video are supported. Instagram may still require login or throttle public requests; these failures are reported without pretending the post was analysed.

Every photo is decoded locally, resized to fit 1440×1440 and sent to Groq vision once. FFmpeg selects representative video scenes, resized to fit 720×720. One shared budget caps a post at 20 vision calls: every carousel item gets at least one image, and remaining calls are divided among its videos. Single videos retain 8–20 scenes (fewer for short sources). ElevenLabs Scribe v2 transcribes each available audio track. Images need no audio API key. Evidence cites photo numbers or video item numbers and timestamps. Audio and visual checkpoints resume without repeating completed items.

Caption, timestamped audio and selected-scene observations are fused into up to 12 place queries. Photon/OpenStreetMap matches real records in the selected country; AI-generated coordinates are never accepted. At most 12 candidates are shown with addresses and evidence, all requiring confirmation. A map match is not proof that a tentative visual identification is correct. No Google Places key is required.

## Running on this computer

FFmpeg/ffprobe and the isolated yt-dlp environment have been installed/configured during implementation. A scoped worker token is stored in the ignored `.env.video-worker.local`; ElevenLabs, Groq and database-admin keys stay in Supabase.

```
npm run video-worker
```

Keep the process running. Ctrl+C stops it; a processing job becomes retryable and resumes from its saved scene checkpoint. If it crashes, a worker can reclaim the job after three minutes. The app displays queued/offline state, audio status, selected-scene counts, cancellation and retry. Only the importing member sees unconfirmed results. The manifest hash covers the media and chosen frame indexes/timestamps. Unfinished pipeline versions 1–2 reset their incompatible checkpoints once; finished imports remain intact.

The worker makes outbound HTTPS requests, so no public port, local server address or tunnel is needed. Audio goes to ElevenLabs; selected frames and text go to the configured Groq models, with at most twenty vision calls per attempt. Rate-limit failures use bounded backoff; exhausted retries leave a resumable failed job.

During implementation a worker was started in the background. Its PID is in `.tmp/video-worker.pid`; logs are `.tmp/video-worker.log` and `.tmp/video-worker-error.log`. Restart it with the command above after restarting the computer. Avoid running duplicate copies unnecessarily.

## Fresh setup

Install Node 24+, Python 3.13+, and FFmpeg/ffprobe on PATH. Then:

```
python -m venv .tmp/video-worker-venv
.tmp/video-worker-venv/Scripts/python.exe -m pip install -r scripts/video-worker/requirements.txt
npm run video-worker:setup
npm run video-worker
```

Setup requires an authenticated, linked Supabase CLI on PATH. Set `SUPABASE_CLI` to its executable path if necessary. It creates a random worker credential and registers `VIDEO_WORKER_TOKEN` as a Supabase secret without exposing keys. `VIDEO_WORKER_PYTHON` can override the isolated Python executable. On non-Windows systems use the venv's `bin/python` for installation.

Apply migrations through `0025_social_post_media.sql`, deploy `video-import` and `video-import-worker`, then restart the worker. Only `video-import-worker` disables gateway JWT verification; it requires its scoped token on every request. The public API authenticates membership and enforces the existing import quota. Raw jobs stay service-role-only.

## Retention and verification

Successful jobs delete any legacy uploaded video, full transcripts, transcript segments, metadata and scene observations. Local files are removed after each attempt; checkpoints remain for retry. Failed jobs retain evidence for retry/cancel and have no automatic expiration yet. Full transcripts and unconfirmed evidence are not exposed to other members.

Verification includes a real FFmpeg test confirming all eight frames and audio from a two-second fixture, request/security tests for Instagram metadata, UI tests for video-mode selection and cancellation, and a rollback-only database test rejecting partial, cancelled or wrong-lease completion. Before the ElevenLabs integration, a live synthetic-video import verified two of two frames, Whisper transcription, vision, map lookup and confirmation against the deployed backend; temporary test records were removed.

## API keys and deployment

Create an ElevenLabs API key with speech-to-text access in the ElevenLabs developer dashboard. In **Supabase Dashboard > your project > Edge Functions > Secrets**, add:

- `ELEVENLABS_API_KEY`: your ElevenLabs key (required for videos with audio).
- `GROQ_API_KEY`: your Groq key (text and vision).
- `ELEVENLABS_TRANSCRIPTION_MODEL`: optional, defaults to `scribe_v2`.
- `GROQ_STRUCTURED_OUTPUT_MODEL`: optional, defaults to `openai/gpt-oss-20b`.
- `GROQ_ITINERARY_MODEL`: optional; falls back to the structured model. Use `openai/gpt-oss-120b` for itineraries if desired.
- `GROQ_VISION_MODEL`: optional, defaults to `qwen/qwen3.6-27b`.

DeepSeek and OpenRouter secrets are not used by this configuration. Groq quota limits still apply to text and vision. Never put provider keys in `EXPO_PUBLIC_*` variables or the mobile app.

For local Edge Functions, merge these settings from `supabase/functions/.env.example` into the ignored `supabase/.env.local` (preserve existing secrets), then run:

```powershell
supabase functions serve --env-file supabase/.env.local
```

The local video worker calls your configured Supabase project: hosted functions require Dashboard secrets even when the worker itself runs on your computer. Provider keys do not belong in `.env.video-worker.local`.

Deploy the updated shared Groq configuration and audio adapter after setting hosted secrets:

```powershell
supabase functions deploy video-import-worker
supabase functions deploy import-trip-places
supabase functions deploy generate-itinerary
supabase functions deploy revise-itinerary
supabase functions deploy group-match
supabase functions deploy suggest-trip-period
```

ElevenLabs adapter verification uses mocked API responses; a live transcription requires your configured key and an available quota. Reference: https://elevenlabs.io/docs/api-reference/speech-to-text/convert

## Photo/carousel update

Apply `0025_social_post_media.sql`, deploy both `video-import` and `video-import-worker`, and restart the local worker before using photo/carousel analysis. Deploy any changed shared Groq consumers as listed above. Update dependencies with:

```powershell
.tmp/video-worker-venv/Scripts/python.exe -m pip install -r scripts/video-worker/requirements.txt
```

Checks: `node --test scripts/video-worker/*.test.mjs`; Python fixtures with `python -m unittest discover -s scripts/video-worker -p '*_test.py'`; UI and Edge Function regression tests. Real media preparation verifies photo decoding, mixed-carousel item identity, audio availability and deterministic retry hashes.
