"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function getLoginErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
    return "Your email is not confirmed yet. Check your inbox and spam folder, or click “Resend confirmation email” below.";
  }
  if (lower.includes("invalid login credentials") || lower.includes("invalid")) {
    return "Invalid email or password. If you just signed up, confirm your email first (or ask your admin to disable email confirmation in Supabase).";
  }
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) {
      setError(decodeURIComponent(urlError));
    }
    if (searchParams.get("confirmed") === "1") {
      setInfo("Email confirmed. You can sign in now.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(getLoginErrorMessage(authError.message));
      setLoading(false);
      return;
    }

    await fetch("/api/auth/ensure-profile", { method: "POST" });

    router.push(searchParams.get("redirect") ?? "/dashboard");
    router.refresh();
  }

  async function resendConfirmation() {
    if (!email) {
      setError("Enter your email address first, then click resend.");
      return;
    }
    setResending(true);
    setError(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setResending(false);
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setInfo("Confirmation email sent. Check inbox and spam. Supabase free tier limits how many emails can be sent per hour.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>CardioLocums AI recruiter portal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
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
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            className="w-full mt-2"
            disabled={resending || !email}
            onClick={resendConfirmation}
          >
            {resending ? "Sending…" : "Resend confirmation email"}
          </Button>
          <p className="mt-4 text-sm text-center text-muted-foreground">
            No account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
