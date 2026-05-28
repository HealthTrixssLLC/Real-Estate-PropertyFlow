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
import { ObjectStorageService } from "../lib/objectStorage";

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

async function loadAgentContact(agentId: string): Promise<{ name: string | null; email: string | null; phone: string | null }> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, agentId)).limit(1);
  if (!user) return { name: null, email: null, phone: null };
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || null;
  return { name, email: user.email ?? null, phone: null };
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

function objectStorageConfigured(): boolean {
  return !!process.env.PRIVATE_OBJECT_DIR;
}

router.get("/tours/report/capabilities", (_req: Request, res: Response) => {
  const publicBaseUrl = publicBaseUrlConfigured();
  const linkSecret = reportLinkSecretConfigured();
  const objectStorage = objectStorageConfigured();
  // Preferred SMS path: signed object-storage URL (no public base URL or app-level secret needed).
  // Fallback SMS path: HMAC token + public app route (needs public base URL + signing secret).
  const smsReady = isSmsConfigured() && (objectStorage || (publicBaseUrl && linkSecret));
  res.json({
    emailConfigured: isEmailConfigured(),
    smsConfigured: smsReady,
    smsTwilioConfigured: isSmsConfigured(),
    publicBaseUrlConfigured: publicBaseUrl,
    reportLinkSecretConfigured: linkSecret,
    objectStorageConfigured: objectStorage,
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
    const agent = await loadAgentContact(user.id);
    const data = await assembleTourReportData(params.tourId, agent);
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
    const agent = await loadAgentContact(user.id);
    const data = await assembleTourReportData(params.tourId, agent);
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
    const agent = await loadAgentContact(user.id);
    const data = await assembleTourReportData(params.tourId, agent);
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
    const agent = await loadAgentContact(tour.agentId);
    const data = await assembleTourReportData(tourId, agent);
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
    const agent = await loadAgentContact(user.id);
    const data = await assembleTourReportData(params.tourId, agent);
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
      const intro = `Hi${data.buyer?.name ? ` ${data.buyer.name.split(" ")[0]}` : ""},\n\nHere's the report from your tour on ${tour.date}.${data.tourSummary?.summaryText ? `\n\n${data.tourSummary.summaryText}` : ""}\n\n${agent.name ? `— ${agent.name}` : "— Your agent"}`;
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
    const agent = await loadAgentContact(user.id);
    const data = await assembleTourReportData(params.tourId, agent);
    if (!data) { res.status(404).json({ error: "Tour not found" }); return; }

    const recipient = body.recipient?.trim() || data.buyer?.phone || "";
    if (!recipient) {
      res.status(400).json({ error: "No recipient phone — add a phone number to the buyer or pass one in the request." });
      return;
    }

    // Preferred path: upload the rendered PDF to object storage and SMS a short-lived signed URL.
    // Fallback path: sign an app-level HMAC token and SMS the public-route URL.
    let link: string;
    let publicTokenJti: string | null = null;
    let deliveryMethod: "object_storage_signed_url" | "hmac_public_route";

    if (objectStorageConfigured()) {
      try {
        const buffer = await renderTourReportPdf(data);
        const filename = buildReportFilename(tour.title, "pdf");
        const uploaded = await new ObjectStorageService().uploadBytesAndGetSignedUrl({
          bytes: buffer,
          contentType: "application/pdf",
          contentDisposition: `inline; filename="${filename}"`,
          extension: "pdf",
          ttlSec: 7 * 24 * 60 * 60, // 7 days
        });
        link = uploaded.url;
        deliveryMethod = "object_storage_signed_url";
      } catch (err) {
        req.log.error({ err }, "Object storage upload failed for SMS report");
        res.status(502).json({
          error: err instanceof Error ? err.message : "Failed to upload report to object storage",
          code: "object_storage_upload_failed",
        });
        return;
      }
    } else {
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
        res.status(503).json({
          error: "Set up Object Storage (preferred) or PUBLIC_APP_URL to send report SMS.",
          code: "no_delivery_method_configured",
        });
        return;
      }
      link = `${fullBase}/api/public/tour-reports/${params.tourId}/pdf?token=${encodeURIComponent(token.token)}`;
      publicTokenJti = token.jti;
      deliveryMethod = "hmac_public_route";
    }

    const deliveryId = randomUUID();
    await db.insert(tourReportDeliveriesTable).values({
      id: deliveryId,
      tourId: params.tourId,
      channel: "sms",
      recipient,
      status: "pending",
      publicTokenJti,
    });

    try {
      const firstName = data.buyer?.name?.split(" ")[0];
      const smsBody = `${firstName ? `Hi ${firstName}, ` : ""}your tour report from ${tour.date} is ready: ${link} (link expires in 7 days)${agent.name ? ` — ${agent.name}` : ""}`;
      const result = await sendSms({ to: recipient, body: smsBody });
      await db.update(tourReportDeliveriesTable)
        .set({ status: "sent", provider: result.provider, sentAt: new Date() })
        .where(eq(tourReportDeliveriesTable.id, deliveryId));
      res.json({ ok: true, deliveryId, channel: "sms", recipient, provider: result.provider, link, deliveryMethod });
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
// Short-lived shareable PDF URL (object storage signed GET)
// Used by mobile for native Share / mailto: / sms: deep-links.
// ---------------------------------------------------------------------------
router.post("/tours/:tourId/report/share-url", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;
  const tour = await loadOwnedTour(params.tourId, user.id, res);
  if (!tour) return;
  if (!objectStorageConfigured()) {
    res.status(503).json({ error: "Object Storage is not configured.", code: "object_storage_not_configured" });
    return;
  }
  try {
    const agent = await loadAgentContact(user.id);
    const data = await assembleTourReportData(params.tourId, agent);
    if (!data) { res.status(404).json({ error: "Tour not found" }); return; }
    const buffer = await renderTourReportPdf(data);
    const filename = buildReportFilename(tour.title, "pdf");
    const uploaded = await new ObjectStorageService().uploadBytesAndGetSignedUrl({
      bytes: buffer,
      contentType: "application/pdf",
      contentDisposition: `inline; filename="${filename}"`,
      extension: "pdf",
      ttlSec: 7 * 24 * 60 * 60,
    });
    res.json({ url: uploaded.url, expiresAt: uploaded.expiresAt, filename });
  } catch (err) {
    req.log.error({ err }, "Failed to build share URL");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to build share URL" });
  }
});

// ---------------------------------------------------------------------------
// Generate / refresh report (auto-fills missing per-property summaries)
// ---------------------------------------------------------------------------
router.post("/tours/:tourId/report/generate", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = parseParams(idParams.tourId, req, res);
  if (!params) return;
  const user = (req as Express.AuthedRequest).user;
  const tour = await loadOwnedTour(params.tourId, user.id, res);
  if (!tour) return;
  try {
    const agent = await loadAgentContact(user.id);
    const data = await assembleTourReportData(params.tourId, agent);
    if (!data) { res.status(404).json({ error: "Tour not found" }); return; }
    const summariesGenerated = data.stops.filter(s => s.propertySummary).length;
    res.json({
      ok: true,
      generatedAt: data.generatedAt,
      stopsTotal: data.stops.length,
      stopsWithSummary: summariesGenerated,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to generate tour report");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to generate report" });
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
