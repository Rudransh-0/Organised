// src/lib/rate-limit.ts
// Deferred — proactive rate-limit tracking via Upstash Redis.
// V1 uses reactive fallback only (catch actual 429/errors from providers).
// The Server Action's ai-extraction.ts already handles this by catching
// provider errors and falling through to the next provider.
