import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
              <td className="p-3">
                <Badge variant={p.lead_score >= 70 ? "success" : p.lead_score >= 50 ? "warning" : "secondary"}>
                  {p.lead_score}
                </Badge>
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
