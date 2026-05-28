export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsSendResult {
  provider: string;
  messageId?: string;
}

export class SmsNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmsNotConfiguredError";
  }
}

export function isSmsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID));
}

export async function sendSms(msg: SmsMessage): Promise<SmsSendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const msgService = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || (!fromNumber && !msgService)) {
    throw new SmsNotConfiguredError(
      "SMS delivery is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER (or TWILIO_MESSAGING_SERVICE_SID) to enable.",
    );
  }
  const params = new URLSearchParams();
  params.set("To", msg.to);
  params.set("Body", msg.body);
  if (msgService) params.set("MessagingServiceSid", msgService);
  else if (fromNumber) params.set("From", fromNumber);

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Twilio send failed (${resp.status}): ${text.slice(0, 300)}`);
  }
  const data = (await resp.json().catch(() => ({}))) as { sid?: string };
  return { provider: "twilio", messageId: data.sid };
}
