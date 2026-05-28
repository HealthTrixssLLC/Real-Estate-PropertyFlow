import {
  db,
  toursTable,
  tourStopsTable,
  propertiesTable,
  propertySummariesTable,
  tourSummariesTable,
  buyersTable,
  voiceNotesTable,
  debriefVoiceNotesTable,
  type Tour,
  type TourStop,
  type Property,
  type PropertySummary,
  type TourSummary,
  type Buyer,
} from "@workspace/db";
import { and, eq, inArray, desc } from "drizzle-orm";

export interface ReportStop {
  stop: TourStop;
  property: Property | null;
  propertySummary: PropertySummary | null;
  typedNotes: string[];
  debriefTranscript: string | null;
  debriefSummary: string | null;
  fitScore: number | null;
  fitScoreVerdict: string | null;
  fitScorePositives: string[];
  fitScoreNegatives: string[];
}

export interface CrossTourRollup {
  totalCompletedTours: number;
  recurringPositives: string[];
  recurringConcerns: string[];
  preferenceProfile: string | null;
}

export interface TourReportData {
  tour: Tour;
  buyer: Buyer | null;
  agentName: string | null;
  stops: ReportStop[];
  tourSummary: TourSummary | null;
  crossTourRollup: CrossTourRollup | null;
  generatedAt: Date;
}

export async function assembleTourReportData(tourId: string, agentName?: string | null): Promise<TourReportData | null> {
  const [tour] = await db.select().from(toursTable).where(eq(toursTable.id, tourId)).limit(1);
  if (!tour) return null;

  const buyer = tour.buyerId
    ? (await db.select().from(buyersTable).where(eq(buyersTable.id, tour.buyerId)).limit(1))[0] ?? null
    : null;

  const stops = await db
    .select()
    .from(tourStopsTable)
    .where(eq(tourStopsTable.tourId, tourId))
    .orderBy(tourStopsTable.sequence);

  const propertyIds = stops.map(s => s.propertyId);
  const properties = propertyIds.length > 0
    ? await db.select().from(propertiesTable).where(inArray(propertiesTable.id, propertyIds))
    : [];
  const propMap = new Map(properties.map(p => [p.id, p]));

  const stopIds = stops.map(s => s.id);
  const summaries = stopIds.length > 0
    ? await db.select().from(propertySummariesTable).where(inArray(propertySummariesTable.tourStopId, stopIds))
    : [];
  const summaryMap = new Map(summaries.map(ps => [ps.tourStopId, ps]));

  const voiceNotes = stopIds.length > 0
    ? await db.select().from(voiceNotesTable).where(inArray(voiceNotesTable.tourStopId, stopIds))
    : [];
  const notesByStop = new Map<string, string[]>();
  for (const vn of voiceNotes) {
    if (vn.typedNote) {
      const arr = notesByStop.get(vn.tourStopId) ?? [];
      arr.push(vn.typedNote);
      notesByStop.set(vn.tourStopId, arr);
    }
  }

  const debriefs = stopIds.length > 0
    ? await db.select().from(debriefVoiceNotesTable).where(inArray(debriefVoiceNotesTable.tourStopId, stopIds))
    : [];
  const debriefByStop = new Map(debriefs.map(d => [d.tourStopId, d]));

  const reportStops: ReportStop[] = stops.map(stop => {
    const d = debriefByStop.get(stop.id);
    return {
      stop,
      property: propMap.get(stop.propertyId) ?? null,
      propertySummary: summaryMap.get(stop.id) ?? null,
      typedNotes: notesByStop.get(stop.id) ?? [],
      debriefTranscript: d?.transcript ?? null,
      debriefSummary: d?.aiSummary ?? null,
      fitScore: d?.fitScore ?? null,
      fitScoreVerdict: d?.fitScoreVerdict ?? null,
      fitScorePositives: (d?.fitScorePositives as string[] | null | undefined) ?? [],
      fitScoreNegatives: (d?.fitScoreNegatives as string[] | null | undefined) ?? [],
    };
  });

  const [tourSummary] = await db
    .select()
    .from(tourSummariesTable)
    .where(eq(tourSummariesTable.tourId, tourId))
    .orderBy(desc(tourSummariesTable.generatedAt))
    .limit(1);

  let crossTourRollup: CrossTourRollup | null = null;
  if (buyer) {
    const buyerTours = await db
      .select()
      .from(toursTable)
      .where(and(eq(toursTable.buyerId, buyer.id), eq(toursTable.status, "completed")));
    if (buyerTours.length >= 2) {
      const otherTourIds = buyerTours.filter(t => t.id !== tourId).map(t => t.id);
      const otherSummaries = otherTourIds.length > 0
        ? await db.select().from(tourSummariesTable).where(inArray(tourSummariesTable.tourId, otherTourIds))
        : [];
      const positivesCounter = new Map<string, number>();
      const concernsCounter = new Map<string, number>();
      for (const s of otherSummaries) {
        for (const p of s.buyerPreferences ?? []) {
          const k = p.toLowerCase().trim();
          if (k) positivesCounter.set(k, (positivesCounter.get(k) ?? 0) + 1);
        }
        for (const h of s.homesToEliminate ?? []) {
          const k = h.toLowerCase().trim();
          if (k) concernsCounter.set(k, (concernsCounter.get(k) ?? 0) + 1);
        }
      }
      const recurringPositives = [...positivesCounter.entries()]
        .filter(([, n]) => n >= 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k]) => k);
      const recurringConcerns = [...concernsCounter.entries()]
        .filter(([, n]) => n >= 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k]) => k);
      crossTourRollup = {
        totalCompletedTours: buyerTours.length,
        recurringPositives,
        recurringConcerns,
        preferenceProfile: buyer.preferenceProfile ?? null,
      };
    }
  }

  return {
    tour,
    buyer,
    agentName: agentName ?? null,
    stops: reportStops,
    tourSummary: tourSummary ?? null,
    crossTourRollup,
    generatedAt: new Date(),
  };
}

export function formatPrice(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}
