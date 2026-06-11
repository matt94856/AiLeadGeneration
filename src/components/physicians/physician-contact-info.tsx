import { Badge } from "@/components/ui/badge";
import {
  getPhoneConfidence,
  hasAiFoundEmail,
  hasProfileListedPhone,
} from "@/lib/scoring-status";
import type { Physician } from "@/types";

function phoneConfidenceLabel(confidence: string | null): string {
  if (confidence === "profile_listed") return "Profile listed";
  if (confidence === "practice") return "NPI practice";
  return "";
}

export function PhysicianContactInfo({ physician }: { physician: Physician }) {
  const phoneConfidence = getPhoneConfidence(physician);
  const phoneMeta = physician.research_metadata?.phone_enrichment as
    | { source_url?: string | null; manual_review_recommended?: boolean }
    | undefined;

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Contact info
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground w-14 shrink-0">Email</span>
        {physician.email ? (
          <>
            <a href={`mailto:${physician.email}`} className="text-primary hover:underline">
              {physician.email}
            </a>
            {hasAiFoundEmail(physician) && (
              <Badge variant="outline" className="text-[10px]">
                AI found
              </Badge>
            )}
          </>
        ) : (
          <span>—</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground w-14 shrink-0">Phone</span>
        {physician.phone ? (
          <>
            <a href={`tel:${physician.phone.replace(/\D/g, "")}`} className="text-primary hover:underline">
              {physician.phone}
            </a>
            {hasProfileListedPhone(physician) && (
              <Badge variant="outline" className="text-[10px]">
                Profile listed
              </Badge>
            )}
            {phoneConfidence === "practice" && !hasProfileListedPhone(physician) && (
              <Badge variant="outline" className="text-[10px]">
                NPI practice
              </Badge>
            )}
            {phoneMeta?.source_url && (
              <a
                href={phoneMeta.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:underline"
              >
                source
              </a>
            )}
          </>
        ) : (
          <span>—</span>
        )}
      </div>

      {phoneMeta?.manual_review_recommended && !physician.phone && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          High-score lead — try calling the NPI practice line manually.
        </p>
      )}

      {physician.phone && phoneConfidenceLabel(phoneConfidence) && (
        <p className="text-xs text-muted-foreground">
          Phone source: {phoneConfidenceLabel(phoneConfidence)}
        </p>
      )}
    </div>
  );
}
