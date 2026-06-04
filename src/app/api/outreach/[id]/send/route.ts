import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { GmailSmtpService } from "@/services/email/gmail.service";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import { getRecruiterProfile } from "@/lib/recruiter-profile";

/**
 * Approve email draft and send from configured Gmail (GMAIL_USER).
 * Requires physician.email on file.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: draftId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonError("Unauthorized", 401);

    const emailService = new GmailSmtpService();
    if (!emailService.isConfigured()) {
      return jsonError(
        "Gmail not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to Vercel environment variables. See docs/N8N_SETUP.md.",
        503
      );
    }

    const container = getContainer(supabase);
    const { data: draft, error: draftError } = await supabase
      .from("outreach_drafts")
      .select("*")
      .eq("id", draftId)
      .single();

    if (draftError || !draft) {
      return jsonError("Draft not found", 404);
    }

    if (draft.channel !== "email") {
      return jsonError("Only email drafts can be sent via Gmail. LinkedIn and voicemail are copy-only.", 400);
    }

    if (draft.status === "sent") {
      return jsonError("This email was already sent.", 400);
    }

    if (draft.status === "discarded") {
      return jsonError("This draft was discarded.", 400);
    }

    const physician = await container.physicians.findById(draft.physician_id);
    if (!physician) return jsonError("Physician not found", 404);

    const toEmail = physician.email?.trim();
    if (!toEmail) {
      return jsonError(
        "No email on file for this physician. Add their email on the profile, then try again.",
        400
      );
    }

    const recruiter = getRecruiterProfile();
    const subject =
      draft.subject?.trim() || `Locum cardiology opportunity — ${physician.state ?? "US"}`;

    if (draft.status === "draft") {
      await container.outreach.approve(draftId, user.id);
    }

    const sendResult = await emailService.send({
      to: toEmail,
      subject,
      body: draft.body,
      replyTo: recruiter.email,
    });

    const sent = await container.outreach.markSent(draftId);

    await container.physicians.update(draft.physician_id, {
      last_contacted_at: new Date().toISOString(),
      status:
        physician.status === "new_lead" || physician.status === "researching"
          ? "contacted"
          : physician.status,
    });

    await container.activities.create({
      physician_id: draft.physician_id,
      user_id: user.id,
      activity_type: "email",
      title: `Email sent to ${toEmail}`,
      description: `Subject: ${subject}`,
      metadata: { draft_id: draftId, message_id: sendResult.messageId },
      completed_at: new Date().toISOString(),
    });

    return jsonOk({ draft: sent, messageId: sendResult.messageId, sentTo: toEmail });
  } catch (error) {
    return handleApiError(error, "POST /api/outreach/[id]/send");
  }
}
