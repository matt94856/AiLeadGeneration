import { htmlToText, isFetchableUrl } from "@/lib/email-extract";
import { logger } from "@/lib/logger";

export interface FetchedPage {
  url: string;
  text: string;
}

const MAX_PAGE_CHARS = 12_000;
const FETCH_TIMEOUT_MS = 5_000;

export async function fetchPageText(url: string): Promise<FetchedPage | null> {
  if (!isFetchableUrl(url)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "CardioLocumsBot/1.0 (public professional contact research)",
      },
      redirect: "follow",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return null;
    }

    const html = await response.text();
    const text = htmlToText(html).slice(0, MAX_PAGE_CHARS);
    if (!text) return null;

    return { url, text };
  } catch (error) {
    logger.warn("Page fetch failed", {
      url,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPages(urls: string[], maxPages = 3): Promise<FetchedPage[]> {
  const targets = urls.slice(0, maxPages);
  const pages = await Promise.all(targets.map((url) => fetchPageText(url)));
  return pages.filter((p): p is FetchedPage => p !== null);
}
