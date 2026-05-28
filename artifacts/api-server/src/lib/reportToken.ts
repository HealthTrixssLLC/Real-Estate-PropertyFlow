import crypto from "crypto";

const DEFAULT_TTL_DAYS = 7;

function getSecret(): string {
  const secret =
    process.env.REPORT_LINK_SECRET ||
    process.env.SESSION_SECRET ||
    "";
  if (!secret) {
    throw new Error(
      "Cannot sign report link: set REPORT_LINK_SECRET (or SESSION_SECRET) in the environment.",
    );
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export interface ReportTokenPayload {
  tourId: string;
  jti: string;
  exp: number;
}

export function signReportToken(tourId: string, ttlDays: number = DEFAULT_TTL_DAYS): { token: string; jti: string; expiresAt: Date } {
  const jti = crypto.randomBytes(16).toString("hex");
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
  const payload: ReportTokenPayload = { tourId, jti, exp };
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest();
  const sigB64 = base64url(sig);
  return { token: `${payloadB64}.${sigB64}`, jti, expiresAt: new Date(exp * 1000) };
}

export function verifyReportToken(token: string): ReportTokenPayload | null {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;
    const expected = base64url(crypto.createHmac("sha256", getSecret()).update(payloadB64).digest());
    if (expected.length !== sigB64.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sigB64))) return null;
    const payloadJson = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(payloadJson) as ReportTokenPayload;
    if (!payload.tourId || !payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
