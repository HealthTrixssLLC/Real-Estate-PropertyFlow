import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  PageBreak,
  Packer,
  Paragraph,
  TextRun,
  BorderStyle,
} from "docx";
import { type TourReportData, formatPrice } from "./tourReportData";

const PRIMARY = "0F172A";
const ACCENT = "2563EB";
const MUTED = "64748B";
const GREEN = "059669";
const RED = "DC2626";
const AMBER = "D97706";

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
    return dt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } catch {
    return String(d);
  }
}

function text(content: string, opts: { bold?: boolean; italics?: boolean; color?: string; size?: number } = {}): TextRun {
  return new TextRun({
    text: content,
    bold: opts.bold,
    italics: opts.italics,
    color: opts.color,
    size: opts.size,
  });
}

function p(runs: TextRun[] | string, opts: { spacing?: number; align?: typeof AlignmentType[keyof typeof AlignmentType] } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.spacing ?? 120 },
    children: typeof runs === "string" ? [text(runs)] : runs,
  });
}

function heading(content: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2, color = PRIMARY): Paragraph {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [text(content, { bold: true, color })],
  });
}

function bulletList(items: string[], color = PRIMARY): Paragraph[] {
  return items.map(item =>
    new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 60 },
      children: [text(item, { color })],
    }),
  );
}

function hr(): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    border: { bottom: { color: "CBD5E1", space: 1, style: BorderStyle.SINGLE, size: 6 } },
    children: [text("")],
  });
}

function fitColor(score: number | null): string {
  if (score == null) return MUTED;
  if (score >= 75) return GREEN;
  if (score >= 50) return AMBER;
  return RED;
}

function stars(n: number): string {
  return "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
}

function renderStopParagraphs(rs: TourReportData["stops"][number], index: number): Paragraph[] {
  const out: Paragraph[] = [];
  const { stop, property, propertySummary, typedNotes } = rs;
  const statusText = stop.skipped ? "SKIPPED" : stop.visited ? "VISITED" : "NOT VISITED";
  const statusColor = stop.skipped ? AMBER : stop.visited ? GREEN : MUTED;

  // One property per page (skip break before the very first stop)
  if (index > 0) {
    out.push(
      new Paragraph({
        children: [new PageBreak()],
      }),
    );
  }
  out.push(
    new Paragraph({
      spacing: { before: 240, after: 60 },
      children: [
        text(`STOP ${index + 1}  ·  `, { bold: true, color: ACCENT, size: 22 }),
        text(property?.nickname ?? property?.formattedAddress ?? "Property", { bold: true, color: PRIMARY, size: 24 }),
        text(`    ${statusText}`, { bold: true, color: statusColor, size: 18 }),
      ],
    }),
  );

  if (property?.nickname && property?.formattedAddress) {
    out.push(p([text(property.formattedAddress, { italics: true, color: MUTED })]));
  }

  if (property) {
    const meta = [
      property.listPrice ? formatPrice(property.listPrice) : null,
      property.beds ? `${property.beds} bd` : null,
      property.baths ? `${property.baths} ba` : null,
      property.squareFeet ? `${property.squareFeet.toLocaleString()} sqft` : null,
    ].filter(Boolean).join("  ·  ");
    if (meta) out.push(p([text(meta, { bold: true })]));
  }

  if (rs.fitScore != null) {
    out.push(
      p([
        text("AI Fit Score: ", { bold: true, color: MUTED }),
        text(`${rs.fitScore}/100`, { bold: true, color: fitColor(rs.fitScore), size: 26 }),
        text(rs.fitScoreVerdict ? `  ·  ${rs.fitScoreVerdict}` : ""),
      ]),
    );
  }

  const ratingPairs: Array<[string, number]> = [
    ["Overall Fit", stop.overallFitRating],
    ["Buyer Interest", stop.buyerInterest],
    ["Kitchen", stop.kitchenRating],
    ["Primary Suite", stop.primarySuiteRating],
    ["Backyard", stop.backyardRating],
    ["Road Noise", stop.roadNoiseRating],
  ].filter(([, v]) => v != null) as Array<[string, number]>;

  if (ratingPairs.length > 0) {
    out.push(p([text("Ratings", { bold: true, color: MUTED })]));
    for (const [label, v] of ratingPairs) {
      out.push(p([text(`  ${label}: ${stars(v)}  (${v}/5)`)]));
    }
  }

  if (rs.fitScorePositives.length > 0) {
    out.push(p([text("Positives", { bold: true, color: GREEN })]));
    out.push(...bulletList(rs.fitScorePositives));
  }
  if (rs.fitScoreNegatives.length > 0) {
    out.push(p([text("Concerns", { bold: true, color: RED })]));
    out.push(...bulletList(rs.fitScoreNegatives));
  }

  if (stop.quickTags && stop.quickTags.length > 0) {
    out.push(
      p([
        text("Quick tags: ", { bold: true, color: MUTED }),
        text(stop.quickTags.join("  ·  "), { color: ACCENT }),
      ]),
    );
  }

  const flags: string[] = [];
  if (stop.followUpFlag) flags.push("Follow-up flagged");
  if (stop.revisitFlag) flags.push("Second look requested");
  if (flags.length > 0) out.push(p([text(flags.join("  ·  "), { bold: true, color: AMBER })]));

  if (stop.skipped && stop.skipReason) {
    out.push(
      p([
        text("Skip reason: ", { bold: true, color: AMBER }),
        text(`${stop.skipReason.replace(/_/g, " ")}${stop.skipNotes ? ` — ${stop.skipNotes}` : ""}`),
      ]),
    );
  }

  if (propertySummary?.summaryText) {
    out.push(p([text("AI property summary", { bold: true, color: MUTED })]));
    out.push(p(propertySummary.summaryText));
  }

  if (rs.debriefSummary || rs.debriefTranscript) {
    out.push(p([text("Buyer debrief", { bold: true, color: MUTED })]));
    if (rs.debriefSummary) out.push(p(rs.debriefSummary));
    if (rs.debriefTranscript && !rs.debriefSummary) {
      out.push(p([text(`"${rs.debriefTranscript}"`, { italics: true, color: MUTED })]));
    }
  }

  if (typedNotes.length > 0) {
    out.push(p([text("Notes", { bold: true, color: MUTED })]));
    out.push(...bulletList(typedNotes));
  }

  out.push(hr());
  return out;
}

export async function renderTourReportDocx(data: TourReportData): Promise<Buffer> {
  const { tour, buyer, agentName, stops, tourSummary, crossTourRollup } = data;
  const visited = stops.filter(s => s.stop.visited && !s.stop.skipped).length;
  const skipped = stops.filter(s => s.stop.skipped).length;
  const followUps = stops.filter(s => s.stop.followUpFlag).length;
  const revisits = stops.filter(s => s.stop.revisitFlag).length;

  const children: Paragraph[] = [];

  // Header
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [text("TOURFLOW · TOUR REPORT", { bold: true, color: ACCENT, size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [text(tour.title, { bold: true, color: PRIMARY, size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        text(
          [
            buyer?.name ? `Buyer: ${buyer.name}` : null,
            fmtDate(tour.date),
            agentName ? `Agent: ${agentName}` : null,
          ].filter(Boolean).join("   ·   "),
          { color: MUTED },
        ),
      ],
    }),
    hr(),
  );

  // Overview
  children.push(heading("Tour Overview"));
  children.push(
    p([
      text(`${stops.length}`, { bold: true, color: PRIMARY, size: 28 }), text(" stops    "),
      text(`${visited}`, { bold: true, color: GREEN, size: 28 }), text(" visited    "),
      text(`${followUps}`, { bold: true, color: AMBER, size: 28 }), text(" follow-ups    "),
      text(`${revisits}`, { bold: true, color: ACCENT, size: 28 }), text(" second looks"),
    ]),
  );
  if (skipped > 0) children.push(p([text(`${skipped} stop${skipped === 1 ? "" : "s"} skipped`, { color: MUTED })]));
  if (buyer && (buyer.email || buyer.phone)) {
    children.push(p([text(`Buyer contact: ${[buyer.email, buyer.phone].filter(Boolean).join(" · ")}`, { color: MUTED })]));
  }
  if (tour.startAddress) children.push(p([text(`Start: ${tour.startAddress}`, { color: MUTED })]));

  // Tour summary
  if (tourSummary) {
    children.push(heading("AI Tour Summary"));
    if (tourSummary.summaryText) children.push(p(tourSummary.summaryText));
    const blocks: Array<[string, string[] | null]> = [
      ["Top homes to consider", tourSummary.topHomes ?? null],
      ["Homes to eliminate", tourSummary.homesToEliminate ?? null],
      ["Buyer preferences observed", tourSummary.buyerPreferences ?? null],
      ["Suggested next actions", tourSummary.nextActions ?? null],
    ];
    for (const [label, items] of blocks) {
      if (items && items.length > 0) {
        children.push(p([text(label, { bold: true })]));
        children.push(...bulletList(items));
      }
    }
  }

  // Cross-tour rollup
  if (crossTourRollup) {
    children.push(heading(`Buyer Preference Rollup · ${crossTourRollup.totalCompletedTours} Completed Tours`));
    if (crossTourRollup.preferenceProfile) {
      try {
        const parsed = JSON.parse(crossTourRollup.preferenceProfile) as { summary?: string };
        if (parsed.summary) children.push(p(parsed.summary));
      } catch {
        children.push(p(crossTourRollup.preferenceProfile));
      }
    }
    if (crossTourRollup.recurringPositives.length > 0) {
      children.push(p([text("Recurring positives across tours", { bold: true, color: GREEN })]));
      children.push(...bulletList(crossTourRollup.recurringPositives));
    }
    if (crossTourRollup.recurringConcerns.length > 0) {
      children.push(p([text("Recurring concerns across tours", { bold: true, color: RED })]));
      children.push(...bulletList(crossTourRollup.recurringConcerns));
    }
  }

  // Properties
  children.push(heading("Properties Visited"));
  stops.forEach((s, i) => children.push(...renderStopParagraphs(s, i)));

  const contactParts: string[] = [];
  if (agentName) contactParts.push(agentName);
  if (data.agentEmail) contactParts.push(data.agentEmail);
  if (data.agentPhone) contactParts.push(data.agentPhone);
  const footerLine = contactParts.length > 0
    ? `Prepared by ${contactParts.join(" · ")}`
    : `TourFlow · ${tour.title}`;

  const doc = new Document({
    creator: "TourFlow",
    title: `Tour Report — ${tour.title}`,
    description: "Real estate tour report",
    sections: [{
      children,
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [text(footerLine, { color: MUTED, size: 16 })],
            }),
          ],
        }),
      },
    }],
  });

  return Packer.toBuffer(doc);
}
