import { randomUUID } from "crypto";
import {
  db,
  propertySummariesTable,
  type Property,
  type PropertySummary,
  type TourStop,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateText } from "./ai";
import { aiConfig } from "./aiConfig";

export interface PropertySummaryInput {
  stop: TourStop;
  property: Property | null;
  notes: string[];
}

function buildPropertySummaryPrompt({ stop, property, notes }: PropertySummaryInput): string {
  const ratings = [
    stop.overallFitRating != null ? `Overall fit: ${stop.overallFitRating}/5` : null,
    stop.buyerInterest != null ? `Buyer interest: ${stop.buyerInterest}/5` : null,
    stop.kitchenRating != null ? `Kitchen: ${stop.kitchenRating}/5` : null,
    stop.primarySuiteRating != null ? `Primary suite: ${stop.primarySuiteRating}/5` : null,
    stop.backyardRating != null ? `Backyard: ${stop.backyardRating}/5` : null,
    stop.roadNoiseRating != null ? `Road noise: ${stop.roadNoiseRating}/5` : null,
  ].filter(Boolean).join(", ");

  return `You are a real estate agent assistant analyzing a property showing.

Property: ${property?.formattedAddress ?? "Unknown address"}
Ratings: ${ratings || "None recorded"}
${property?.beds ? `Beds: ${property.beds}, Baths: ${property.baths}, Sq Ft: ${property.squareFeet}` : ""}
${property?.listPrice ? `List Price: $${property.listPrice.toLocaleString()}` : ""}
Notes from showing: ${notes.join("\n") || "None recorded"}
Tags: ${stop.quickTags?.join(", ") || "None"}
Follow-up flag: ${stop.followUpFlag ? "Yes" : "No"}
Revisit flag: ${stop.revisitFlag ? "Yes" : "No"}

Generate a concise property summary with:
1. summaryText: 2-3 sentence overview
2. positives: list of pros (max 5)
3. negatives: list of cons (max 5)
4. questions: follow-up questions for listing agent (max 3)

Return as JSON with those exact keys.`;
}

/**
 * Shared property-summary pipeline used by both the on-demand summarize route
 * and the report assembly auto-fill path. Generates a summary via the configured
 * LLM, parses the JSON response, replaces any existing summary row for the stop,
 * and returns the persisted row.
 */
export async function generateAndStorePropertySummary(
  input: PropertySummaryInput,
): Promise<PropertySummary | null> {
  const prompt = buildPropertySummaryPrompt(input);
  const result = await generateText(prompt, aiConfig.summarizationProvider);

  let parsed: { summaryText?: string; positives?: string[]; negatives?: string[]; questions?: string[] } = {};
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    parsed = { summaryText: result.text };
  }

  await db.delete(propertySummariesTable).where(eq(propertySummariesTable.tourStopId, input.stop.id));
  const [row] = await db
    .insert(propertySummariesTable)
    .values({
      id: randomUUID(),
      tourStopId: input.stop.id,
      summaryText: parsed.summaryText ?? result.text,
      positives: parsed.positives ?? [],
      negatives: parsed.negatives ?? [],
      questions: parsed.questions ?? [],
      provider: result.provider,
      generatedAt: new Date(),
    })
    .returning();
  return row ?? null;
}

/**
 * Best-effort wrapper: never throws, returns null on failure. Used by the
 * report assembly path where AI unavailability must not block report rendering.
 */
export async function tryGenerateAndStorePropertySummary(
  input: PropertySummaryInput,
): Promise<PropertySummary | null> {
  try {
    return await generateAndStorePropertySummary(input);
  } catch {
    return null;
  }
}
