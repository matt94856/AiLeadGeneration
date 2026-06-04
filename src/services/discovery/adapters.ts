import type { DataSourceAdapter } from "@/services/types";
import type { CmsService } from "@/services/cms/cms.service";
import type { NpiService } from "@/services/npi/npi.service";
import type { NormalizedPhysicianInput } from "@/types";

export class NpiRegistryAdapter implements DataSourceAdapter {
  readonly sourceId = "npi_registry";

  constructor(private readonly npiService: NpiService) {}

  async collect(params: Record<string, string>): Promise<NormalizedPhysicianInput[]> {
    return this.npiService.searchCardiologists({
      state: params.state,
      city: params.city,
      limit: params.limit ? parseInt(params.limit, 10) : 50,
    });
  }
}

export class CmsPhysicianCompareAdapter implements DataSourceAdapter {
  readonly sourceId = "cms_physician_compare";

  constructor(private readonly cmsService: CmsService) {}

  async collect(params: Record<string, string>): Promise<NormalizedPhysicianInput[]> {
    return this.cmsService.searchPhysicians({
      state: params.state,
      limit: params.limit ? parseInt(params.limit, 10) : 50,
    });
  }
}

/**
 * State medical board — uses configurable public API URL per state.
 * Default returns empty; set STATE_BOARD_API_URL for integrations.
 */
export class StateMedicalBoardAdapter implements DataSourceAdapter {
  readonly sourceId = "state_medical_board";

  async collect(params: Record<string, string>): Promise<NormalizedPhysicianInput[]> {
    const baseUrl = process.env.STATE_BOARD_API_URL;
    if (!baseUrl) return [];

    const url = new URL(baseUrl);
    if (params.state) url.searchParams.set("state", params.state);
    if (params.specialty) url.searchParams.set("specialty", params.specialty ?? "cardiology");

    const response = await fetch(url.toString());
    if (!response.ok) return [];

    const data = (await response.json()) as {
      physicians?: NormalizedPhysicianInput[];
    };
    return (data.physicians ?? []).map((p) => ({
      ...p,
      source: this.sourceId,
    }));
  }
}

/**
 * Hospital directory — configurable JSON feed (many hospitals publish provider JSON).
 */
export class HospitalDirectoryAdapter implements DataSourceAdapter {
  readonly sourceId = "hospital_directory";

  async collect(params: Record<string, string>): Promise<NormalizedPhysicianInput[]> {
    const feedUrl = process.env.HOSPITAL_DIRECTORY_FEED_URL;
    if (!feedUrl) {
      return params.include_demo === "true" ? this.demoRecords() : [];
    }

    const response = await fetch(feedUrl);
    if (!response.ok) return [];

    const data = (await response.json()) as { providers?: NormalizedPhysicianInput[] };
    return (data.providers ?? [])
      .filter((p) => !params.state || p.state === params.state)
      .map((p) => ({ ...p, source: this.sourceId }));
  }

  private demoRecords(): NormalizedPhysicianInput[] {
    return [
      {
        first_name: "Anna",
        last_name: "Kowalski",
        specialty: "Cardiology",
        subspecialty: "Interventional Cardiology",
        city: "Miami",
        state: "FL",
        organization: "Miami Cardiac Hospital",
        source: this.sourceId,
      },
    ];
  }
}

/**
 * Group practice websites — parses configurable public JSON index (not HTML scraping).
 */
export class GroupPracticeAdapter implements DataSourceAdapter {
  readonly sourceId = "group_practice_website";

  async collect(params: Record<string, string>): Promise<NormalizedPhysicianInput[]> {
    const indexUrl = process.env.GROUP_PRACTICE_INDEX_URL;
    if (!indexUrl) return [];

    const response = await fetch(indexUrl);
    if (!response.ok) return [];

    const practices = (await response.json()) as {
      name: string;
      website?: string;
      physicians: NormalizedPhysicianInput[];
    }[];

    return practices.flatMap((practice) =>
      practice.physicians.map((p) => ({
        ...p,
        organization: p.organization ?? practice.name,
        website: p.website ?? practice.website,
        source: this.sourceId,
      }))
    ).filter((p) => !params.state || p.state === params.state);
  }
}
