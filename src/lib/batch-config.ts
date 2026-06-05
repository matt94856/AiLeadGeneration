/** Physicians scored per HTTP request (keeps under Vercel ~60s timeout). */
export const DEFAULT_BATCH_CHUNK = 12;

/** Email enrichment is slower (Serper + page fetch + OpenAI) — smaller chunks avoid 504s. */
export const EMAIL_BATCH_CHUNK = 4;

/** Wall-clock budget per serverless invocation (Vercel maxDuration is 60s). */
export const BATCH_TIME_BUDGET_MS = 52_000;

/** Max in-process chunks per invocation (safety cap). */
export const MAX_CONTINUATION_DEPTH = 50;

export const STALE_PROCESSING_MS = 15 * 60 * 1000;
