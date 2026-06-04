import { createClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";

/** Creates profiles row if signup trigger did not (fallback after signUp). */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Not authenticated", 401);
    }

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existing) {
      return jsonOk({ created: false, profileId: user.id });
    }

    const fullName =
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Recruiter";

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? "",
      full_name: fullName,
      role: "recruiter",
    });

    if (insertError) {
      return jsonError(
        `Could not create profile: ${insertError.message}. Run Supabase migrations in SQL Editor.`,
        500
      );
    }

    return jsonOk({ created: true, profileId: user.id });
  } catch (error) {
    return handleApiError(error, "POST /api/auth/ensure-profile");
  }
}
