/** Physicians scored per HTTP request (keeps under Vercel ~60s timeout). */
export const DEFAULT_BATCH_CHUNK = 12;

/** Email enrichment is slower (Serper + page fetch + OpenAI) — smaller chunks avoid 504s. */
export const EMAIL_BATCH_CHUNK = 4;

/** Max chained webhook calls per workflow trigger (12 × 50 = 600 physicians). */
export const MAX_CONTINUATION_DEPTH = 50;

export const STALE_PROCESSING_MS = 15 * 60 * 1000;
