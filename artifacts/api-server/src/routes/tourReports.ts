import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  toursTable,
  tourReportDeliveriesTable,
  usersTable,
} from "@workspace/db";
import { idParams, parseParams, parseBody } from "../lib/validate";
import { assembleTourReportData } from "../lib/tourReportData";
import { renderTourReportPdf } from "../lib/tourReportPdf";
import { renderTourReportDocx } from "../lib/tourReportDocx";
import { signReportToken, verifyReportToken } from "../lib/reportToken";
import { sendEmail, isEmailConfigured, EmailNotConfiguredError } from "../lib/email";
import { sendSms, isSmsConfigured, SmsNotConfiguredError } from "../lib/sms";

const router: IRouter = Router();

const sendBody = z.object({
  recipient: z.string().min(1).optional(),
});

async function loadOwnedTour(tourId: string, agentId: string, res: Response) {
  const [tour] = await db.select().from(toursTable).where(eq(toursTable.id, tourId));
  if (!tour) {
    res.status(404).json({ error: "Tour not found" });
    return null;
  }
  if (tour.agentId !== agentId) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return tour;
}

async function loadAgentName(agentId: string): Promise<string | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, agentId)).limit(1);
  if (!user) return null;
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || null;
}

function buildReportFilename(title: string, ext: "pdf" | "docx"): string {
  const safe = title.replace(/[^\w\d\-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "tour";
  return `${safe}-tour-report.${ext}`;
}

// ---------------------------------------------------------------------------
// Capability probe
// ---------------------------------------------------------------------------
function publicBaseUrlConfigured(): boolean {
  return !!(process.env.PUBLIC_APP_URL || process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS);
}

function reportLinkSecretConfigured(): boolean {
  return !!(process.env.REPORT_LINK_SECRET || process.env.SESSION_SECRET);
}

router.get("/tours/report/capabilities", (_req: Request, res: Response) => {
  const publicBaseUrl = publicBaseUrlConfigured();
  const linkSecret = reportLinkSecretConfigured();
  res.json({
    emailConfigured: isEmailConfigured(),
    // SMS is only truly usable if Twilio + a public base URL + a signing secret are all present
    smsConfigured: isSmsConfigured() && publicBaseUrl && linkSecret,
    smsTwilioConfigured: isSmsConfigured(),
    publicBaseUrlConfigured: publicBaseUrl,
    reportLinkSecretConfigured: linkSecret,
  });
});

// ---------------------------------------------------------------------------
// JSON report data
// ---------------------------------------------------------------------------
router.get("/tours/:tourId/report/data", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;
  const tour = await loadOwnedTour(params.tourId, user.id, res);
  if (!tour) return;
  try {
    const agentName = await loadAgentName(user.id);
    const data = await assembleTourReportData(params.tourId, agentName);
    if (!data) { res.status(404).json({ error: "Tour not found" }); return; }
    res.json({
      tour: data.tour,
      buyer: data.buyer,
      agentName: data.agentName,
      generatedAt: data.generatedAt,
      stops: data.stops.map(s => ({
        stop: s.stop,
        property: s.property,
        propertySummary: s.propertySummary,
        typedNotes: s.typedNotes,
        debriefSummary: s.debriefSummary,
        debriefTranscript: s.debriefTranscript,
        fitScore: s.fitScore,
        fitScoreVerdict: s.fitScoreVerdict,
        fitScorePositives: s.fitScorePositives,
        fitScoreNegatives: s.fitScoreNegatives,
      })),
      tourSummary: data.tourSummary,
      crossTourRollup: data.crossTourRollup,
      hasBuyerEmail: !!data.buyer?.email,
      hasBuyerPhone: !!data.buyer?.phone,
      emailConfigured: isEmailConfigured(),
      smsConfigured: isSmsConfigured(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to assemble tour report data");
    res.status(500).json({ error: "Failed to assemble report" });
  }
});

// ---------------------------------------------------------------------------
// Authenticated PDF / DOCX download
// ---------------------------------------------------------------------------
router.get("/tours/:tourId/report.pdf", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;
  const tour = await loadOwnedTour(params.tourId, user.id, res);
  if (!tour) return;
  try {
    const agentName = await loadAgentName(user.id);
    const data = await assembleTourReportData(params.tourId, agentName);
    if (!data) { res.status(404).json({ error: "Tour not found" }); return; }
    const buffer = await renderTourReportPdf(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${buildReportFilename(tour.title, "pdf")}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  } catch (err) {
    req.log.error({ err }, "Failed to render PDF report");
    res.status(500).json({ error: "Failed to render PDF" });
  }
});

router.get("/tours/:tourId/report.docx", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;
  const tour = await loadOwnedTour(params.tourId, user.id, res);
  if (!tour) return;
  try {
    const agentName = await loadAgentName(user.id);
    const data = await assembleTourReportData(params.tourId, agentName);
    if (!data) { res.status(404).json({ error: "Tour not found" }); return; }
    const buffer = await renderTourReportDocx(data);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${buildReportFilename(tour.title, "docx")}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  } catch (err) {
    req.log.error({ err }, "Failed to render DOCX report");
    res.status(500).json({ error: "Failed to render DOCX" });
  }
});

// ---------------------------------------------------------------------------
// Public signed-token download (for SMS links)
// ---------------------------------------------------------------------------
async function handlePublicReport(req: Request, res: Response, format: "pdf" | "docx") {
  const tourId = req.params.tourId;
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) { res.status(401).send("Missing token"); return; }
  const payload = verifyReportToken(token);
  if (!payload || payload.tourId !== tourId) {
    res.status(401).send("Invalid or expired link");
    return;
  }
  try {
    const [tour] = await db.select().from(toursTable).where(eq(toursTable.id, tourId));
    if (!tour) { res.status(404).send("Tour not found"); return; }
    const agentName = await loadAgentName(tour.agentId);
    const data = await assembleTourReportData(tourId, agentName);
    if (!data) { res.status(404).send("Tour not found"); return; }
    if (format === "pdf") {
      const buffer = await renderTourReportPdf(data);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${buildReportFilename(tour.title, "pdf")}"`);
      res.end(buffer);
    } else {
      const buffer = await renderTourReportDocx(data);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${buildReportFilename(tour.title, "docx")}"`);
      res.end(buffer);
    }
  } catch (err) {
    req.log.error({ err }, "Failed to serve public tour report");
    res.status(500).send("Failed to render report");
  }
}

router.get("/public/tour-reports/:tourId/pdf", (req, res) => handlePublicReport(req, res, "pdf"));
router.get("/public/tour-reports/:tourId/docx", (req, res) => handlePublicReport(req, res, "docx"));

// ---------------------------------------------------------------------------
// Email delivery (PDF attachment)
// ---------------------------------------------------------------------------
router.post("/tours/:tourId/report/email", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const body = parseBody(sendBody, req, res);
  if (!body) return;
  const user = (req as Express.AuthedRequest).user;
  const tour = await loadOwnedTour(params.tourId, user.id, res);
  if (!tour) return;

  try {
    const agentName = await loadAgentName(user.id);
    const data = await assembleTourReportData(params.tourId, agentName);
    if (!data) { res.status(404).json({ error: "Tour not found" }); return; }

    const recipient = body.recipient?.trim() || data.buyer?.email || "";
    if (!recipient) {
      res.status(400).json({ error: "No recipient email — add an email to the buyer or pass one in the request." });
      return;
    }

    const buffer = await renderTourReportPdf(data);
    const deliveryId = randomUUID();
    await db.insert(tourReportDeliveriesTable).values({
      id: deliveryId,
      tourId: params.tourId,
      channel: "email",
      recipient,
      status: "pending",
    });

    try {
      const subject = `Your tour report — ${tour.title}`;
      const intro = `Hi${data.buyer?.name ? ` ${data.buyer.name.split(" ")[0]}` : ""},\n\nHere's the report from your tour on ${tour.date}.${data.tourSummary?.summaryText ? `\n\n${data.tourSummary.summaryText}` : ""}\n\n${agentName ? `— ${agentName}` : "— Your agent"}`;
      const result = await sendEmail({
        to: recipient,
        subject,
        text: intro,
        attachments: [{
          filename: buildReportFilename(tour.title, "pdf"),
          contentType: "application/pdf",
          contentBase64: buffer.toString("base64"),
        }],
      });
      await db.update(tourReportDeliveriesTable)
        .set({ status: "sent", provider: result.provider, sentAt: new Date() })
        .where(eq(tourReportDeliveriesTable.id, deliveryId));
      res.json({ ok: true, deliveryId, channel: "email", recipient, provider: result.provider });
    } catch (sendErr) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      await db.update(tourReportDeliveriesTable)
        .set({ status: "failed", errorMessage: msg })
        .where(eq(tourReportDeliveriesTable.id, deliveryId));
      if (sendErr instanceof EmailNotConfiguredError) {
        res.status(503).json({ error: msg, code: "email_not_configured" });
      } else {
        res.status(502).json({ error: msg });
      }
    }
  } catch (err) {
    req.log.error({ err }, "Failed to email tour report");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to email report" });
  }
});

// ---------------------------------------------------------------------------
// SMS delivery (signed download link)
// ---------------------------------------------------------------------------
router.post("/tours/:tourId/report/sms", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const body = parseBody(sendBody, req, res);
  if (!body) return;
  const user = (req as Express.AuthedRequest).user;
  const tour = await loadOwnedTour(params.tourId, user.id, res);
  if (!tour) return;

  try {
    const agentName = await loadAgentName(user.id);
    const data = await assembleTourReportData(params.tourId, agentName);
    if (!data) { res.status(404).json({ error: "Tour not found" }); return; }

    const recipient = body.recipient?.trim() || data.buyer?.phone || "";
    if (!recipient) {
      res.status(400).json({ error: "No recipient phone — add a phone number to the buyer or pass one in the request." });
      return;
    }

    let token: ReturnType<typeof signReportToken>;
    try {
      token = signReportToken(params.tourId);
    } catch (err) {
      res.status(503).json({
        error: err instanceof Error ? err.message : "Cannot sign download link",
        code: "signing_secret_missing",
      });
      return;
    }

    const rawDomain = process.env.PUBLIC_APP_URL
      || process.env.REPLIT_DEV_DOMAIN
      || (process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(",")[0]?.trim() : "")
      || "";
    const baseUrl = rawDomain.replace(/\/+$/, "");
    const fullBase = baseUrl.startsWith("http") ? baseUrl : baseUrl ? `https://${baseUrl}` : "";
    if (!fullBase) {
      res.status(503).json({ error: "Public base URL is not configured. Set PUBLIC_APP_URL.", code: "base_url_missing" });
      return;
    }
    const link = `${fullBase}/api/public/tour-reports/${params.tourId}/pdf?token=${encodeURIComponent(token.token)}`;

    const deliveryId = randomUUID();
    await db.insert(tourReportDeliveriesTable).values({
      id: deliveryId,
      tourId: params.tourId,
      channel: "sms",
      recipient,
      status: "pending",
      publicTokenJti: token.jti,
    });

    try {
      const firstName = data.buyer?.name?.split(" ")[0];
      const smsBody = `${firstName ? `Hi ${firstName}, ` : ""}your tour report from ${tour.date} is ready: ${link} (link expires in 7 days)${agentName ? ` — ${agentName}` : ""}`;
      const result = await sendSms({ to: recipient, body: smsBody });
      await db.update(tourReportDeliveriesTable)
        .set({ status: "sent", provider: result.provider, sentAt: new Date() })
        .where(eq(tourReportDeliveriesTable.id, deliveryId));
      res.json({ ok: true, deliveryId, channel: "sms", recipient, provider: result.provider, link });
    } catch (sendErr) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      await db.update(tourReportDeliveriesTable)
        .set({ status: "failed", errorMessage: msg })
        .where(eq(tourReportDeliveriesTable.id, deliveryId));
      if (sendErr instanceof SmsNotConfiguredError) {
        res.status(503).json({ error: msg, code: "sms_not_configured" });
      } else {
        res.status(502).json({ error: msg });
      }
    }
  } catch (err) {
    req.log.error({ err }, "Failed to send tour report SMS");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to send SMS" });
  }
});

// ---------------------------------------------------------------------------
// Delivery history
// ---------------------------------------------------------------------------
router.get("/tours/:tourId/report/deliveries", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;
  const tour = await loadOwnedTour(params.tourId, user.id, res);
  if (!tour) return;
  try {
    const rows = await db
      .select()
      .from(tourReportDeliveriesTable)
      .where(eq(tourReportDeliveriesTable.tourId, params.tourId))
      .orderBy(desc(tourReportDeliveriesTable.createdAt))
      .limit(50);
    res.json({ deliveries: rows });
  } catch (err) {
    req.log.error({ err }, "Failed to load deliveries");
    res.status(500).json({ error: "Failed to load deliveries" });
  }
});

export default router;
