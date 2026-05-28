export interface EmailAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailSendResult {
  provider: string;
  messageId?: string;
}

export class EmailNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailNotConfiguredError";
  }
}

export function isEmailConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY;
}

export async function sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new EmailNotConfiguredError(
      "Email delivery is not configured. Set SENDGRID_API_KEY (and SENDGRID_FROM_EMAIL) to enable.",
    );
  }
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL || "";
  const fromName = process.env.SENDGRID_FROM_NAME || "TourFlow";
  if (!fromEmail) {
    throw new EmailNotConfiguredError("Email delivery is not configured. Set SENDGRID_FROM_EMAIL.");
  }

  const body: Record<string, unknown> = {
    personalizations: [{ to: [{ email: msg.to }], subject: msg.subject }],
    from: { email: fromEmail, name: fromName },
    content: [
      { type: "text/plain", value: msg.text },
      ...(msg.html ? [{ type: "text/html", value: msg.html }] : []),
    ],
  };
  if (msg.attachments && msg.attachments.length > 0) {
    body.attachments = msg.attachments.map(a => ({
      filename: a.filename,
      type: a.contentType,
      content: a.contentBase64,
      disposition: "attachment",
    }));
  }

  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`SendGrid send failed (${resp.status}): ${text.slice(0, 300)}`);
  }
  return { provider: "sendgrid", messageId: resp.headers.get("x-message-id") ?? undefined };
}
