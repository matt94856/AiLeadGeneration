import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env optional when vars are already set
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_NPI = "TEST9999001";

const physician = {
  npi: TEST_NPI,
  first_name: "Matthew",
  last_name: "TestPhysician",
  specialty: "Cardiology",
  subspecialty: "Interventional Cardiology",
  city: "Tampa",
  state: "FL",
  organization: "Bay Heart Institute",
  years_in_practice: 14,
  email: "mattf94856@gmail.com",
  phone: null,
  source: "manual_test",
  lead_score: 78,
  status: "qualified",
  physician_summary:
    "Interventional cardiologist in Tampa with academic hospital affiliations. Active in regional TAVR programs. Prior locums experience noted.",
  research_metadata: { scoring_status: "complete", scored_at: new Date().toISOString() },
  scoring_factors: {
    prior_locums_indicators: true,
    active_publications: true,
    conference_participation: true,
  },
};

const { data: existing } = await supabase
  .from("physicians")
  .select("id")
  .eq("npi", TEST_NPI)
  .maybeSingle();

let physicianId = existing?.id;

if (physicianId) {
  const { data, error } = await supabase
    .from("physicians")
    .update({ ...physician, updated_at: new Date().toISOString() })
    .eq("id", physicianId)
    .select("id")
    .single();
  if (error) throw error;
  physicianId = data.id;
  console.log("Updated existing test physician:", physicianId);
} else {
  const { data, error } = await supabase
    .from("physicians")
    .insert(physician)
    .select("id")
    .single();
  if (error) throw error;
  physicianId = data.id;
  console.log("Created test physician:", physicianId);
}

const { error: researchError } = await supabase.from("physician_research").upsert(
  {
    physician_id: physicianId,
    current_employer: "Bay Heart Institute",
    practice_size: "Large (50+)",
    hospital_affiliations: ["Tampa General Hospital", "Regional Medical Center"],
    publications: [{ title: "Outcomes in structural heart interventions", year: 2024 }],
    conference_participation: [
      { name: "ACC Annual Scientific Session", year: 2024, role: "Speaker" },
    ],
    researched_at: new Date().toISOString(),
  },
  { onConflict: "physician_id" }
);

if (researchError) throw researchError;

console.log("Email:", physician.email);
console.log("Profile: /physicians/" + physicianId);
console.log("Search: Physicians page — filter or search 'TestPhysician'");
