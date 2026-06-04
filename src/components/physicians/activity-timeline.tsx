import { format } from "date-fns";
import type { Activity } from "@/types";
import { Mail, Phone, StickyNote, Calendar } from "lucide-react";

const iconMap = {
  email: Mail,
  call: Phone,
  note: StickyNote,
  follow_up: Calendar,
} as const;

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (!activities.length) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-6">
      {activities.map((activity) => {
        const Icon = iconMap[activity.activity_type as keyof typeof iconMap] ?? StickyNote;
        return (
          <li key={activity.id} className="ml-6">
            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 ring-4 ring-background">
              <Icon className="h-3 w-3 text-primary" />
            </span>
            <p className="font-medium text-sm">{activity.title}</p>
            {activity.description && (
              <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
            )}
            <time className="text-xs text-muted-foreground">
              {format(new Date(activity.created_at), "MMM d, yyyy h:mm a")}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
