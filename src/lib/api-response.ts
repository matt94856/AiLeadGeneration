import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json(
    { success: false, error: { message, code } },
    { status }
  );
}

export function handleApiError(error: unknown, context: string) {
  const message = error instanceof Error ? error.message : "Internal server error";
  logger.error(context, { error: message });
  return jsonError(message, 500, "INTERNAL_ERROR");
}
