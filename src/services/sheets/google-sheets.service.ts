import { createSign } from "crypto";
import { logger } from "@/lib/logger";
import { phoneDigits } from "@/lib/phone-extract";
import type { PhysicianRepository } from "@/repositories/physician.repository";
import type { Physician } from "@/types";

const SHEET_HEADERS = [
  "First Name",
  "Last Name",
  "Full Name",
  "Phone",
  "Lead Score",
  "NPI",
  "City",
  "State",
  "Organization",
  "Confidence",
  "Source URL",
  "Updated At",
];

export interface PhysicianPhoneRow {
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  lead_score: number;
  npi: string;
  city: string;
  state: string;
  organization: string;
  confidence: string;
  source_url: string;
  updated_at: string;
}

interface SheetColumnMap {
  firstName: number;
  lastName: number;
  phone: number;
  leadScore: number;
  npi: number;
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export class GoogleSheetsService {
  constructor(
    private readonly spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    private readonly serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private readonly privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    private readonly sheetName = process.env.GOOGLE_SHEETS_TAB_NAME ?? "Physician Phones"
  ) {}

  isConfigured(): boolean {
    return Boolean(this.spreadsheetId && this.serviceAccountEmail && this.privateKey);
  }

  private async getAccessToken(): Promise<string> {
    if (!this.serviceAccountEmail || !this.privateKey) {
      throw new Error("Google Sheets service account is not configured");
    }

    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const now = Math.floor(Date.now() / 1000);
    const claim = base64Url(
      JSON.stringify({
        iss: this.serviceAccountEmail,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })
    );

    const unsigned = `${header}.${claim}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(this.privateKey);
    const jwt = `${unsigned}.${base64Url(signature)}`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google auth failed: ${response.status} ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  private physicianToRow(physician: Physician): PhysicianPhoneRow {
    const meta = physician.research_metadata?.phone_enrichment as
      | { confidence?: string; source_url?: string | null }
      | undefined;

    return {
      first_name: physician.first_name,
      last_name: physician.last_name,
      full_name: `Dr. ${physician.first_name} ${physician.last_name}`,
      phone: physician.phone ?? "",
      lead_score: physician.lead_score,
      npi: physician.npi ?? "",
      city: physician.city ?? "",
      state: physician.state ?? "",
      organization: physician.organization ?? "",
      confidence: meta?.confidence ?? "practice",
      source_url: meta?.source_url ?? "",
      updated_at: physician.updated_at,
    };
  }

  private rowValues(row: PhysicianPhoneRow): string[] {
    return [
      row.first_name,
      row.last_name,
      row.full_name,
      row.phone,
      String(row.lead_score),
      row.npi,
      row.city,
      row.state,
      row.organization,
      row.confidence,
      row.source_url,
      row.updated_at,
    ];
  }

  async ensureHeaders(): Promise<void> {
    if (!this.spreadsheetId) return;

    const token = await this.getAccessToken();
    const range = encodeURIComponent(`${this.sheetName}!A1:L1`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${range}`;

    const existing = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (existing.ok) {
      const data = (await existing.json()) as { values?: string[][] };
      if (data.values?.[0]?.length) return;
    }

    await this.appendRows([SHEET_HEADERS]);
  }

  private async readSheetValues(range: string): Promise<string[][]> {
    if (!this.spreadsheetId) return [];

    const token = await this.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${encodeURIComponent(range)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as { values?: string[][] };
    return data.values ?? [];
  }

  private resolveColumnMap(headerRow: string[]): SheetColumnMap {
    const headers = headerRow.map((h) => h.trim().toLowerCase());
    const indexOf = (...labels: string[]) => {
      for (const label of labels) {
        const idx = headers.indexOf(label);
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const firstName = indexOf("first name");
    const lastName = indexOf("last name");
    const phone = indexOf("phone");
    let leadScore = indexOf("lead score");
    let npi = indexOf("npi");

    if (leadScore < 0) leadScore = 4;
    if (npi < 0) npi = leadScore === 4 ? 5 : 4;

    return {
      firstName: firstName >= 0 ? firstName : 0,
      lastName: lastName >= 0 ? lastName : 1,
      phone: phone >= 0 ? phone : 3,
      leadScore,
      npi,
    };
  }

  private columnLetter(index: number): string {
    let n = index;
    let letters = "";
    do {
      letters = String.fromCharCode((n % 26) + 65) + letters;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return letters;
  }

  private async batchUpdateRanges(updates: { range: string; values: string[][] }[]): Promise<void> {
    if (!this.spreadsheetId || updates.length === 0) return;

    const token = await this.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values:batchUpdate`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: updates,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google Sheets batch update failed: ${response.status} ${body.slice(0, 300)}`);
    }
  }

  private buildPhysicianLookup(physicians: Physician[]): {
    byNpi: Map<string, Physician>;
    byPhone: Map<string, Physician>;
    byName: Map<string, Physician>;
  } {
    const byNpi = new Map<string, Physician>();
    const byPhone = new Map<string, Physician>();
    const byName = new Map<string, Physician>();

    for (const physician of physicians) {
      if (physician.npi) byNpi.set(physician.npi.replace(/\D/g, ""), physician);
      if (physician.phone) byPhone.set(phoneDigits(physician.phone), physician);
      const nameKey = `${physician.first_name} ${physician.last_name}`
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      byName.set(nameKey, physician);
    }

    return { byNpi, byPhone, byName };
  }

  private matchPhysician(
    row: string[],
    columns: SheetColumnMap,
    lookup: ReturnType<GoogleSheetsService["buildPhysicianLookup"]>
  ): Physician | null {
    const npi = (row[columns.npi] ?? "").replace(/\D/g, "");
    if (npi.length === 10) {
      const hit = lookup.byNpi.get(npi);
      if (hit) return hit;
    }

    const phone = row[columns.phone] ?? "";
    if (phone) {
      const hit = lookup.byPhone.get(phoneDigits(phone));
      if (hit) return hit;
    }

    const first = (row[columns.firstName] ?? "").trim();
    const last = (row[columns.lastName] ?? "").trim();
    if (first && last) {
      const hit = lookup.byName.get(`${first} ${last}`.toLowerCase());
      if (hit) return hit;
    }

    return null;
  }

  /**
   * Updates Lead Score (column E by default) for rows already in the sheet.
   * Matches rows to Supabase physicians by NPI, phone, or first+last name.
   */
  async backfillLeadScores(physicianRepo: PhysicianRepository): Promise<{
    total_rows: number;
    updated: number;
    unmatched: number;
  }> {
    if (!this.isConfigured()) {
      throw new Error("Google Sheets is not configured");
    }

    const values = await this.readSheetValues(`${this.sheetName}!A:L`);
    if (values.length < 2) {
      return { total_rows: 0, updated: 0, unmatched: 0 };
    }

    const columns = this.resolveColumnMap(values[0] ?? []);
    const physicians = await physicianRepo.listWithPhone(5000);
    const lookup = this.buildPhysicianLookup(physicians);

    const scoreColumn = this.columnLetter(columns.leadScore);
    const updates: { range: string; values: string[][] }[] = [];
    let updated = 0;
    let unmatched = 0;

    for (let i = 1; i < values.length; i++) {
      const row = values[i] ?? [];
      const physician = this.matchPhysician(row, columns, lookup);
      const rowNumber = i + 1;

      if (!physician) {
        unmatched++;
        continue;
      }

      const currentScore = (row[columns.leadScore] ?? "").trim();
      const nextScore = String(physician.lead_score);
      if (currentScore === nextScore) continue;

      updates.push({
        range: `${this.sheetName}!${scoreColumn}${rowNumber}`,
        values: [[nextScore]],
      });
      updated++;
    }

    await this.batchUpdateRanges(updates);

    logger.info("Backfilled lead scores in Google Sheets", {
      updated,
      unmatched,
      total_rows: values.length - 1,
    });

    return {
      total_rows: values.length - 1,
      updated,
      unmatched,
    };
  }

  async appendRows(rows: string[][]): Promise<void> {
    if (!this.spreadsheetId) {
      throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured");
    }

    const token = await this.getAccessToken();
    const range = encodeURIComponent(`${this.sheetName}!A:L`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rows }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google Sheets append failed: ${response.status} ${body.slice(0, 300)}`);
    }
  }

  async syncPhysicians(physicians: Physician[]): Promise<number> {
    if (!this.isConfigured() || physicians.length === 0) return 0;

    await this.ensureHeaders();
    const rows = physicians.map((p) => this.rowValues(this.physicianToRow(p)));
    await this.appendRows(rows);
    return physicians.length;
  }

  async syncUnsyncedPhysicians(physicianRepo: PhysicianRepository): Promise<number> {
    if (!this.isConfigured()) return 0;

    const unsynced = await physicianRepo.listUnsyncedPhoneSheetRows(200);
    if (!unsynced.length) return 0;

    try {
      const count = await this.syncPhysicians(unsynced);
      const syncedAt = new Date().toISOString();

      for (const physician of unsynced) {
        await physicianRepo.markPhoneSheetSynced(physician.id, physician.phone!, syncedAt);
      }

      logger.info("Synced physician phones to Google Sheets", { count });
      return count;
    } catch (error) {
      logger.error("Google Sheets sync failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return 0;
    }
  }
}
