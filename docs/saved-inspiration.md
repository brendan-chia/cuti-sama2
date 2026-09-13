# Saved inspiration with OpenAI

Saved Instagram and TikTok posts now queue real media analysis through the local video worker: captions, sampled video frames, carousel photos and available audio. OpenAI reads the images and combines evidence; OpenAI Whisper transcribes audio with segment timestamps. The existing bounded downloader/FFmpeg pipeline supports posts up to its 120-second limit and samples at most 20 images/scenes. It does not inspect every video frame. Private or inaccessible posts can fail; no caption-only success is silently reported for a media job.

Other supported social URLs continue to use public metadata and supplied captions/transcripts through the direct OpenAI Responses API. Failed jobs remain saved and can be retried. Existing ready analyses remain unchanged; edit the caption to request a fresh analysis.

## API key and configuration

In the hosted Supabase project, open **Edge Functions → Secrets** and add:

```dotenv
OPENAI_API_KEY=your-openai-api-key
INSPIRATION_LLM_PROVIDER=openai
OPENAI_INSPIRATION_MODEL=gpt-4.1-mini
OPENAI_VISION_MODEL=gpt-4.1-mini
```

For local Edge Functions, put the same settings in **`supabase/.env.local`** (gitignored). The template is `supabase/functions/.env.example`. Never put the key in `EXPO_PUBLIC_*` or mobile code. The media worker only needs its existing worker token and project URL; API keys stay in Edge Function secrets. Audio uses `whisper-1` because this pipeline requires segment timestamps. No OpenRouter, Groq or ElevenLabs credentials are needed for the saved-reel media path. Other unrelated AI features retain their existing configuration. An explicit `INSPIRATION_LLM_PROVIDER=groq` still overrides caption-only analysis, so replace any old setting with `openai`.

## Deployment

Apply migration `0040_saved_inspiration_media.sql` after existing migrations, then deploy `analyze-inspiration`, `video-import-worker`, and `import-trip-places`. Deploy the updated app and restart the updated worker with `npm run video-worker`. Existing worker setup instructions still apply (`npm run video-worker:setup` for first-time setup). The worker must remain running for saved media jobs to finish. Without it, jobs stay queued. Configure the key before starting jobs.

For local functions: `supabase functions serve --env-file supabase/.env.local`.

## Using analyzed places in Wishlist

In Wishlist, choose **Choose from my saved inspiration**, select a ready analysis, and review its places while selecting countries. One saved idea is queued per user/trip; another selection replaces it. This queue survives navigation on the same device/browser. You can also use **Use these in a trip** from Saved inspiration before Wishlist.

When the destination reaches Explore, the queued places are prefilled. Choose **Find the places**, confirm the correct map matches, then select them on the map and submit your attraction choices/build the trip. The backend reads the owned saved analysis directly and searches all its places in the selected country without a second LLM extraction. Confirmed places become itinerary candidates. Personal analyses are not shared; only locations explicitly confirmed for the trip are shared.

## Checks and API references

`node --experimental-strip-types scripts/test-inspiration-ai.mjs` tests mocked OpenAI text, image and timestamped audio contracts. Run relevant Jest tests and `npm run video-worker:test` for the handoff and local media pipeline. Live OpenAI/media and hosted database validation require configured services.

Official contracts: [structured output](https://developers.openai.com/api/docs/guides/structured-outputs), [vision](https://developers.openai.com/api/docs/guides/images-vision), [audio transcription](https://developers.openai.com/api/docs/guides/speech-to-text).

## Concurrent media analysis

The updated worker sends bounded batches to `video-import-worker`. Each batch runs up to three selected frame analyses concurrently with one audio transcription, then commits one checkpoint. The 8–20 single-video frame selection and 20-image post budget are unchanged. Larger images/audio are split into smaller batches to respect the 4 MB request limit. Old workers can still use the sequential endpoints.

Partial failures save the successful contiguous frame prefix and completed audio before retrying. Frames after a failed frame may be analyzed again on retry; completed prefixes and audio are skipped. Finish still requires every selected frame and audio item. AI calls are unchanged on a successful run; concurrency can encounter rate limits sooner, so existing bounded retries remain active. The worker logs elapsed time for the media AI stage; live speedup has not been benchmarked.

Deploy `video-import-worker` and restart `npm run video-worker` to enable batching. No database migration is required. `npm run video-worker:test` includes concurrency and retry tests.
