import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isScoringPending } from "@/lib/scoring-status";
import type { Physician } from "@/types";

export function LeadScoreBadge({ physician }: { physician: Physician }) {
  if (isScoringPending(physician)) {
    return (
      <Badge variant="outline" className="gap-1.5 font-normal">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Scoring…
      </Badge>
    );
  }

  const score = physician.lead_score;
  const variant = score >= 70 ? "success" : score >= 50 ? "warning" : "secondary";

  return <Badge variant={variant}>{score}</Badge>;
}
