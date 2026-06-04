"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatSignupError(message: string, status?: number): string {
  if (status === 500 || message.toLowerCase().includes("database")) {
    return `${message} — This usually means Supabase migrations were not applied. In Supabase Dashboard → SQL Editor, run the files in supabase/migrations/ (especially 20250605000001_initial_schema.sql and 20250605000001_fix_signup_profile.sql).`;
  }
  return message;
}

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (authError) {
      const status = (authError as { status?: number }).status;
      setError(formatSignupError(authError.message, status));
      setLoading(false);
      return;
    }

    if (data.user && !data.session) {
      setInfo(
        "Account created. Check your email (and spam) for a confirmation link. Supabase may limit emails on the free tier. You can also disable “Confirm email” in Supabase → Authentication → Providers → Email, then sign in directly."
      );
      setLoading(false);
      return;
    }

    const profileRes = await fetch("/api/auth/ensure-profile", { method: "POST" });
    const profileJson = await profileRes.json();
    if (!profileJson.success) {
      setError(
        formatSignupError(
          profileJson.error?.message ??
            "Account created but profile setup failed. Apply Supabase migrations and try again."
        )
      );
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Start recruiting with CardioLocums AI</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 p-3">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-muted-foreground rounded-md border p-3 bg-muted/50">{info}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
