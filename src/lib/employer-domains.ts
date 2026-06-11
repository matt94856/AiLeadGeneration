/** Administrative filler stripped when guessing domains — keep medical terms (often in the domain). */
const DOMAIN_STOP_WORDS = new Set([
  "the",
  "of",
  "at",
  "and",
  "for",
  "inc",
  "llc",
  "pa",
  "pc",
  "md",
  "pllc",
  "group",
  "associates",
  "association",
  "systems",
  "services",
  "service",
]);

/** Well-known employer name → primary web domain (lowercase, no www). */
const KNOWN_EMPLOYER_DOMAINS: Record<string, string> = {
  "mayo clinic": "mayoclinic.org",
  "cleveland clinic": "clevelandclinic.org",
  "johns hopkins": "hopkinsmedicine.org",
  "johns hopkins hospital": "hopkinsmedicine.org",
  "massachusetts general hospital": "massgeneral.org",
  "mgh": "massgeneral.org",
  "brigham and women's hospital": "brighamandwomens.org",
  "stanford health care": "stanfordhealthcare.org",
  "ucsf": "ucsfhealth.org",
  "ucla health": "uclahealth.org",
  "cedars-sinai": "cedars-sinai.org",
  "cedars sinai": "cedars-sinai.org",
  "nyu langone": "nyulangone.org",
  "mount sinai": "mountsinai.org",
  "northwestern medicine": "nm.org",
  "duke health": "dukehealth.org",
  "vanderbilt university medical center": "vumc.org",
  "emory healthcare": "emoryhealthcare.org",
  "baylor scott and white": "bswhealth.com",
  "henry ford health": "henryford.com",
  "intermountain health": "intermountainhealthcare.org",
  "providence": "providence.org",
  "ascension": "ascension.org",
  "hca healthcare": "hcahealthcare.com",
  "tenet healthcare": "tenethealth.com",
  "adventhealth": "adventhealth.com",
  "ochsner health": "ochsner.org",
  "atrium health": "atriumhealth.org",
  "corewell health": "corewellhealth.org",
  "spectrum health": "corewellhealth.org",
  "university of michigan": "umich.edu",
  "university of minnesota": "umn.edu",
  "university of wisconsin": "uwhealth.org",
  "university of washington": "uwmedicine.org",
  "university of colorado": "uchealth.org",
  "university of utah": "uofuhealth.org",
  "university of iowa": "uiowa.edu",
  "university of virginia": "uvahealth.com",
  "university of north carolina": "unchealth.org",
  "university of pittsburgh": "upmc.com",
  "university of pennsylvania": "pennmedicine.org",
  "university of chicago": "uchicagomedicine.org",
  "university of texas": "utswmed.org",
  "university of florida": "ufhealth.org",
  "university of alabama": "uab.edu",
  "university of kansas": "kumc.edu",
  "university of rochester": "urmc.rochester.edu",
  "university of maryland": "umm.edu",
  "university of cincinnati": "uchealth.com",
  "university of kentucky": "uky.edu",
  "university of mississippi": "umc.edu",
  "university of oklahoma": "ouhealth.com",
  "university of nebraska": "nebraskamed.com",
  "university of arkansas": "uams.edu",
  "university of tennessee": "utmedicalcenter.org",
  "university of vermont": "uvmhealth.org",
  "university of new mexico": "unmhealth.org",
  "university of arizona": "bannerhealth.com",
};

function normalizeOrgKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeOrg(value: string): string[] {
  return normalizeOrgKey(value)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !DOMAIN_STOP_WORDS.has(t));
}

function loadEnvEmployerDomains(): Record<string, string> {
  const raw = process.env.EMPLOYER_DOMAIN_MAP_JSON;
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [normalizeOrgKey(k), v.toLowerCase().replace(/^www\./, "")])
    );
  } catch {
    return {};
  }
}

const INVALID_ORG_NAMES = new Set([
  "unknown",
  "n/a",
  "na",
  "none",
  "null",
  "not available",
  "unspecified",
]);

/** Resolve a likely primary domain for a hospital, university, or practice name. */
export function resolveEmployerDomain(organization: string): string | null {
  const key = normalizeOrgKey(organization);
  if (!key || INVALID_ORG_NAMES.has(key)) return null;

  const envMap = loadEnvEmployerDomains();
  if (envMap[key]) return envMap[key];

  if (KNOWN_EMPLOYER_DOMAINS[key]) return KNOWN_EMPLOYER_DOMAINS[key];

  for (const [name, domain] of Object.entries(KNOWN_EMPLOYER_DOMAINS)) {
    if (key.includes(name) || name.includes(key)) return domain;
  }

  for (const [name, domain] of Object.entries(envMap)) {
    if (key.includes(name) || name.includes(key)) return domain;
  }

  const tokens = tokenizeOrg(organization);
  if (tokens.length === 0) return null;

  const joined = tokens.join("");
  if (joined.length < 3) return null;

  if (/university|college|school of medicine/i.test(organization)) {
    return `${joined}.edu`;
  }

  return `${joined}.org`;
}

/** Candidate domains for site:-scoped search (primary + heuristic alternates). */
export function inferEmployerDomains(organizations: string[]): string[] {
  const domains: string[] = [];

  for (const org of organizations) {
    if (!org?.trim()) continue;

    const primary = resolveEmployerDomain(org);
    if (primary) domains.push(primary);

    const tokens = tokenizeOrg(org);
    if (tokens.length >= 2) {
      const compact = tokens.join("");
      const first = tokens[0];
      const last = tokens[tokens.length - 1];
      if (compact.length >= 4) {
        domains.push(`${compact}.org`, `${compact}.com`);
        if (first && last) domains.push(`${first}${last}.org`);
      }
    } else if (tokens.length === 1) {
      const token = tokens[0];
      if (token && token.length >= 4) {
        domains.push(`${token}.org`, `${token}.com`);
      }
    }
  }

  return [...new Set(domains.map((d) => d.toLowerCase().replace(/^www\./, "")))].filter(
    (d) => d.includes(".") && !d.startsWith(".")
  );
}
