import { logger } from "@/lib/logger";
import { filterValidPhysicianRecords } from "@/lib/physician-validation";
import type { NpiSearchParams } from "@/services/types";
import type { NormalizedPhysicianInput } from "@/types";

const NPI_API_BASE = "https://npiregistry.cms.hhs.gov/api";

export interface NpiSearchResponse {
  results: NormalizedPhysicianInput[];
  result_count: number;
}

interface NpiApiResult {
  result_count: number;
  results?: NpiProvider[];
}

interface NpiProvider {
  number: string;
  enumeration_type?: string;
  basic: {
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    credential?: string;
    enumeration_date?: string;
  };
  taxonomies: { desc: string; primary: boolean }[];
  addresses: {
    city: string;
    state: string;
    address_purpose: string;
    telephone_number?: string;
  }[];
}

export interface INpiService {
  searchCardiologists(params: NpiSearchParams): Promise<NpiSearchResponse>;
  lookupByNumber(npi: string): Promise<NormalizedPhysicianInput | null>;
}

export class NpiService implements INpiService {
  constructor(private readonly baseUrl = NPI_API_BASE) {}

  async searchCardiologists(params: NpiSearchParams): Promise<NpiSearchResponse> {
    const query = new URLSearchParams({
      version: "2.1",
      taxonomy_description: params.taxonomy_description ?? "Cardiovascular Disease",
      limit: String(params.limit ?? 50),
    });

    if (params.state) query.set("state", params.state);
    if (params.city) query.set("city", params.city);
    if (params.first_name) query.set("first_name", params.first_name);
    if (params.last_name) query.set("last_name", params.last_name);
    if (params.skip != null) query.set("skip", String(params.skip));

    const url = `${this.baseUrl}/?${query.toString()}`;
    logger.info("NPI Registry search", { url: this.baseUrl, state: params.state, skip: params.skip });

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`NPI Registry API error: ${response.status}`);
    }

    const data = (await response.json()) as NpiApiResult;
    const normalized = (data.results ?? [])
      .filter(
        (r) =>
          r.enumeration_type !== "NPI-2" &&
          Boolean(r.basic?.first_name?.trim()) &&
          Boolean(r.basic?.last_name?.trim())
      )
      .map((r) => this.normalize(r));

    return {
      results: filterValidPhysicianRecords(normalized),
      result_count: data.result_count ?? normalized.length,
    };
  }

  async lookupByNumber(npi: string): Promise<NormalizedPhysicianInput | null> {
    const query = new URLSearchParams({
      version: "2.1",
      number: npi,
    });

    const response = await fetch(`${this.baseUrl}/?${query.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`NPI Registry lookup error: ${response.status}`);
    }

    const data = (await response.json()) as NpiApiResult;
    const provider = data.results?.[0];
    if (!provider) return null;

    const [record] = filterValidPhysicianRecords([this.normalize(provider)]);
    return record ?? null;
  }

  private normalize(provider: NpiProvider): NormalizedPhysicianInput {
    const first_name = provider.basic.first_name?.trim() ?? "";
    const last_name = provider.basic.last_name?.trim() ?? "";
    const primaryTaxonomy =
      provider.taxonomies.find((t) => t.primary)?.desc ??
      provider.taxonomies[0]?.desc;
    const practiceAddress =
      provider.addresses.find((a) => a.address_purpose === "LOCATION") ??
      provider.addresses[0];

    const enumYear = provider.basic.enumeration_date
      ? parseInt(provider.basic.enumeration_date.slice(0, 4), 10)
      : undefined;
    const yearsInPractice = enumYear
      ? Math.max(0, new Date().getFullYear() - enumYear)
      : undefined;

    return {
      npi: provider.number,
      first_name,
      last_name,
      specialty: "Cardiology",
      subspecialty: primaryTaxonomy ?? undefined,
      city: practiceAddress?.city,
      state: practiceAddress?.state,
      phone: practiceAddress?.telephone_number,
      source: "npi_registry",
      years_in_practice: yearsInPractice,
    };
  }
}
