import PDFDocument from "pdfkit";
import { type TourReportData, formatPrice } from "./tourReportData";

const COLOR_PRIMARY = "#0F172A";
const COLOR_ACCENT = "#2563EB";
const COLOR_MUTED = "#64748B";
const COLOR_BORDER = "#E2E8F0";
const COLOR_BG_SOFT = "#F8FAFC";
const COLOR_GREEN = "#059669";
const COLOR_AMBER = "#D97706";
const COLOR_RED = "#DC2626";

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
    return dt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } catch {
    return String(d);
  }
}

function fitColor(score: number | null): string {
  if (score == null) return COLOR_MUTED;
  if (score >= 75) return COLOR_GREEN;
  if (score >= 50) return COLOR_AMBER;
  return COLOR_RED;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function hr(doc: PDFKit.PDFDocument, color = COLOR_BORDER): void {
  doc.moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .lineWidth(0.7)
    .strokeColor(color)
    .stroke();
  doc.moveDown(0.6);
}

function sectionHeading(doc: PDFKit.PDFDocument, label: string): void {
  ensureSpace(doc, 50);
  doc.fillColor(COLOR_ACCENT).font("Helvetica-Bold").fontSize(8);
  doc.text(label.toUpperCase(), { characterSpacing: 1.4 });
  doc.moveDown(0.2);
  hr(doc);
}

function bullets(doc: PDFKit.PDFDocument, items: string[], color = COLOR_PRIMARY): void {
  if (!items || items.length === 0) return;
  doc.font("Helvetica").fontSize(10).fillColor(color);
  for (const item of items) {
    ensureSpace(doc, 16);
    doc.text(`•  ${item}`, { indent: 8, lineGap: 2 });
  }
  doc.moveDown(0.4);
}

function paragraph(doc: PDFKit.PDFDocument, text: string, opts: { color?: string; size?: number; italic?: boolean } = {}): void {
  if (!text) return;
  doc
    .font(opts.italic ? "Helvetica-Oblique" : "Helvetica")
    .fontSize(opts.size ?? 10)
    .fillColor(opts.color ?? COLOR_PRIMARY)
    .text(text, { lineGap: 2, align: "left" });
  doc.moveDown(0.4);
}

function renderHeader(doc: PDFKit.PDFDocument, data: TourReportData): void {
  const { tour, buyer, agentName, generatedAt } = data;
  doc.rect(0, 0, doc.page.width, 110).fillColor(COLOR_PRIMARY).fill();
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(11);
  doc.text("TOURFLOW · TOUR REPORT", doc.page.margins.left, 32, { characterSpacing: 2 });
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#FFFFFF");
  doc.text(tour.title, doc.page.margins.left, 50, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
  doc.font("Helvetica").fontSize(10).fillColor("#CBD5E1");
  const subParts: string[] = [];
  if (buyer?.name) subParts.push(`Buyer: ${buyer.name}`);
  subParts.push(fmtDate(tour.date));
  if (agentName) subParts.push(`Agent: ${agentName}`);
  doc.text(subParts.join("   ·   "), doc.page.margins.left, 82);
  doc.y = 130;
  doc.fillColor(COLOR_MUTED).fontSize(8).font("Helvetica");
  doc.text(`Generated ${generatedAt.toLocaleString("en-US")}`, { align: "right" });
  doc.moveDown(0.8);
}

function renderOverview(doc: PDFKit.PDFDocument, data: TourReportData): void {
  const { tour, stops, buyer } = data;
  const visited = stops.filter(s => s.stop.visited && !s.stop.skipped).length;
  const skipped = stops.filter(s => s.stop.skipped).length;
  const followUps = stops.filter(s => s.stop.followUpFlag).length;
  const revisits = stops.filter(s => s.stop.revisitFlag).length;

  sectionHeading(doc, "Tour Overview");
  const startY = doc.y;
  const colW = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 4;
  const stats: Array<[string, string, string]> = [
    [String(stops.length), "Stops", COLOR_PRIMARY],
    [String(visited), "Visited", COLOR_GREEN],
    [String(followUps), "Follow-ups", COLOR_AMBER],
    [String(revisits), "Second Looks", COLOR_ACCENT],
  ];
  stats.forEach(([num, label, color], i) => {
    const x = doc.page.margins.left + colW * i;
    doc.font("Helvetica-Bold").fontSize(22).fillColor(color);
    doc.text(num, x, startY, { width: colW, align: "center" });
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_MUTED);
    doc.text(label, x, startY + 28, { width: colW, align: "center" });
  });
  doc.y = startY + 50;
  if (skipped > 0) {
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_MUTED);
    doc.text(`${skipped} stop${skipped === 1 ? "" : "s"} skipped`, { align: "center" });
  }
  doc.moveDown(0.6);

  if (buyer && (buyer.email || buyer.phone)) {
    const contact = [buyer.email, buyer.phone].filter(Boolean).join(" · ");
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_MUTED);
    doc.text(`Buyer contact: ${contact}`, { align: "center" });
    doc.moveDown(0.4);
  }
  if (tour.startAddress) {
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_MUTED);
    doc.text(`Start: ${tour.startAddress}`, { align: "center" });
    doc.moveDown(0.6);
  }
}

function renderTourSummary(doc: PDFKit.PDFDocument, data: TourReportData): void {
  if (!data.tourSummary) return;
  const s = data.tourSummary;
  sectionHeading(doc, "AI Tour Summary");
  paragraph(doc, s.summaryText);

  const blocks: Array<[string, string[] | null]> = [
    ["Top Homes to Consider", s.topHomes ?? null],
    ["Homes to Eliminate", s.homesToEliminate ?? null],
    ["Buyer Preferences Observed", s.buyerPreferences ?? null],
    ["Suggested Next Actions", s.nextActions ?? null],
  ];
  for (const [label, items] of blocks) {
    if (items && items.length > 0) {
      ensureSpace(doc, 60);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR_PRIMARY);
      doc.text(label);
      doc.moveDown(0.2);
      bullets(doc, items);
    }
  }
}

function renderCrossTour(doc: PDFKit.PDFDocument, data: TourReportData): void {
  const r = data.crossTourRollup;
  if (!r) return;
  sectionHeading(doc, `Buyer Preference Rollup · ${r.totalCompletedTours} Completed Tours`);
  if (r.preferenceProfile) {
    try {
      const parsed = JSON.parse(r.preferenceProfile) as { summary?: string };
      if (parsed.summary) paragraph(doc, parsed.summary);
    } catch {
      paragraph(doc, r.preferenceProfile);
    }
  }
  if (r.recurringPositives.length > 0) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR_GREEN);
    doc.text("Recurring positives across tours");
    doc.moveDown(0.2);
    bullets(doc, r.recurringPositives);
  }
  if (r.recurringConcerns.length > 0) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR_RED);
    doc.text("Recurring concerns across tours");
    doc.moveDown(0.2);
    bullets(doc, r.recurringConcerns);
  }
}

function renderStop(doc: PDFKit.PDFDocument, rs: TourReportData["stops"][number], index: number): void {
  ensureSpace(doc, 140);
  const { stop, property, propertySummary, typedNotes } = rs;
  const x0 = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Card header band
  const bandY = doc.y;
  doc.rect(x0, bandY, w, 32).fillColor(COLOR_BG_SOFT).fill();
  doc.fillColor(COLOR_PRIMARY).font("Helvetica-Bold").fontSize(11);
  const headerLabel = `STOP ${index + 1} · ${property?.nickname ?? property?.formattedAddress ?? "Property"}`;
  doc.text(headerLabel, x0 + 10, bandY + 9, { width: w - 100 });
  // Status pill
  const statusText = stop.skipped ? "SKIPPED" : stop.visited ? "VISITED" : "NOT VISITED";
  const statusColor = stop.skipped ? COLOR_AMBER : stop.visited ? COLOR_GREEN : COLOR_MUTED;
  doc.fillColor(statusColor).font("Helvetica-Bold").fontSize(8);
  doc.text(statusText, x0 + w - 90, bandY + 11, { width: 80, align: "right", characterSpacing: 1 });
  doc.y = bandY + 38;

  // Address line (if nickname header)
  if (property?.nickname && property?.formattedAddress) {
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_MUTED);
    doc.text(property.formattedAddress, x0 + 10, doc.y, { width: w - 20 });
    doc.moveDown(0.3);
  }

  // Property meta line
  if (property) {
    const meta = [
      property.listPrice ? formatPrice(property.listPrice) : null,
      property.beds ? `${property.beds} bd` : null,
      property.baths ? `${property.baths} ba` : null,
      property.squareFeet ? `${property.squareFeet.toLocaleString()} sqft` : null,
    ].filter(Boolean).join("  ·  ");
    if (meta) {
      doc.font("Helvetica").fontSize(9).fillColor(COLOR_PRIMARY);
      doc.text(meta, x0 + 10, doc.y, { width: w - 20 });
      doc.moveDown(0.4);
    }
  }

  // Ratings + fit score row
  const ratingPairs: Array<[string, number | null]> = [
    ["Overall Fit", stop.overallFitRating],
    ["Buyer Interest", stop.buyerInterest],
    ["Kitchen", stop.kitchenRating],
    ["Primary Suite", stop.primarySuiteRating],
    ["Backyard", stop.backyardRating],
    ["Road Noise", stop.roadNoiseRating],
  ].filter(([, v]) => v != null) as Array<[string, number]>;

  if (ratingPairs.length > 0 || rs.fitScore != null) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR_MUTED);
    doc.text("RATINGS", x0 + 10, doc.y, { characterSpacing: 1.2 });
    doc.moveDown(0.2);
    if (rs.fitScore != null) {
      doc.font("Helvetica-Bold").fontSize(12).fillColor(fitColor(rs.fitScore));
      doc.text(`AI Fit Score: ${rs.fitScore}/100${rs.fitScoreVerdict ? `  ·  ${rs.fitScoreVerdict}` : ""}`, x0 + 10, doc.y);
      doc.moveDown(0.3);
    }
    if (ratingPairs.length > 0) {
      doc.font("Helvetica").fontSize(9).fillColor(COLOR_PRIMARY);
      const ratingLine = ratingPairs.map(([k, v]) => `${k}: ${"★".repeat(v)}${"☆".repeat(5 - v)} (${v}/5)`).join("    ");
      doc.text(ratingLine, x0 + 10, doc.y, { width: w - 20 });
      doc.moveDown(0.4);
    }
  }

  // Positives / negatives
  if (rs.fitScorePositives.length > 0) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_GREEN);
    doc.text("Positives", x0 + 10, doc.y);
    doc.moveDown(0.15);
    bullets(doc, rs.fitScorePositives, COLOR_PRIMARY);
  }
  if (rs.fitScoreNegatives.length > 0) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_RED);
    doc.text("Concerns", x0 + 10, doc.y);
    doc.moveDown(0.15);
    bullets(doc, rs.fitScoreNegatives, COLOR_PRIMARY);
  }

  // Quick tags
  if (stop.quickTags && stop.quickTags.length > 0) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR_MUTED);
    doc.text("QUICK TAGS", x0 + 10, doc.y, { characterSpacing: 1.2 });
    doc.moveDown(0.15);
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_ACCENT);
    doc.text(stop.quickTags.join("  ·  "), x0 + 10, doc.y, { width: w - 20 });
    doc.moveDown(0.4);
  }

  // Flags
  const flags: string[] = [];
  if (stop.followUpFlag) flags.push("Follow-up flagged");
  if (stop.revisitFlag) flags.push("Second look requested");
  if (flags.length > 0) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_AMBER);
    doc.text(flags.join("  ·  "), x0 + 10, doc.y);
    doc.moveDown(0.4);
  }

  // Skip reason
  if (stop.skipped && stop.skipReason) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_AMBER);
    doc.text(`Skip reason: ${stop.skipReason.replace(/_/g, " ")}${stop.skipNotes ? ` — ${stop.skipNotes}` : ""}`, x0 + 10, doc.y, { width: w - 20 });
    doc.moveDown(0.4);
  }

  // AI property summary
  if (propertySummary?.summaryText) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR_MUTED);
    doc.text("AI PROPERTY SUMMARY", x0 + 10, doc.y, { characterSpacing: 1.2 });
    doc.moveDown(0.15);
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_PRIMARY);
    doc.text(propertySummary.summaryText, x0 + 10, doc.y, { width: w - 20, lineGap: 1.5 });
    doc.moveDown(0.4);
  }

  // Debrief
  if (rs.debriefSummary || rs.debriefTranscript) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR_MUTED);
    doc.text("BUYER DEBRIEF", x0 + 10, doc.y, { characterSpacing: 1.2 });
    doc.moveDown(0.15);
    if (rs.debriefSummary) {
      doc.font("Helvetica").fontSize(9).fillColor(COLOR_PRIMARY);
      doc.text(rs.debriefSummary, x0 + 10, doc.y, { width: w - 20, lineGap: 1.5 });
      doc.moveDown(0.3);
    }
    if (rs.debriefTranscript && !rs.debriefSummary) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor(COLOR_MUTED);
      doc.text(`"${rs.debriefTranscript}"`, x0 + 10, doc.y, { width: w - 20, lineGap: 1.5 });
      doc.moveDown(0.3);
    }
  }

  // Notes
  if (typedNotes.length > 0) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR_MUTED);
    doc.text("NOTES", x0 + 10, doc.y, { characterSpacing: 1.2 });
    doc.moveDown(0.15);
    bullets(doc, typedNotes);
  }

  doc.moveDown(0.6);
  hr(doc);
}

export async function renderTourReportPdf(data: TourReportData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      bufferPages: true,
      info: {
        Title: `Tour Report — ${data.tour.title}`,
        Author: data.agentName ?? "TourFlow",
        Subject: "Real Estate Tour Report",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      renderHeader(doc, data);
      renderOverview(doc, data);
      renderTourSummary(doc, data);
      renderCrossTour(doc, data);

      doc.addPage();
      sectionHeading(doc, "Properties Visited");
      data.stops.forEach((s, i) => renderStop(doc, s, i));

      // Footer with page numbers
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.font("Helvetica").fontSize(8).fillColor(COLOR_MUTED);
        doc.text(
          `TourFlow · ${data.tour.title}`,
          doc.page.margins.left,
          doc.page.height - 36,
          { align: "left", width: doc.page.width - doc.page.margins.left - doc.page.margins.right },
        );
        doc.text(
          `Page ${i + 1} of ${range.count}`,
          doc.page.margins.left,
          doc.page.height - 36,
          { align: "right", width: doc.page.width - doc.page.margins.left - doc.page.margins.right },
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
