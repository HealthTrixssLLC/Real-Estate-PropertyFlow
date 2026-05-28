import PDFDocument from "pdfkit";
import { type TourReportData, formatPrice } from "./tourReportData";

const COLOR_PRIMARY  = "#0F172A";
const COLOR_ACCENT   = "#2563EB";
const COLOR_MUTED    = "#64748B";
const COLOR_BORDER   = "#CBD5E1";
const COLOR_GREEN    = "#059669";
const COLOR_AMBER    = "#D97706";
const COLOR_RED      = "#DC2626";
const COLOR_WHITE    = "#FFFFFF";
const COLOR_HEADER_BG = "#0F172A";
const COLOR_ACCENT_STRIP = "#2563EB";

const MARGIN = 52;
const FONT_BODY = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const FONT_ITALIC = "Helvetica-Oblique";

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

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - MARGIN * 2;
}

function pageBottom(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > pageBottom(doc)) doc.addPage();
}

function rule(doc: PDFKit.PDFDocument, color = COLOR_BORDER, weight = 0.5): void {
  const y = doc.y;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + contentWidth(doc), y)
    .lineWidth(weight).strokeColor(color).stroke();
}

function gap(doc: PDFKit.PDFDocument, pts = 8): void {
  doc.y += pts;
}

function label(doc: PDFKit.PDFDocument, text: string): void {
  doc.font(FONT_BOLD).fontSize(7).fillColor(COLOR_MUTED)
    .text(text.toUpperCase(), MARGIN, doc.y, { characterSpacing: 1.2, width: contentWidth(doc) });
  gap(doc, 3);
}

function body(
  doc: PDFKit.PDFDocument,
  text: string,
  opts: { color?: string; size?: number; italic?: boolean; indent?: number } = {},
): void {
  if (!text) return;
  doc.font(opts.italic ? FONT_ITALIC : FONT_BODY)
    .fontSize(opts.size ?? 9.5)
    .fillColor(opts.color ?? COLOR_PRIMARY)
    .text(text, MARGIN + (opts.indent ?? 0), doc.y, {
      width: contentWidth(doc) - (opts.indent ?? 0),
      lineGap: 1.5,
    });
  gap(doc, 4);
}

function bullets(doc: PDFKit.PDFDocument, items: string[], color = COLOR_PRIMARY): void {
  if (!items || items.length === 0) return;
  doc.font(FONT_BODY).fontSize(9.5).fillColor(color);
  for (const item of items) {
    ensureSpace(doc, 15);
    doc.text(`•  ${item}`, MARGIN + 8, doc.y, { width: contentWidth(doc) - 8, lineGap: 1.5 });
    gap(doc, 2);
  }
  gap(doc, 4);
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string): void {
  ensureSpace(doc, 40);
  gap(doc, 10);
  label(doc, text);
  rule(doc, COLOR_ACCENT_STRIP, 1);
  gap(doc, 6);
}

function renderHeader(doc: PDFKit.PDFDocument, data: TourReportData): void {
  const { tour, buyer, agentName } = data;
  const bandH = 82;

  doc.rect(0, 0, doc.page.width, bandH).fillColor(COLOR_HEADER_BG).fill();

  doc.font(FONT_BOLD).fontSize(7.5).fillColor("#64748B")
    .text("TOURFLOW  ·  TOUR REPORT", MARGIN, 18, { characterSpacing: 2, width: contentWidth(doc) });

  doc.font(FONT_BOLD).fontSize(20).fillColor(COLOR_WHITE)
    .text(tour.title, MARGIN, 30, { width: doc.page.width - MARGIN - 120 });

  const subParts: string[] = [];
  if (buyer?.name) subParts.push(buyer.name);
  subParts.push(fmtDate(tour.date));
  if (agentName) subParts.push(`Agent: ${agentName}`);

  doc.font(FONT_BODY).fontSize(8.5).fillColor("#94A3B8")
    .text(subParts.join("   ·   "), MARGIN, 58, { width: contentWidth(doc) });

  doc.y = bandH + 12;

  doc.font(FONT_BODY).fontSize(7.5).fillColor(COLOR_MUTED)
    .text(`Generated ${data.generatedAt.toLocaleString("en-US")}`, MARGIN, doc.y, {
      width: contentWidth(doc), align: "right",
    });
  gap(doc, 8);
}

function renderOverview(doc: PDFKit.PDFDocument, data: TourReportData): void {
  const { tour, stops, buyer } = data;
  const visited   = stops.filter(s => s.stop.visited && !s.stop.skipped).length;
  const skipped   = stops.filter(s => s.stop.skipped).length;
  const followUps = stops.filter(s => s.stop.followUpFlag).length;
  const revisits  = stops.filter(s => s.stop.revisitFlag).length;

  sectionTitle(doc, "Tour Overview");

  const startY = doc.y;
  const cw = contentWidth(doc);
  const colW = cw / 4;
  const stats: Array<[string, string, string]> = [
    [String(stops.length),  "Properties",   COLOR_PRIMARY],
    [String(visited),       "Visited",       COLOR_GREEN],
    [String(followUps),     "Follow-ups",    COLOR_AMBER],
    [String(revisits),      "Second Looks",  COLOR_ACCENT],
  ];
  stats.forEach(([num, lbl, color], i) => {
    const x = MARGIN + colW * i;
    doc.font(FONT_BOLD).fontSize(20).fillColor(color)
      .text(num, x, startY, { width: colW, align: "center" });
    doc.font(FONT_BODY).fontSize(8).fillColor(COLOR_MUTED)
      .text(lbl, x, startY + 24, { width: colW, align: "center" });
  });
  doc.y = startY + 44;
  if (skipped > 0) {
    doc.font(FONT_BODY).fontSize(8).fillColor(COLOR_MUTED)
      .text(`${skipped} stop${skipped === 1 ? "" : "s"} skipped`, MARGIN, doc.y, { width: cw, align: "center" });
    gap(doc, 4);
  }
  gap(doc, 6);

  const metaLines: string[] = [];
  if (buyer && (buyer.email || buyer.phone)) {
    metaLines.push([buyer.email, buyer.phone].filter(Boolean).join("  ·  "));
  }
  if (tour.startAddress) metaLines.push(`Start: ${tour.startAddress}`);
  if (metaLines.length > 0) {
    doc.font(FONT_BODY).fontSize(8.5).fillColor(COLOR_MUTED)
      .text(metaLines.join("    "), MARGIN, doc.y, { width: cw, align: "center" });
    gap(doc, 8);
  }
}

function renderTourSummary(doc: PDFKit.PDFDocument, data: TourReportData): void {
  if (!data.tourSummary) return;
  const s = data.tourSummary;
  sectionTitle(doc, "AI Tour Summary");
  if (s.summaryText) body(doc, s.summaryText);

  const blocks: Array<[string, string[] | null]> = [
    ["Top homes to consider",       s.topHomes ?? null],
    ["Homes to eliminate",          s.homesToEliminate ?? null],
    ["Buyer preferences observed",  s.buyerPreferences ?? null],
    ["Suggested next actions",      s.nextActions ?? null],
  ];
  for (const [lbl, items] of blocks) {
    if (items && items.length > 0) {
      ensureSpace(doc, 50);
      doc.font(FONT_BOLD).fontSize(9.5).fillColor(COLOR_PRIMARY).text(lbl, MARGIN, doc.y);
      gap(doc, 3);
      bullets(doc, items);
    }
  }
}

function renderCrossTour(doc: PDFKit.PDFDocument, data: TourReportData): void {
  const r = data.crossTourRollup;
  if (!r) return;
  sectionTitle(doc, `Buyer Preference Rollup  ·  ${r.totalCompletedTours} Completed Tours`);
  if (r.preferenceProfile) {
    try {
      const parsed = JSON.parse(r.preferenceProfile) as { summary?: string };
      if (parsed.summary) body(doc, parsed.summary);
    } catch {
      body(doc, r.preferenceProfile);
    }
  }
  if (r.recurringPositives.length > 0) {
    doc.font(FONT_BOLD).fontSize(9.5).fillColor(COLOR_GREEN).text("Recurring strengths", MARGIN, doc.y);
    gap(doc, 3);
    bullets(doc, r.recurringPositives);
  }
  if (r.recurringConcerns.length > 0) {
    doc.font(FONT_BOLD).fontSize(9.5).fillColor(COLOR_RED).text("Recurring concerns", MARGIN, doc.y);
    gap(doc, 3);
    bullets(doc, r.recurringConcerns);
  }
}

function renderStop(doc: PDFKit.PDFDocument, rs: TourReportData["stops"][number], index: number, total: number): void {
  const { stop, property, propertySummary, typedNotes } = rs;
  const cw = contentWidth(doc);

  // Thin accent rule above stop header
  rule(doc, COLOR_ACCENT_STRIP, 1.5);
  gap(doc, 7);

  // Stop number + property name line
  const statusText  = stop.skipped ? "SKIPPED" : stop.visited ? "VISITED" : "NOT VISITED";
  const statusColor = stop.skipped ? COLOR_AMBER : stop.visited ? COLOR_GREEN : COLOR_MUTED;

  const stopNumLabel = `STOP ${index + 1} OF ${total}`;
  doc.font(FONT_BOLD).fontSize(7.5).fillColor(COLOR_ACCENT)
    .text(stopNumLabel, MARGIN, doc.y, { continued: true, characterSpacing: 1 });
  doc.font(FONT_BOLD).fontSize(7.5).fillColor(statusColor)
    .text(`    ${statusText}`, { characterSpacing: 0.8 });

  gap(doc, 3);

  const propertyName = property?.nickname ?? property?.formattedAddress ?? "Property";
  doc.font(FONT_BOLD).fontSize(14).fillColor(COLOR_PRIMARY)
    .text(propertyName, MARGIN, doc.y, { width: cw });
  gap(doc, 2);

  if (property?.nickname && property?.formattedAddress) {
    doc.font(FONT_BODY).fontSize(8.5).fillColor(COLOR_MUTED)
      .text(property.formattedAddress, MARGIN, doc.y, { width: cw });
    gap(doc, 3);
  }

  // Property details line
  if (property) {
    const meta = [
      property.listPrice ? formatPrice(property.listPrice) : null,
      property.beds      ? `${property.beds} bd`                          : null,
      property.baths     ? `${property.baths} ba`                         : null,
      property.squareFeet ? `${property.squareFeet.toLocaleString()} sqft` : null,
    ].filter(Boolean).join("   ·   ");
    if (meta) {
      doc.font(FONT_BOLD).fontSize(9).fillColor(COLOR_PRIMARY)
        .text(meta, MARGIN, doc.y, { width: cw });
      gap(doc, 6);
    }
  }

  // Skip reason
  if (stop.skipped && stop.skipReason) {
    doc.font(FONT_ITALIC).fontSize(9).fillColor(COLOR_AMBER)
      .text(
        `Skip reason: ${stop.skipReason.replace(/_/g, " ")}${stop.skipNotes ? ` — ${stop.skipNotes}` : ""}`,
        MARGIN, doc.y, { width: cw },
      );
    gap(doc, 6);
  }

  // Fit score
  if (rs.fitScore != null) {
    doc.font(FONT_BOLD).fontSize(11).fillColor(fitColor(rs.fitScore))
      .text(
        `AI Fit Score: ${rs.fitScore}/100${rs.fitScoreVerdict ? `   ·   ${rs.fitScoreVerdict}` : ""}`,
        MARGIN, doc.y, { width: cw },
      );
    gap(doc, 4);
  }

  // Ratings — plain text, no Unicode stars
  const ratingPairs: Array<[string, number]> = [
    ["Overall",       stop.overallFitRating],
    ["Interest",      stop.buyerInterest],
    ["Kitchen",       stop.kitchenRating],
    ["Primary Suite", stop.primarySuiteRating],
    ["Backyard",      stop.backyardRating],
    ["Road Noise",    stop.roadNoiseRating],
  ].filter(([, v]) => v != null) as Array<[string, number]>;

  if (ratingPairs.length > 0) {
    const ratingStr = ratingPairs.map(([k, v]) => `${k}: ${v}/5`).join("    ");
    doc.font(FONT_BODY).fontSize(9).fillColor(COLOR_MUTED)
      .text(ratingStr, MARGIN, doc.y, { width: cw });
    gap(doc, 6);
  }

  // Flags
  const flags: string[] = [];
  if (stop.followUpFlag)  flags.push("Follow-up flagged");
  if (stop.revisitFlag)   flags.push("Second look requested");
  if (flags.length > 0) {
    doc.font(FONT_BOLD).fontSize(9).fillColor(COLOR_AMBER)
      .text(flags.join("   ·   "), MARGIN, doc.y, { width: cw });
    gap(doc, 4);
  }

  // Quick tags
  if (stop.quickTags && stop.quickTags.length > 0) {
    doc.font(FONT_BODY).fontSize(9).fillColor(COLOR_ACCENT)
      .text(stop.quickTags.join("  ·  "), MARGIN, doc.y, { width: cw });
    gap(doc, 4);
  }

  // Positives / concerns
  if (rs.fitScorePositives.length > 0) {
    ensureSpace(doc, 40);
    doc.font(FONT_BOLD).fontSize(9).fillColor(COLOR_GREEN).text("Strengths", MARGIN, doc.y);
    gap(doc, 2);
    bullets(doc, rs.fitScorePositives);
  }
  if (rs.fitScoreNegatives.length > 0) {
    ensureSpace(doc, 40);
    doc.font(FONT_BOLD).fontSize(9).fillColor(COLOR_RED).text("Concerns", MARGIN, doc.y);
    gap(doc, 2);
    bullets(doc, rs.fitScoreNegatives);
  }

  // AI property summary
  if (propertySummary?.summaryText) {
    ensureSpace(doc, 50);
    label(doc, "AI Property Summary");
    body(doc, propertySummary.summaryText);
    const extras: Array<[string, string[]]> = [
      ["Positives",              propertySummary.positives ?? []],
      ["Concerns",               propertySummary.negatives ?? []],
      ["Questions for Seller",   propertySummary.questions ?? []],
    ];
    for (const [lbl, items] of extras) {
      if (items.length > 0) {
        doc.font(FONT_BOLD).fontSize(9).fillColor(COLOR_MUTED).text(lbl, MARGIN, doc.y);
        gap(doc, 2);
        bullets(doc, items);
      }
    }
  }

  // Buyer debrief
  if (rs.debriefSummary || rs.debriefTranscript) {
    ensureSpace(doc, 40);
    label(doc, "Buyer Debrief");
    if (rs.debriefSummary) {
      body(doc, rs.debriefSummary);
    } else if (rs.debriefTranscript) {
      body(doc, `"${rs.debriefTranscript}"`, { italic: true, color: COLOR_MUTED });
    }
  }

  // Notes
  if (typedNotes.length > 0) {
    ensureSpace(doc, 40);
    label(doc, "Notes");
    bullets(doc, typedNotes);
  }

  gap(doc, 4);
}

export async function renderTourReportPdf(data: TourReportData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 0, bottom: 44, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: {
        Title:   `Tour Report — ${data.tour.title}`,
        Author:  data.agentName ?? "TourFlow",
        Subject: "Real Estate Tour Report",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      // Cover section (header + overview + summaries) flows continuously on page 1
      renderHeader(doc, data);
      renderOverview(doc, data);
      renderTourSummary(doc, data);
      renderCrossTour(doc, data);

      // Properties section — page-break only between stops
      if (data.stops.length > 0) {
        // If there's less than 200pt left on the current page, start fresh
        if (doc.y + 200 > pageBottom(doc)) {
          doc.addPage();
        } else {
          sectionTitle(doc, "Properties Visited");
        }

        data.stops.forEach((s, i) => {
          if (i > 0) {
            doc.addPage();
          } else if (doc.y + 200 > pageBottom(doc)) {
            doc.addPage();
          }
          renderStop(doc, s, i, data.stops.length);
        });
      }

      // Footer pass — page number + agent contact
      const contactParts: string[] = [];
      if (data.agentName)  contactParts.push(data.agentName);
      if (data.agentEmail) contactParts.push(data.agentEmail);
      if (data.agentPhone) contactParts.push(data.agentPhone);
      const agentLine = contactParts.length > 0
        ? `Prepared by ${contactParts.join("  ·  ")}`
        : "TourFlow";

      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const footerY  = doc.page.height - 28;
        const footerW  = doc.page.width - MARGIN * 2;
        doc.font(FONT_BODY).fontSize(7.5).fillColor(COLOR_MUTED);
        doc.text(agentLine,               MARGIN, footerY, { width: footerW, align: "left" });
        doc.text(`${i + 1} / ${range.count}`, MARGIN, footerY, { width: footerW, align: "right" });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
