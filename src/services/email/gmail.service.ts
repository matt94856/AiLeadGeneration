import nodemailer from "nodemailer";
import type { SendEmailInput, SendEmailResult, IEmailService } from "@/services/email/types";
import { getRecruiterProfile } from "@/lib/recruiter-profile";
import { logger } from "@/lib/logger";

/**
 * Sends email via Gmail SMTP using a Google App Password.
 * https://support.google.com/accounts/answer/185833
 */
export class GmailSmtpService implements IEmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly user = process.env.GMAIL_USER,
    private readonly appPassword = process.env.GMAIL_APP_PASSWORD
  ) {}

  isConfigured(): boolean {
    return Boolean(this.user && this.appPassword);
  }

  private getTransporter(): nodemailer.Transporter {
    if (!this.isConfigured()) {
      throw new Error(
        "Gmail is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in environment variables."
      );
    }
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: this.user,
          pass: this.appPassword,
        },
      });
    }
    return this.transporter;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const recruiter = getRecruiterProfile();
    const fromName = process.env.EMAIL_FROM_NAME ?? recruiter.fullName;
    const from = `"${fromName}" <${this.user}>`;

    const info = await this.getTransporter().sendMail({
      from,
      to: input.to,
      replyTo: input.replyTo ?? recruiter.email,
      subject: input.subject,
      text: input.body,
      html: input.body.replace(/\n/g, "<br>"),
    });

    logger.info("Email sent", { to: input.to, messageId: info.messageId });
    return { messageId: info.messageId ?? "unknown" };
  }
}
