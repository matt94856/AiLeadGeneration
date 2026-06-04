import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeartPulse, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-8 w-8 text-primary" />
          <span className="font-bold text-xl">CardioLocums AI</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl">
          Find cardiologists ready for locum opportunities
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
          Discover leads from public data sources, enrich profiles with AI research,
          score opportunities, and draft compliant outreach — with human review at every step.
        </p>
        <Button size="lg" className="mt-8" asChild>
          <Link href="/dashboard">
            Open dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <p className="mt-12 text-xs text-muted-foreground max-w-xl">
          CardioLocums uses only public physician data. Personal emails are rarely available
          in public records — combine platform insights with recruiter research for best results.
        </p>
      </main>
    </div>
  );
}
