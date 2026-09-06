# Local social-video imports

In Explore, paste an Instagram or TikTok video URL and choose **Analyse Reel**. The interface accepts only a URL. Instagram `/reel/`, `/reels/`, `/p/` and `/tv/` video links, TikTok video links and TikTok short links all use one pipeline. Image-only posts, carousels, profiles and private videos are not supported by this video importer.

The local worker fetches metadata first and normalizes both providers to `SocialVideo`: platform, sourceUrl, postId, caption, title, author and nullable durationSeconds. It captures the caption before downloading the video. TikTok short-link redirects stay on allowed TikTok HTTPS hosts. yt-dlp uses curl-cffi for public request compatibility. Unknown duration is accepted until ffprobe can measure the downloaded video. No account credentials or browser cookies are used. Backend storage support remains only for compatibility with existing uploaded jobs.

FFmpeg detects scene changes locally. The selector combines frames just after strong cuts with temporal coverage, choosing 8–20 unique frames (fewer when the source contains fewer than eight frames). Only selected frames are resized to fit 720×720 and sent to vision for visible text/OCR and tentative landmarks. Whisper transcribes the complete primary audio track with segment start/end timestamps; no-speech segments are filtered. Silent videos continue with caption and visual evidence. Limits are two minutes, 150 MB and 4K input resolution.

Caption, timestamped audio and selected-scene observations are fused into up to 12 place queries. Photon/OpenStreetMap matches real records in the selected country; AI-generated coordinates are never accepted. At most 12 candidates are shown with addresses and evidence, all requiring confirmation. A map match is not proof that a tentative visual identification is correct. No Google Places key is required.

## Running on this computer

FFmpeg/ffprobe and the isolated yt-dlp environment have been installed/configured during implementation. A scoped worker token is stored in the ignored `.env.video-worker.local`; Groq and database-admin keys stay in Supabase.

```
npm run video-worker
```

Keep the process running. Ctrl+C stops it; a processing job becomes retryable and resumes from its saved scene checkpoint. If it crashes, a worker can reclaim the job after three minutes. The app displays queued/offline state, audio status, selected-scene counts, cancellation and retry. Only the importing member sees unconfirmed results. The manifest hash covers the media and chosen frame indexes/timestamps. Legacy unfinished every-frame jobs reset their incompatible checkpoints once; finished imports remain intact.

The worker makes outbound HTTPS requests, so no public port, local server address or tunnel is needed. Audio and selected frames go to the configured Groq models, with at most twenty vision calls per attempt. Rate-limit failures use bounded backoff; exhausted retries leave a resumable failed job.

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

Apply migrations through `0024_social_video_scenes.sql`, deploy `video-import` and `video-import-worker`, then restart the worker. Only `video-import-worker` disables gateway JWT verification; it requires its scoped token on every request. The public API authenticates membership and enforces the existing import quota. Raw jobs stay service-role-only.

## Retention and verification

Successful jobs delete any legacy uploaded video, full transcripts, transcript segments, metadata and scene observations. Local files are removed after each attempt; checkpoints remain for retry. Failed jobs retain evidence for retry/cancel and have no automatic expiration yet. Full transcripts and unconfirmed evidence are not exposed to other members.

Verification includes a real FFmpeg test confirming all eight frames and audio from a two-second fixture, request/security tests for Instagram metadata, UI tests for video-mode selection and cancellation, and a rollback-only database test rejecting partial, cancelled or wrong-lease completion. A live synthetic-video import verified two of two frames, Whisper transcription, vision, map lookup and confirmation against the deployed backend; temporary test records were removed.
