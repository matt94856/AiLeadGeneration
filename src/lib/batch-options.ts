import { DEFAULT_BATCH_CHUNK, EMAIL_BATCH_CHUNK, PHONE_BATCH_CHUNK } from "@/lib/batch-config";

export interface WebhookBatchData extends Record<string, unknown> {
  limit?: number | string;
  today_only?: boolean;
  all_pending?: boolean;
  physician_ids?: string[];
  us_wide?: boolean;
  physician_id?: string;
  overwrite?: boolean;
  sync_sheets?: boolean;
  _continuation_depth?: number;
  source?: string;
  state?: string;
  city?: string;
  status?: string;
}

export function todayStartIso(): string {
  return new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";
}

export function resolveDiscoveredSince(data: WebhookBatchData): string | undefined {
  if (data.all_pending) return undefined;
  if (data.today_only) return todayStartIso();
  return undefined;
}

export function resolveChunkLimit(data: WebhookBatchData): number {
  const n = data.limit != null ? Number(data.limit) : DEFAULT_BATCH_CHUNK;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 25) : DEFAULT_BATCH_CHUNK;
}

export function resolveEmailChunkLimit(data: WebhookBatchData): number {
  const n = data.limit != null ? Number(data.limit) : EMAIL_BATCH_CHUNK;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 8) : EMAIL_BATCH_CHUNK;
}

export function resolvePhoneChunkLimit(data: WebhookBatchData): number {
  const n = data.limit != null ? Number(data.limit) : PHONE_BATCH_CHUNK;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : PHONE_BATCH_CHUNK;
}
