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
  search(query: string): Promise<SerperSearchResult>;
  searchMany(queries: string[]): Promise<SerperOrganicResult[]>;
}

export class SerperService implements ISerperService {
  constructor(private readonly apiKey = process.env.SERPER_API_KEY) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string): Promise<SerperSearchResult> {
    if (!this.apiKey) {
      return { organic: [] };
    }

    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 10 }),
    });

    if (!response.ok) {
      throw new Error(`Serper search failed: ${response.status}`);
    }

    const data = (await response.json()) as { organic?: SerperOrganicResult[] };
    return { organic: data.organic ?? [] };
  }

  async searchMany(queries: string[]): Promise<SerperOrganicResult[]> {
    const seen = new Set<string>();
    const merged: SerperOrganicResult[] = [];
    const uniqueQueries = [...new Set(queries)].slice(0, 4);

    const results = await Promise.all(uniqueQueries.map((query) => this.search(query)));
    for (const result of results) {
      for (const row of result.organic) {
        if (seen.has(row.link)) continue;
        seen.add(row.link);
        merged.push(row);
      }
    }

    return merged;
  }
}
