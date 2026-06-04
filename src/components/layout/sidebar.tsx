"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Kanban,
  Search,
  Sparkles,
  Settings,
  HeartPulse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/physicians", label: "Physicians", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/search", label: "Search", icon: Search },
  { href: "/discovery", label: "Discovery", icon: Sparkles },
  { href: "/admin/scoring", label: "Scoring", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card/50">
      <div className="flex items-center gap-2 border-b px-4 py-5">
        <HeartPulse className="h-7 w-7 text-primary" />
        <div>
          <p className="font-semibold leading-tight">CardioLocums</p>
          <p className="text-xs text-muted-foreground">AI Recruiting</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3 flex items-center justify-between">
        <ThemeToggle />
      </div>
    </aside>
  );
}
