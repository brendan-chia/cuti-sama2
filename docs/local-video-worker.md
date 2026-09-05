# Local full-video imports

In Explore, paste an Instagram Reel URL. The importer switches to full-video mode. For video posts using `/p/`, choose **Analyse a video's audio & every frame**. Alternatively select **Upload a video**. Caption/screenshot mode remains available for image posts and carousels.

The local worker downloads an available public video with yt-dlp, or downloads your private upload from Supabase Storage. Instagram sometimes refuses video access even when a caption is public. Use an upload in that case. The worker never collects Instagram credentials, reads browser cookies, or bypasses login requirements.

FFmpeg reads the primary video stream and extracts every frame using timestamp passthrough: no FPS sampling, scene filtering, frame deduplication or silent truncation. Frames are resized to fit 720×720 for the vision model. The complete primary audio track is converted to mono 16 kHz MP3 and sent to Whisper. Videos without audio are marked as having no audio. The current explicit limits are two minutes, 150 MB, 7,200 frames and 4K input resolution. Larger videos fail with an actionable message.

Each frame is submitted separately to Groq vision for visible text and tentative landmark identification. All frames are inspected even if they look identical. Repeated place observations are deduplicated after inspection; up to 120 distinct observations are retained. Audio, caption and frame evidence are combined into up to 12 place queries. At most 12 map candidates are shown, all requiring member confirmation. Visual matches are not guarantees of identity.

## Running on this computer

FFmpeg/ffprobe and the isolated yt-dlp environment have been installed/configured during implementation. A scoped worker token is stored in the ignored `.env.video-worker.local`; Groq and database-admin keys stay in Supabase.

```
npm run video-worker
```

Keep the process running. Ctrl+C stops it; a processing job becomes retryable and resumes from its saved frame checkpoint. If the process crashes, another worker can reclaim its job after three minutes. The app displays queued/offline state, audio status, frame counts, cancellation and retry. Reopen full-video mode to restore the latest import on another device. Only the importing member can see unconfirmed results.

The worker makes outbound HTTPS requests, so no public port, local server address or tunnel is needed. Local preparation does not mean offline AI: audio and frames still go to the configured Groq models. Every-frame analysis can generate thousands of API requests and incur provider charges. Rate-limit failures use bounded backoff; exhausted retries leave a resumable failed job.

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

Deploy migration `0022_local_video_imports.sql` and the `video-import`, `video-import-worker` and `import-trip-places` functions. Only `video-import-worker` disables gateway JWT verification; it requires the separate worker token on every request. The client-facing API authenticates membership and enforces the existing import quota. Private video storage allows uploads only via short-lived signed upload URLs.

## Retention and verification

Successful jobs delete the uploaded video and full transcript/frame observations. Local files are removed after each job attempt; checkpoints remain in the database, so retries re-download and verify the exact file hash before resuming. Cancellation deletes an uploaded file. Failed uploads/jobs remain available for retry or cancellation; there is no automatic time-based retention job yet. Full transcripts and unconfirmed evidence are not exposed to other members.

Verification includes a real FFmpeg test confirming all eight frames and audio from a two-second fixture, request/security tests for Instagram metadata, UI tests for video-mode selection and cancellation, and a rollback-only database test rejecting partial, cancelled or wrong-lease completion. A live synthetic-video import verified two of two frames, Whisper transcription, vision, map lookup and confirmation against the deployed backend; temporary test records were removed.
