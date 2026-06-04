import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardMetrics } from "@/types";
import { TrendingUp, Users, Mail, MessageSquare } from "lucide-react";

interface Props {
  metrics: DashboardMetrics;
}

export function MetricsCards({ metrics }: Props) {
  const items = [
    { title: "New Physicians (30d)", value: metrics.newPhysiciansDiscovered, icon: Users },
    { title: "Leads Scored", value: metrics.leadsScored, icon: TrendingUp },
    { title: "Outreach Sent", value: metrics.outreachSent, icon: Mail },
    { title: "Responses", value: metrics.responsesReceived, icon: MessageSquare },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
