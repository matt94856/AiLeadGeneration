/** Physicians processed per HTTP request (keeps under Vercel ~60s timeout). */
export const DEFAULT_BATCH_CHUNK = 12;

/** Max chained webhook calls per workflow trigger (12 × 50 = 600 physicians). */
export const MAX_CONTINUATION_DEPTH = 50;

export const STALE_PROCESSING_MS = 15 * 60 * 1000;
