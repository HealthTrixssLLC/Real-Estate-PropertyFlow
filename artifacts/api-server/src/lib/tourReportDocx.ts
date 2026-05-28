import {
  AlignmentType,
  Document,
  Footer,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
  BorderStyle,
} from "docx";
import { type TourReportData, formatPrice } from "./tourReportData";

const FONT = "Calibri";

const PRIMARY = "0F172A";
const ACCENT  = "2563EB";
const MUTED   = "64748B";
const GREEN   = "059669";
const RED     = "DC2626";
const AMBER   = "D97706";
const BORDER  = "CBD5E1";
const WHITE   = "FFFFFF";

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
  if (score == null) return MUTED;
  if (score >= 75) return GREEN;
  if (score >= 50) return AMBER;
  return RED;
}

interface RunOpts {
  bold?:    boolean;
  italics?: boolean;
  color?:   string;
  /** half-points, e.g. 20 = 10pt */
  size?:    number;
  allCaps?: boolean;
}

function run(content: string, opts: RunOpts = {}): TextRun {
  return new TextRun({
    text:    content,
    font:    FONT,
    bold:    opts.bold,
    italics: opts.italics,
    color:   opts.color,
    size:    opts.size ?? 20,  // 10pt default
    allCaps: opts.allCaps,
  });
}

function para(
  runs: TextRun[] | string,
  opts: {
    spaceBefore?: number;
    spaceAfter?:  number;
    align?:       (typeof AlignmentType)[keyof typeof AlignmentType];
  } = {},
): Paragraph {
  return new Paragraph({
    alignment:  opts.align,
    spacing:    { before: opts.spaceBefore ?? 0, after: opts.spaceAfter ?? 80 },
    children:   typeof runs === "string" ? [run(runs)] : runs,
  });
}

function sectionHeading(content: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 60 },
    border:  { bottom: { color: ACCENT, style: BorderStyle.SINGLE, size: 10, space: 4 } },
    children: [
      run(content, { bold: true, color: ACCENT, size: 16, allCaps: true }),
    ],
  });
}

function subHeading(content: string, color = PRIMARY): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 40 },
    children: [run(content, { bold: true, color, size: 20 })],
  });
}

function divider(): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    border:  { bottom: { color: BORDER, style: BorderStyle.SINGLE, size: 4, space: 1 } },
    children: [run("")],
  });
}

function bulletItem(content: string, color = PRIMARY): Paragraph {
  return new Paragraph({
    bullet:   { level: 0 },
    spacing:  { after: 40 },
    children: [run(content, { color, size: 19 })],
  });
}

function bulletList(items: string[], color = PRIMARY): Paragraph[] {
  return items.map(item => bulletItem(item, color));
}


function labelRow(content: string): Paragraph {
  return new Paragraph({
    spacing: { before: 100, after: 30 },
    children: [run(content, { bold: true, color: MUTED, size: 16, allCaps: true })],
  });
}

function renderStopParagraphs(
  rs:     TourReportData["stops"][number],
  index:  number,
  total:  number,
): Paragraph[] {
  const out: Paragraph[] = [];
  const { stop, property, propertySummary, typedNotes } = rs;
  const statusText  = stop.skipped ? "SKIPPED" : stop.visited ? "VISITED" : "NOT VISITED";
  const statusColor = stop.skipped ? AMBER : stop.visited ? GREEN : MUTED;

  // Stop number + status pill — pageBreakBefore on first stop para (except stop 0)
  out.push(
    new Paragraph({
      pageBreakBefore: index > 0,
      spacing: { before: 0, after: 40 },
      children: [
        run(`STOP ${index + 1} OF ${total}`, { bold: true, color: ACCENT, size: 16, allCaps: true }),
        run(`   ${statusText}`, { bold: true, color: statusColor, size: 16 }),
      ],
    }),
  );

  // Property name
  const propertyName = property?.nickname ?? property?.formattedAddress ?? "Property";
  out.push(
    new Paragraph({
      spacing: { before: 0, after: 30 },
      children: [run(propertyName, { bold: true, color: PRIMARY, size: 28 })],
    }),
  );

  // Address (if nickname shown above)
  if (property?.nickname && property?.formattedAddress) {
    out.push(para([run(property.formattedAddress, { italics: true, color: MUTED, size: 18 })], { spaceAfter: 60 }));
  }

  // Property details
  if (property) {
    const meta = [
      property.listPrice  ? formatPrice(property.listPrice)              : null,
      property.beds       ? `${property.beds} bd`                        : null,
      property.baths      ? `${property.baths} ba`                       : null,
      property.squareFeet ? `${property.squareFeet.toLocaleString()} sqft` : null,
    ].filter(Boolean).join("   ·   ");
    if (meta) out.push(para([run(meta, { bold: true, size: 20 })], { spaceAfter: 80 }));
  }

  // Skip reason
  if (stop.skipped && stop.skipReason) {
    out.push(
      para([
        run("Skip reason: ", { bold: true, color: AMBER }),
        run(`${stop.skipReason.replace(/_/g, " ")}${stop.skipNotes ? ` — ${stop.skipNotes}` : ""}`, { italics: true }),
      ]),
    );
  }

  // AI Fit Score
  if (rs.fitScore != null) {
    out.push(
      new Paragraph({
        spacing: { before: 80, after: 60 },
        children: [
          run("AI Fit Score: ", { bold: true, color: MUTED }),
          run(`${rs.fitScore}/100`, { bold: true, color: fitColor(rs.fitScore), size: 24 }),
          run(rs.fitScoreVerdict ? `   ·   ${rs.fitScoreVerdict}` : "", { color: MUTED }),
        ],
      }),
    );
  }

  // Ratings — plain text "4/5" style
  const ratingPairs: Array<[string, number]> = (
    [
      ["Overall",        stop.overallFitRating],
      ["Interest",       stop.buyerInterest],
      ["Kitchen",        stop.kitchenRating],
      ["Primary Suite",  stop.primarySuiteRating],
      ["Backyard",       stop.backyardRating],
      ["Road Noise",     stop.roadNoiseRating],
    ] as Array<[string, number | null]>
  ).filter(([, v]) => v != null) as Array<[string, number]>;

  if (ratingPairs.length > 0) {
    out.push(labelRow("Ratings"));
    const ratingStr = ratingPairs.map(([k, v]) => `${k}: ${v}/5`).join("    ");
    out.push(para([run(ratingStr, { color: MUTED, size: 19 })], { spaceAfter: 60 }));
  }

  // Flags
  const flags: string[] = [];
  if (stop.followUpFlag)  flags.push("Follow-up flagged");
  if (stop.revisitFlag)   flags.push("Second look requested");
  if (flags.length > 0) {
    out.push(para([run(flags.join("   ·   "), { bold: true, color: AMBER })], { spaceAfter: 60 }));
  }

  // Quick tags
  if (stop.quickTags && stop.quickTags.length > 0) {
    out.push(para([run(stop.quickTags.join("  ·  "), { color: ACCENT, size: 19 })], { spaceAfter: 60 }));
  }

  // Strengths / Concerns from fit score
  if (rs.fitScorePositives.length > 0) {
    out.push(subHeading("Strengths", GREEN));
    out.push(...bulletList(rs.fitScorePositives));
  }
  if (rs.fitScoreNegatives.length > 0) {
    out.push(subHeading("Concerns", RED));
    out.push(...bulletList(rs.fitScoreNegatives));
  }

  // AI Property Summary
  if (propertySummary?.summaryText) {
    out.push(labelRow("AI Property Summary"));
    out.push(para(propertySummary.summaryText));
    const extras: Array<[string, string[]]> = [
      ["Positives",            propertySummary.positives ?? []],
      ["Concerns",             propertySummary.negatives ?? []],
      ["Questions for Seller", propertySummary.questions ?? []],
    ];
    for (const [lbl, items] of extras) {
      if (items.length > 0) {
        out.push(subHeading(lbl, MUTED));
        out.push(...bulletList(items));
      }
    }
  }

  // Buyer debrief
  if (rs.debriefSummary || rs.debriefTranscript) {
    out.push(labelRow("Buyer Debrief"));
    if (rs.debriefSummary) {
      out.push(para(rs.debriefSummary));
    } else if (rs.debriefTranscript) {
      out.push(para([run(`"${rs.debriefTranscript}"`, { italics: true, color: MUTED })]));
    }
  }

  // Notes
  if (typedNotes.length > 0) {
    out.push(labelRow("Notes"));
    out.push(...bulletList(typedNotes));
  }

  out.push(divider());
  return out;
}

export async function renderTourReportDocx(data: TourReportData): Promise<Buffer> {
  const { tour, buyer, agentName, stops, tourSummary, crossTourRollup } = data;
  const visited   = stops.filter(s => s.stop.visited && !s.stop.skipped).length;
  const skipped   = stops.filter(s => s.stop.skipped).length;
  const followUps = stops.filter(s => s.stop.followUpFlag).length;
  const revisits  = stops.filter(s => s.stop.revisitFlag).length;

  const children: Paragraph[] = [];

  // ── Cover ─────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing:   { before: 0, after: 40 },
      children:  [run("TOURFLOW  ·  TOUR REPORT", { bold: true, color: MUTED, size: 16, allCaps: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing:   { before: 0, after: 60 },
      children:  [run(tour.title, { bold: true, color: PRIMARY, size: 44 })],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing:   { before: 0, after: 80 },
      children: [
        run(
          [
            buyer?.name ? `Buyer: ${buyer.name}` : null,
            fmtDate(tour.date),
            agentName ? `Agent: ${agentName}` : null,
          ].filter(Boolean).join("   ·   "),
          { color: MUTED, size: 18 },
        ),
      ],
    }),
    divider(),
  );

  // ── Overview ──────────────────────────────────────────────────────────
  children.push(sectionHeading("Tour Overview"));
  children.push(
    new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [
        run(`${stops.length}`,  { bold: true, color: PRIMARY, size: 32 }), run("  Properties    ", { size: 19, color: MUTED }),
        run(`${visited}`,       { bold: true, color: GREEN,   size: 32 }), run("  Visited    ",    { size: 19, color: MUTED }),
        run(`${followUps}`,     { bold: true, color: AMBER,   size: 32 }), run("  Follow-ups    ", { size: 19, color: MUTED }),
        run(`${revisits}`,      { bold: true, color: ACCENT,  size: 32 }), run("  Second Looks",   { size: 19, color: MUTED }),
      ],
    }),
  );
  if (skipped > 0) {
    children.push(para([run(`${skipped} stop${skipped === 1 ? "" : "s"} skipped`, { color: MUTED, size: 18 })], { spaceAfter: 60 }));
  }
  if (buyer && (buyer.email || buyer.phone)) {
    children.push(para([run([buyer.email, buyer.phone].filter(Boolean).join("  ·  "), { color: MUTED, size: 18 })], { spaceAfter: 40 }));
  }
  if (tour.startAddress) {
    children.push(para([run(`Start: ${tour.startAddress}`, { color: MUTED, size: 18 })], { spaceAfter: 80 }));
  }

  // ── AI Tour Summary ───────────────────────────────────────────────────
  if (tourSummary) {
    children.push(sectionHeading("AI Tour Summary"));
    if (tourSummary.summaryText) children.push(para(tourSummary.summaryText, { spaceAfter: 80 }));
    const blocks: Array<[string, string[] | null]> = [
      ["Top Homes to Consider",      tourSummary.topHomes ?? null],
      ["Homes to Eliminate",         tourSummary.homesToEliminate ?? null],
      ["Buyer Preferences Observed", tourSummary.buyerPreferences ?? null],
      ["Suggested Next Actions",     tourSummary.nextActions ?? null],
    ];
    for (const [lbl, items] of blocks) {
      if (items && items.length > 0) {
        children.push(subHeading(lbl));
        children.push(...bulletList(items));
      }
    }
  }

  // ── Cross-tour rollup ────────────────────────────────────────────────
  if (crossTourRollup) {
    children.push(sectionHeading(`Buyer Preference Rollup  ·  ${crossTourRollup.totalCompletedTours} Completed Tours`));
    if (crossTourRollup.preferenceProfile) {
      try {
        const parsed = JSON.parse(crossTourRollup.preferenceProfile) as { summary?: string };
        if (parsed.summary) children.push(para(parsed.summary));
      } catch {
        children.push(para(crossTourRollup.preferenceProfile));
      }
    }
    if (crossTourRollup.recurringPositives.length > 0) {
      children.push(subHeading("Recurring Strengths", GREEN));
      children.push(...bulletList(crossTourRollup.recurringPositives));
    }
    if (crossTourRollup.recurringConcerns.length > 0) {
      children.push(subHeading("Recurring Concerns", RED));
      children.push(...bulletList(crossTourRollup.recurringConcerns));
    }
  }

  // ── Properties ────────────────────────────────────────────────────────
  children.push(sectionHeading("Properties Visited"));
  stops.forEach((s, i) => children.push(...renderStopParagraphs(s, i, stops.length)));

  // ── Footer ────────────────────────────────────────────────────────────
  const contactParts: string[] = [];
  if (agentName)       contactParts.push(agentName);
  if (data.agentEmail) contactParts.push(data.agentEmail);
  if (data.agentPhone) contactParts.push(data.agentPhone);
  const footerLine = contactParts.length > 0
    ? `Prepared by ${contactParts.join("  ·  ")}`
    : "TourFlow";

  const doc = new Document({
    creator:     "TourFlow",
    title:       `Tour Report — ${tour.title}`,
    description: "Real estate tour report",
    styles: {
      default: {
        document: {
          run: {
            font:  FONT,
            size:  20,
            color: PRIMARY,
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 864, bottom: 864, left: 864, right: 864 },  // ~0.75in
        },
      },
      children,
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing:   { before: 0, after: 0 },
              children: [
                run(footerLine, { color: MUTED, size: 16 }),
                run("   ·   Page ", { color: MUTED, size: 16 }),
                new TextRun({ font: FONT, color: MUTED, size: 16, children: [PageNumber.CURRENT] }),
                run(" of ", { color: MUTED, size: 16 }),
                new TextRun({ font: FONT, color: MUTED, size: 16, children: [PageNumber.TOTAL_PAGES] }),
              ],
            }),
          ],
        }),
      },
    }],
  });

  return Packer.toBuffer(doc);
}
