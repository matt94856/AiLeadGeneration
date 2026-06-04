import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Handles Supabase email confirmation and OAuth redirects.
 * Set email redirect / Site URL allow list to include: https://your-app.vercel.app/auth/callback
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error_description") ?? searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        if (!existing) {
          await supabase.from("profiles").insert({
            id: user.id,
            email: user.email ?? "",
            full_name:
              (user.user_metadata?.full_name as string | undefined) ??
              user.email?.split("@")[0] ??
              "Recruiter",
            role: "recruiter",
          });
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
