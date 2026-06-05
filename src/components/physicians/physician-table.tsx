import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LeadScoreBadge } from "@/components/physicians/lead-score-badge";
import { hasAiFoundEmail } from "@/lib/scoring-status";
import type { Physician } from "@/types";

export function PhysicianTable({ physicians }: { physicians: Physician[] }) {
  if (!physicians.length) {
    return <p className="text-muted-foreground text-sm py-8 text-center">No physicians found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left">
            <th className="p-3 font-medium">Name</th>
            <th className="p-3 font-medium hidden sm:table-cell">Location</th>
            <th className="p-3 font-medium hidden md:table-cell">Organization</th>
            <th className="p-3 font-medium hidden sm:table-cell">Email</th>
            <th className="p-3 font-medium">Score</th>
            <th className="p-3 font-medium hidden lg:table-cell">Status</th>
          </tr>
        </thead>
        <tbody>
          {physicians.map((p) => (
            <tr key={p.id} className="border-b hover:bg-muted/30">
              <td className="p-3">
                <Link href={`/physicians/${p.id}`} className="font-medium hover:underline">
                  Dr. {p.first_name} {p.last_name}
                </Link>
                <p className="text-xs text-muted-foreground">{p.subspecialty ?? p.specialty}</p>
              </td>
              <td className="p-3 hidden sm:table-cell text-muted-foreground">
                {p.city}, {p.state}
              </td>
              <td className="p-3 hidden md:table-cell text-muted-foreground truncate max-w-[200px]">
                {p.organization ?? "—"}
              </td>
              <td className="p-3 hidden sm:table-cell text-muted-foreground">
                {p.email ? (
                  <span className="flex flex-col gap-1">
                    <span className="truncate max-w-[180px]">{p.email}</span>
                    {hasAiFoundEmail(p) && (
                      <Badge variant="outline" className="w-fit text-[10px]">
                        AI found
                      </Badge>
                    )}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="p-3">
                <LeadScoreBadge physician={p} />
              </td>
              <td className="p-3 hidden lg:table-cell capitalize text-muted-foreground">
                {p.status.replace(/_/g, " ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
