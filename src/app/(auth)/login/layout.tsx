import { Suspense } from "react";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="p-8 text-muted-foreground">Loading…</p>}>{children}</Suspense>;
}
