import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummykey");

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured, skipping email");
    return { id: "skipped" };
  }

  return resend.emails.send({
    from: "Code Sheriff <notifications@codesheriff.app>",
    to,
    subject,
    html,
  });
}
