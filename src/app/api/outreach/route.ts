import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getRecruiterProfile } from "@/lib/recruiter-profile";
import type { OutreachChannel } from "@/types";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`outreach:${ip}`, 30, 60_000);
    if (!limit.success) return jsonError("Rate limit exceeded", 429);

    const body = (await request.json()) as {
      physician_id: string;
      channel: OutreachChannel;
      opportunityNotes?: string;
    };

    if (!body.physician_id || !body.channel) {
      return jsonError("physician_id and channel are required");
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const container = getContainer(supabase);
    const physician = await container.physicians.findById(body.physician_id);
    if (!physician) return jsonError("Physician not found", 404);

    const draft = await container.openai.generateOutreachDraft({
      physician,
      channel: body.channel,
      opportunityNotes: body.opportunityNotes,
    });

    const saved = await container.outreach.create({
      physician_id: body.physician_id,
      channel: body.channel,
      subject: draft.subject,
      body: draft.body,
      created_by: user?.id,
      personalization_context: {
        opportunityNotes: body.opportunityNotes,
        recruiter: getRecruiterProfile(),
      },
    });

    await container.activities.create({
      physician_id: body.physician_id,
      user_id: user?.id,
      activity_type: "outreach_draft",
      title: `${body.channel} draft created — pending review`,
      description: "Human approval required before sending",
      metadata: { draft_id: saved.id },
      completed_at: new Date().toISOString(),
    });

    return jsonOk(saved);
  } catch (error) {
    return handleApiError(error, "POST /api/outreach");
  }
}
