import { logger } from "./logger";
import { chatCompletion, isOpenAiConfigured } from "./openaiClient";
import type { PropertyLookupResult } from "./propertyLookup";

export interface StoredPropertyContext {
  address: string;
  lat?: number | null;
  lng?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
}

export interface AiMatcherInput {
  stored: StoredPropertyContext;
  realtorCandidates: PropertyLookupResult[];
  redfinCandidate: PropertyLookupResult | null;
}

export interface AiMatchDecision {
  realtorIndex: number | null;
  redfinMatch: boolean;
  mergedResult: PropertyLookupResult;
  matchConfidence: "high" | "medium" | "low";
  fallbackUsed: false;
}

export interface AiFallbackDecision {
  fallbackUsed: true;
  fallbackReason: string;
}

export type AiMatchResult = AiMatchDecision | AiFallbackDecision;

interface LlmDecision {
  realtorIndex: number | null;
  redfinMatch: boolean;
  matchConfidence: "high" | "medium" | "low";
  merge: {
    beds: number | null;
    baths: number | null;
    squareFeet: number | null;
    listPrice: number | null;
    mlsId: string | null;
    listingStatus: "active" | "recently_sold" | "off_market" | "unknown" | null;
    listingUrl: string | null;
    listingDate: string | null;
    source: "realtor" | "redfin" | null;
  };
}

function buildPrompt(input: AiMatcherInput): string {
  const { stored, realtorCandidates, redfinCandidate } = input;

  const storedDesc = [
    `Address: ${stored.address}`,
    stored.lat != null && stored.lng != null ? `Coordinates: (${stored.lat}, ${stored.lng})` : null,
    stored.beds != null ? `Beds: ${stored.beds}` : null,
    stored.baths != null ? `Baths: ${stored.baths}` : null,
    stored.sqft != null ? `Sq ft: ${stored.sqft}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const realtorDesc = realtorCandidates.length
    ? realtorCandidates
        .map((c, i) => {
          const fields = [
            `  url: ${c.listingUrl ?? "n/a"}`,
            `  beds: ${c.beds ?? "n/a"}, baths: ${c.baths ?? "n/a"}, sqft: ${c.squareFeet ?? "n/a"}`,
            `  listPrice: ${c.listPrice ?? "n/a"}, status: ${c.listingStatus ?? "n/a"}`,
            `  mlsId: ${c.mlsId ?? "n/a"}, listDate: ${c.listingDate ?? "n/a"}`,
          ].join("\n");
          return `Realtor candidate ${i}:\n${fields}`;
        })
        .join("\n\n")
    : "No Realtor.com candidates";

  const redfinDesc = redfinCandidate
    ? [
        `  url: ${redfinCandidate.listingUrl ?? "n/a"}`,
        `  beds: ${redfinCandidate.beds ?? "n/a"}, baths: ${redfinCandidate.baths ?? "n/a"}, sqft: ${redfinCandidate.squareFeet ?? "n/a"}`,
        `  listPrice: ${redfinCandidate.listPrice ?? "n/a"}, status: ${redfinCandidate.listingStatus ?? "n/a"}`,
        `  mlsId: ${redfinCandidate.mlsId ?? "n/a"}, listDate: ${redfinCandidate.listingDate ?? "n/a"}`,
      ].join("\n")
    : "No Redfin candidate";

  return `You are a real estate data reconciliation assistant. Your task is to verify whether scraped listing candidates correspond to a specific stored property, then produce a merged data record.

STORED PROPERTY:
${storedDesc}

SCRAPED CANDIDATES:
${realtorDesc}

Redfin candidate:
${redfinDesc}

INSTRUCTIONS:
1. Determine which Realtor.com candidate (if any) is the same physical property as the stored property. A match requires the address (including unit number) to correspond to the same property — small formatting differences are fine, but a different unit or nearby address is NOT a match. Set realtorIndex to the 0-based index of the matching candidate, or null if none match.
2. Determine if the Redfin candidate matches the stored property by the same criteria. Set redfinMatch to true only if it genuinely matches.
3. From the matched candidates only, produce a merged record choosing the best available value for each field (prefer non-null, prefer "active" status, prefer Realtor for mlsId, prefer Redfin for price when both present).
4. Set matchConfidence: "high" if beds/baths/sqft are consistent and the address clearly matches, "medium" if partially consistent, "low" if only one weak signal matches.
5. If NO candidates match the stored property, set realtorIndex: null, redfinMatch: false, and matchConfidence: "low". Set all merge fields to null and source to null.

Respond ONLY with a JSON object — no markdown fences, no explanation. Schema:
{
  "realtorIndex": <number|null>,
  "redfinMatch": <boolean>,
  "matchConfidence": <"high"|"medium"|"low">,
  "merge": {
    "source": <"realtor"|"redfin"|null>,
    "beds": <number|null>,
    "baths": <number|null>,
    "squareFeet": <number|null>,
    "listPrice": <number|null>,
    "mlsId": <string|null>,
    "listingStatus": <"active"|"recently_sold"|"off_market"|"unknown"|null>,
    "listingUrl": <string|null>,
    "listingDate": <string|null>
  }
}`;
}

function parseLlmResponse(raw: string): LlmDecision | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<LlmDecision>;

    if (
      !("realtorIndex" in parsed) ||
      !("redfinMatch" in parsed) ||
      !("matchConfidence" in parsed) ||
      !parsed.merge
    ) {
      return null;
    }

    const confidence = parsed.matchConfidence;
    if (confidence !== "high" && confidence !== "medium" && confidence !== "low") return null;

    return {
      realtorIndex: typeof parsed.realtorIndex === "number" ? parsed.realtorIndex : null,
      redfinMatch: Boolean(parsed.redfinMatch),
      matchConfidence: confidence,
      merge: {
        beds: parsed.merge.beds ?? null,
        baths: parsed.merge.baths ?? null,
        squareFeet: parsed.merge.squareFeet ?? null,
        listPrice: parsed.merge.listPrice ?? null,
        mlsId: parsed.merge.mlsId ?? null,
        listingStatus: parsed.merge.listingStatus ?? null,
        listingUrl: parsed.merge.listingUrl ?? null,
        listingDate: parsed.merge.listingDate ?? null,
        source: parsed.merge.source ?? null,
      },
    };
  } catch {
    return null;
  }
}

export async function aiMatchProperty(input: AiMatcherInput): Promise<AiMatchResult> {
  if (!isOpenAiConfigured()) {
    return { fallbackUsed: true, fallbackReason: "OpenAI not configured" };
  }

  const hasAnyCandidates = input.realtorCandidates.length > 0 || input.redfinCandidate != null;
  if (!hasAnyCandidates) {
    return { fallbackUsed: true, fallbackReason: "no candidates to evaluate" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const prompt = buildPrompt(input);
    const raw = await chatCompletion({
      model: "gpt-5-nano",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 512,
      response_format: { type: "json_object" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const decision = parseLlmResponse(raw);
    if (!decision) {
      logger.warn({ rawResponse: raw.slice(0, 500) }, "ai_property_matcher_parse_failed");
      return { fallbackUsed: true, fallbackReason: "LLM response parse failed" };
    }

    const lastVerifiedAt = new Date().toISOString();
    const mergedResult: PropertyLookupResult = {
      source: decision.merge.source,
      beds: decision.merge.beds,
      baths: decision.merge.baths,
      squareFeet: decision.merge.squareFeet,
      listPrice: decision.merge.listPrice,
      mlsId: decision.merge.mlsId,
      listingStatus: decision.merge.listingStatus,
      listingUrl: decision.merge.listingUrl,
      listingDate: decision.merge.listingDate,
      lastVerifiedAt,
    };

    return {
      realtorIndex: decision.realtorIndex,
      redfinMatch: decision.redfinMatch,
      mergedResult,
      matchConfidence: decision.matchConfidence,
      fallbackUsed: false,
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ error: message }, "ai_property_matcher_error");
    return { fallbackUsed: true, fallbackReason: message };
  }
}
