# Local social-post imports

In Explore, paste an Instagram post/Reel or TikTok video URL and choose **Find the places**. The worker detects the actual media. Instagram `/p/` posts can contain a single photo, a video, or a mixed carousel; all items are analysed automatically. The `img_index` query is preserved in the source link, but the whole post is analysed. Public Reels and TikTok videos retain video analysis. Caption/screenshot input is offered only as a fallback after a failed or empty automatic result.

The local worker uses Instaloader for Instagram `/p/` media metadata and yt-dlp for Reels/TikTok. It uses no account credentials or saved login sessions. CDN downloads allow only HTTPS Instagram/Facebook media hosts, validate redirects and cap the complete post at 150 MB. Up to 20 media items and two minutes per video are supported. Instagram may still require login or throttle public requests; these failures are reported without pretending the post was analysed.

Every photo is decoded locally, resized to fit 1440×1440 and sent to OpenAI vision once. FFmpeg selects representative video scenes, resized to fit 720×720. One shared budget caps a post at 20 vision calls: every carousel item gets at least one image, and remaining calls are divided among its videos. Single videos retain 8–20 scenes (fewer for short sources). OpenAI Whisper transcribes each available audio track with segment timestamps. Both image analysis and audio use OPENAI_API_KEY. Evidence cites photo numbers or video item numbers and timestamps. Audio and visual checkpoints resume without repeating completed items.

Caption, timestamped audio and selected-scene observations are fused into up to 12 place queries. Photon/OpenStreetMap matches real records in the selected country; AI-generated coordinates are never accepted. At most 12 candidates are shown with addresses and evidence, all requiring confirmation. A map match is not proof that a tentative visual identification is correct. No Google Places key is required.

## Running on this computer

FFmpeg/ffprobe and the isolated yt-dlp environment have been installed/configured during implementation. A scoped worker token is stored in the ignored `.env.video-worker.local`; OpenAI and database-admin keys stay in Supabase.

```
npm run video-worker
```

Keep the process running. Ctrl+C stops it; a processing job becomes retryable and resumes from its saved scene checkpoint. If it crashes, a worker can reclaim the job after three minutes. The app displays queued/offline state, audio status, selected-scene counts, cancellation and retry. Only the importing member sees unconfirmed results. The manifest hash covers the media and chosen frame indexes/timestamps. Unfinished pipeline versions 1–2 reset their incompatible checkpoints once; finished imports remain intact.

The worker makes outbound HTTPS requests, so no public port, local server address or tunnel is needed. Audio, selected frames and text go to OpenAI, with at most twenty vision calls per attempt. Rate-limit failures use bounded backoff; exhausted retries leave a resumable failed job.

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

Verification includes a real FFmpeg test confirming all eight frames and audio from a two-second fixture, request/security tests for Instagram metadata, UI tests for video-mode selection and cancellation, and a rollback-only database test rejecting partial, cancelled or wrong-lease completion. The current OpenAI adapters are verified with mocked API responses; a live run of this update still requires your key and deployed functions.

## API keys and deployment

In **Supabase Dashboard > your project > Edge Functions > Secrets**, add:

- `OPENAI_API_KEY`: your OpenAI API key, used for text, images and audio.
- `OPENAI_INSPIRATION_MODEL`: defaults to `gpt-4.1-mini` for combining place evidence.
- `OPENAI_VISION_MODEL`: defaults to `gpt-4.1-mini` for photos and sampled video frames.
- `INSPIRATION_LLM_PROVIDER=openai`: selects OpenAI for caption-only saved inspiration too.

Audio uses OpenAI `whisper-1` for the timestamped transcript contract. This media path does not call Groq, ElevenLabs or OpenRouter. Unrelated AI features retain their existing configuration. Never put provider keys in `EXPO_PUBLIC_*` variables or the mobile app.

For local Edge Functions, merge these settings from `supabase/functions/.env.example` into the ignored `supabase/.env.local` (preserve existing secrets), then run:

```powershell
supabase functions serve --env-file supabase/.env.local
```

The local video worker calls your configured Supabase project: hosted functions require Dashboard secrets even when the worker itself runs on your computer. Provider keys do not belong in `.env.video-worker.local`.

Apply migration `0040_saved_inspiration_media.sql` (after earlier migrations), then deploy:

```powershell
supabase functions deploy video-import-worker
supabase functions deploy analyze-inspiration
supabase functions deploy import-trip-places
```

Restart the updated worker. It now also claims private Saved inspiration media jobs before trip imports. Saved jobs do not require a trip or chosen country. Successful analyses become available in Wishlist; map matching and confirmation happen in Explore. Saved jobs clear transcripts and observations on completion or failure; a failed saved job restarts when retried. Interrupted saved jobs can be reclaimed after two minutes. See [Saved inspiration](saved-inspiration.md) for the full flow.

OpenAI contract checks: `node --experimental-strip-types scripts/test-inspiration-ai.mjs` and `node --experimental-strip-types scripts/test-saved-media.mjs`. Live transcription needs your configured key and quota. [Official transcription documentation](https://developers.openai.com/api/docs/guides/speech-to-text).

## Photo/carousel update

Apply `0025_social_post_media.sql`, deploy both `video-import` and `video-import-worker`, and restart the local worker before using photo/carousel analysis. Update dependencies with:

```powershell
.tmp/video-worker-venv/Scripts/python.exe -m pip install -r scripts/video-worker/requirements.txt
```

Checks: `node --test scripts/video-worker/*.test.mjs`; Python fixtures with `python -m unittest discover -s scripts/video-worker -p '*_test.py'`; UI and Edge Function regression tests. Real media preparation verifies photo decoding, mixed-carousel item identity, audio availability and deterministic retry hashes.

## Concurrent media analysis

The updated worker sends bounded batches to `video-import-worker`. Each batch runs up to three selected frame analyses concurrently with one audio transcription, then commits one checkpoint. The 8–20 single-video frame selection and 20-image post budget are unchanged. Larger images/audio are split into smaller batches to respect the 4 MB request limit. Old workers can still use the sequential endpoints.

Partial failures save the successful contiguous frame prefix and completed audio before retrying. Frames after a failed frame may be analyzed again on retry; completed prefixes and audio are skipped. Finish still requires every selected frame and audio item. AI calls are unchanged on a successful run; concurrency can encounter rate limits sooner, so existing bounded retries remain active. The worker logs elapsed time for the media AI stage; live speedup has not been benchmarked.

Deploy `video-import-worker` and restart `npm run video-worker` to enable batching. No database migration is required. `npm run video-worker:test` includes concurrency and retry tests.
