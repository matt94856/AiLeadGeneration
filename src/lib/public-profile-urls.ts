import { isFetchableUrl } from "@/lib/email-extract";
import { inferEmployerDomains } from "@/lib/employer-domains";

interface PublicProfileInput {
  npi?: string | null;
  website?: string | null;
  organization?: string | null;
  state?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  hospital_affiliations?: string[];
}

/** Common hospital / academic directory paths (appended to guessed employer domains). */
const EMPLOYER_DIRECTORY_PATHS = [
  "/find-a-doctor",
  "/findadoctor",
  "/find-a-physician",
  "/providers",
  "/physicians",
  "/doctors",
  "/our-doctors",
  "/our-physicians",
  "/physician-search",
  "/provider-search",
  "/search-providers",
  "/faculty",
  "/team",
  "/directory",
  "/medical-staff",
];

const FREE_SOURCE_HOST_HINTS = ["npiregistry.cms.hhs.gov", "cms.hhs.gov"];

export type EmailDiscoveryMethod =
  | "free_sources"
  | "serper_site_scoped"
  | "serper"
  | "openai_public"
  | "openai_web_search";

/** Deterministic public listings (no Serper) — NPI registry, known website. */
export function buildKnownPublicProfileUrls(input: PublicProfileInput): string[] {
  const urls: string[] = [];

  if (input.website?.trim() && isFetchableUrl(input.website.trim())) {
    urls.push(input.website.trim());
  }

  const npi = input.npi?.replace(/\D/g, "");
  if (npi && npi.length === 10) {
    urls.push(`https://npiregistry.cms.hhs.gov/provider-view/${npi}`);
  }

  return [...new Set(urls)];
}

/** Build likely hospital / employer directory URLs without any search API. */
export function buildEmployerDirectoryUrls(input: PublicProfileInput): string[] {
  const orgs = [
    input.organization,
    ...(input.hospital_affiliations ?? []),
  ].filter((v): v is string => Boolean(v?.trim()));

  const domains = inferEmployerDomains(orgs);
  const urls: string[] = [];

  for (const domain of domains.slice(0, 4)) {
    for (const path of EMPLOYER_DIRECTORY_PATHS) {
      urls.push(`https://www.${domain}${path}`);
      urls.push(`https://${domain}${path}`);
    }
  }

  return [...new Set(urls)];
}

/**
 * Optional state medical board public lookup page.
 * Set STATE_BOARD_LICENSE_LOOKUP_URL with placeholders: {state}, {first_name}, {last_name}
 */
export function buildStateBoardLookupUrl(input: PublicProfileInput): string | null {
  const template = process.env.STATE_BOARD_LICENSE_LOOKUP_URL;
  if (!template?.trim()) return null;
  if (!input.first_name?.trim() || !input.last_name?.trim()) return null;

  const url = template
    .replace(/\{state\}/gi, encodeURIComponent(input.state?.trim() ?? ""))
    .replace(/\{first_name\}/gi, encodeURIComponent(input.first_name.trim()))
    .replace(/\{last_name\}/gi, encodeURIComponent(input.last_name.trim()));

  return isFetchableUrl(url) ? url : null;
}

/** All zero-cost seed URLs before Serper or paid OpenAI discovery. */
export function buildFreeProfileSeedUrls(input: PublicProfileInput): string[] {
  const urls = [
    ...buildKnownPublicProfileUrls(input),
    ...buildEmployerDirectoryUrls(input),
  ];

  const stateBoard = buildStateBoardLookupUrl(input);
  if (stateBoard) urls.push(stateBoard);

  return [...new Set(urls)];
}

export function filterFetchableUrls(urls: string[], max = 6): string[] {
  const unique: string[] = [];
  for (const raw of urls) {
    const url = raw.trim();
    if (!url || !isFetchableUrl(url)) continue;
    if (!url.startsWith("http://") && !url.startsWith("https://")) continue;
    const lower = url.toLowerCase();
    if (lower.includes("linkedin.com") || lower.includes("facebook.com")) continue;
    if (!unique.includes(url)) unique.push(url);
    if (unique.length >= max) break;
  }
  return unique;
}

/**
 * Select pages to fetch: always keep NPI + physician website, then ranked employer/directory URLs.
 */
export function selectProfileUrlsToFetch(seedUrls: string[], max = 6): string[] {
  const priority: string[] = [];
  const rest: string[] = [];

  for (const url of seedUrls) {
    const lower = url.toLowerCase();
    const isPriority =
      FREE_SOURCE_HOST_HINTS.some((h) => lower.includes(h)) ||
      (!lower.includes("/find-a-doctor") &&
        !lower.includes("/providers") &&
        !lower.includes("/physicians") &&
        !lower.includes("/doctors") &&
        !lower.includes("/faculty") &&
        !lower.includes("/directory") &&
        !lower.includes("/team") &&
        !lower.includes("/search") &&
        !lower.includes("/provider"));

    if (isPriority && !priority.includes(url)) priority.push(url);
    else if (!rest.includes(url)) rest.push(url);
  }

  const rankedRest = rankDirectoryUrls(rest, max);
  return [...new Set([...priority, ...rankedRest])].slice(0, max);
}

function rankDirectoryUrls(links: string[], max: number): string[] {
  const directoryHints = [
    "find-a-doctor",
    "findadoctor",
    "providers",
    "physicians",
    "faculty",
    "provider",
    "physician",
    "doctor",
    ".edu",
    "health",
    "hospital",
    "medical",
    "clinic",
  ];

  return links
    .filter(isFetchableUrl)
    .map((link) => {
      const lower = link.toLowerCase();
      let score = 0;
      for (const hint of directoryHints) {
        if (lower.includes(hint)) score += 1;
      }
      return { link, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.link)
    .slice(0, max);
}
