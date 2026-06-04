export interface RecruiterProfile {
  fullName: string;
  email: string;
  phone: string;
  title: string;
  website: string;
}

/** Recruiter identity for outreach drafts — override via environment variables on Vercel. */
export function getRecruiterProfile(): RecruiterProfile {
  const website = process.env.RECRUITER_WEBSITE ?? "locumcareerhub.com";
  return {
    fullName: process.env.RECRUITER_FULL_NAME ?? "Matthew Fuller",
    email: process.env.RECRUITER_EMAIL ?? "matthewfuller389@gmail.com",
    phone: process.env.RECRUITER_PHONE ?? "3522936242",
    title:
      process.env.RECRUITER_TITLE ??
      "Locum tenens recruiter for cardiologists",
    website: website.startsWith("http") ? website : `https://${website}`,
  };
}

export function formatRecruiterPromptBlock(profile: RecruiterProfile): string {
  return `RECRUITER (use these exact details in signatures and voicemail — never placeholders like [Your Name]):
- Name: ${profile.fullName}
- Email: ${profile.email}
- Phone: ${profile.phone}
- Role: ${profile.title}
- Website: ${profile.website}`;
}

export function getOutreachPlaceholderRules(profile: RecruiterProfile): string {
  return `Rules:
- Sign emails as ${profile.fullName} with email ${profile.email}, phone ${profile.phone}, and website ${profile.website}.
- Voicemails must state the recruiter's full name (${profile.fullName}) and callback number (${profile.phone}).
- LinkedIn messages may reference Locum Career Hub / ${profile.website} when natural.
- NEVER output bracketed placeholders such as [Your Name], [Agency Name], [phone], or [Agency].`;
}
