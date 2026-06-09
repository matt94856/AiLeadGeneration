import { logger } from "@/lib/logger";

export interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
}

export interface SerperSearchResult {
  organic: SerperOrganicResult[];
}

export interface ISerperService {
  isConfigured(): boolean;
  isCreditsExhausted(): boolean;
  search(query: string): Promise<SerperSearchResult>;
  searchMany(queries: string[]): Promise<SerperOrganicResult[]>;
}

export function isSerperCreditsError(status: number, body: string): boolean {
  if (status === 402) return true;
  const lower = body.toLowerCase();
  return (
    (status === 400 || status === 403 || status === 429) &&
    /credit|quota|balance|insufficient|billing|payment|limit exceeded|out of|not enough/.test(
      lower
    )
  );
}

/** Serper rejects empty, very long, or malformed queries with HTTP 400. */
export function sanitizeSerperQuery(query: string): string | null {
  let cleaned = query
    .replace(/[\u201c\u201d\u2018\u2019]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  cleaned = cleaned.replace(/"{2,}/g, '"');

  const quoteCount = (cleaned.match(/"/g) ?? []).length;
  if (quoteCount % 2 !== 0) {
    cleaned = cleaned.replace(/"/g, "");
  }

  cleaned = cleaned.replace(/\s+/g, " ").trim().slice(0, 240);
  if (cleaned.length < 3 || !/[a-zA-Z0-9]/.test(cleaned)) return null;
  return cleaned;
}

/** Strip characters that break quoted Google queries (employer/hospital names). */
export function cleanSearchTerm(value: string): string {
  return value
    .replace(/[\u201c\u201d\u2018\u2019"]/g, "")
    .replace(/[<>{}[\]\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function quotedSearchTerm(value: string): string {
  const clean = cleanSearchTerm(value);
  if (!clean) return "";
  return /\s/.test(clean) ? `"${clean}"` : clean;
}

export class SerperService implements ISerperService {
  private creditsExhausted = false;

  constructor(private readonly apiKey = process.env.SERPER_API_KEY) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  isCreditsExhausted(): boolean {
    return this.creditsExhausted;
  }

  async search(query: string): Promise<SerperSearchResult> {
    if (!this.apiKey || this.creditsExhausted) {
      return { organic: [] };
    }

    const q = sanitizeSerperQuery(query);
    if (!q) {
      return { organic: [] };
    }

    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q, num: 10 }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      if (isSerperCreditsError(response.status, body)) {
        this.creditsExhausted = true;
        logger.warn("Serper credits exhausted — switching to OpenAI public database fallback", {
          status: response.status,
          detail: body.slice(0, 200) || undefined,
        });
      } else {
        logger.warn("Serper search returned non-OK — using empty results", {
          status: response.status,
          query: q,
          detail: body.slice(0, 200) || undefined,
        });
      }
      return { organic: [] };
    }

    const data = (await response.json()) as { organic?: SerperOrganicResult[] };
    return { organic: data.organic ?? [] };
  }

  async searchMany(queries: string[]): Promise<SerperOrganicResult[]> {
    if (this.creditsExhausted) return [];

    const seen = new Set<string>();
    const merged: SerperOrganicResult[] = [];
    const uniqueQueries = [
      ...new Set(
        queries.map(sanitizeSerperQuery).filter((q): q is string => Boolean(q))
      ),
    ].slice(0, 3);

    const results = await Promise.allSettled(
      uniqueQueries.map((query) => this.search(query))
    );

    for (const [i, result] of results.entries()) {
      if (result.status === "rejected") {
        logger.warn("Serper query failed — continuing with other results", {
          query: uniqueQueries[i],
          error: result.reason instanceof Error ? result.reason.message : "unknown",
        });
        continue;
      }
      for (const row of result.value.organic) {
        if (seen.has(row.link)) continue;
        seen.add(row.link);
        merged.push(row);
      }
    }

    return merged;
  }
}
