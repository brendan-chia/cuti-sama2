# Saved inspiration

Open **My profile & trips → Saved inspiration**. Save a public HTTPS social post URL into a named folder. Each account has up to 200 links. Sharing trackers are removed; saving the same URL updates its folder/caption instead of duplicating it. Search by place, summary or tag. Links and analyses are private and survive leaving the screen.

Saving triggers the `analyze-inspiration` Edge Function. It claims the row with a lease and uses `EdgeRuntime.waitUntil` to finish after returning HTTP 202. The screen refreshes status while open. Failed jobs can be retried; an interrupted worker becomes reclaimable after two minutes. Editing a caption clears its analysis and lease so an older worker cannot overwrite the new content. Removing a link also prevents the worker from recreating it.

The reader uses existing Instagram/TikTok public-caption extraction. For YouTube, Facebook, X/Twitter, Threads, Pinterest, Reddit and LinkedIn it attempts public HTML metadata with bounded reads, deadlines and no redirects. Other HTTPS social links can be stored but require a pasted caption or transcript for analysis. Private posts, login pages, shortened redirect links and posts without exposed text may need a caption. This feature does not download videos, transcribe audio, or analyze carousel images. The existing trip-specific video importer remains separate.

Analysis stores a title, summary, tags, planning notes, and explicitly named places with supporting evidence. It records the extracted source text and provider/model. These are post-derived suggestions, not verified addresses or current prices. From a trip’s Explore stage choose **Choose from my saved inspiration**, then run the existing place search and confirm the matching locations. Personal folder contents are not automatically shared with trip members.

## Provider configuration

Default: `INSPIRATION_LLM_PROVIDER=groq`, using the existing `GROQ_API_KEY` and `GROQ_STRUCTURED_OUTPUT_MODEL`.

Later, configure server secrets `INSPIRATION_LLM_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_INSPIRATION_MODEL` (the chosen Responses-compatible model). The OpenAI adapter uses `POST /v1/responses`, structured output with `text.format`, and `store:false`. There is no automatic fallback to another provider after an OpenAI failure. No provider secrets are exposed to the mobile/web app.

Official contract: https://developers.openai.com/api/docs/guides/structured-outputs

## Deployment and checks

Apply migration `0029_saved_inspiration.sql` and deploy `analyze-inspiration`. No OpenAI secret is required until switching providers. Database regressions: `supabase/tests/0018_saved_inspiration.sql`. URL/schema tests: `__tests__/inspiration.test.ts`. The OpenAI adapter is tested with mocked responses; a live OpenAI call requires the future key and model configuration.
