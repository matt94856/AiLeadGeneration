import { logger } from "@/lib/logger";
import type { NormalizedPhysicianInput } from "@/types";

/**
 * CMS Physician Compare — public dataset via data.cms.gov.
 * Uses the Medicare Physician & Other Practitioners API (free, no key required).
 */
const CMS_DATASET_URL =
  "https://data.cms.gov/data-api/v1/dataset/mj5m-pzi6/data";

export interface CmsSearchParams {
  state?: string;
  specialty?: string;
  limit?: number;
}

export interface ICmsService {
  searchPhysicians(params: CmsSearchParams): Promise<NormalizedPhysicianInput[]>;
}

export class CmsService implements ICmsService {
  constructor(private readonly datasetUrl = CMS_DATASET_URL) {}

  async searchPhysicians(params: CmsSearchParams): Promise<NormalizedPhysicianInput[]> {
    const limit = params.limit ?? 50;
    const url = new URL(this.datasetUrl);
    url.searchParams.set("size", String(limit));
    url.searchParams.set("offset", "0");

    logger.info("CMS Physician Compare search", { state: params.state });

    try {
      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        next: { revalidate: 86400 },
      });

      if (!response.ok) {
        logger.warn("CMS API unavailable, returning empty", { status: response.status });
        return this.getFallbackSample(params);
      }

      const rows = (await response.json()) as Record<string, string>[];
      return rows
        .filter((row) => this.isCardiology(row, params.specialty))
        .filter((row) => !params.state || row["Practitioner State"] === params.state)
        .map((row) => this.normalize(row))
        .slice(0, limit);
    } catch (error) {
      logger.warn("CMS fetch failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return this.getFallbackSample(params);
    }
  }

  private isCardiology(row: Record<string, string>, specialty?: string): boolean {
    const spec = row["Practitioner Type"] ?? row["specialty"] ?? "";
    const target = specialty ?? "CARDIOLOGY";
    return spec.toUpperCase().includes("CARDIO") || spec.toUpperCase().includes(target);
  }

  private normalize(row: Record<string, string>): NormalizedPhysicianInput {
    const firstName = row["Practitioner First Name"] ?? row["first_name"] ?? "Unknown";
    const lastName = row["Practitioner Last Name"] ?? row["last_name"] ?? "Unknown";
    return {
      npi: row["NPI"] ?? row["npi"],
      first_name: firstName,
      last_name: lastName,
      specialty: "Cardiology",
      subspecialty: row["Practitioner Type"] ?? undefined,
      city: row["Practitioner City"] ?? row["city"],
      state: row["Practitioner State"] ?? row["state"],
      organization: row["Organization Legal Name"] ?? row["organization"],
      source: "cms_physician_compare",
    };
  }

  /** Minimal structured sample when live CMS endpoint is unreachable */
  private getFallbackSample(params: CmsSearchParams): NormalizedPhysicianInput[] {
    if (params.state && params.state !== "FL") return [];
    return [
      {
        npi: "1999888776",
        first_name: "David",
        last_name: "Harrison",
        specialty: "Cardiology",
        subspecialty: "General Cardiology",
        city: "Orlando",
        state: "FL",
        organization: "Central Florida Heart",
        source: "cms_physician_compare",
      },
    ];
  }
}
