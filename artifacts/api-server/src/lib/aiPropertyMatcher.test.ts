import { describe, it, expect, vi, beforeEach } from "vitest";
import { aiMatchProperty } from "./aiPropertyMatcher";
import type { PropertyLookupResult } from "./propertyLookup";

vi.mock("./openaiClient", () => ({
  isOpenAiConfigured: vi.fn(() => true),
  chatCompletion: vi.fn(),
}));

import { isOpenAiConfigured, chatCompletion } from "./openaiClient";

const mockIsConfigured = isOpenAiConfigured as ReturnType<typeof vi.fn>;
const mockChat = chatCompletion as ReturnType<typeof vi.fn>;

function makeCandidate(overrides: Partial<PropertyLookupResult> = {}): PropertyLookupResult {
  return {
    source: "realtor",
    beds: 3,
    baths: 2,
    squareFeet: 1800,
    listPrice: 450000,
    mlsId: "MLS001",
    listingStatus: "active",
    listingUrl: "https://www.realtor.com/realestateandhomes-detail/123-Main-St",
    listingDate: "2024-03-01",
    lastVerifiedAt: new Date().toISOString(),
    ...overrides,
  };
}

function llmResponse(decision: {
  realtorIndex: number | null;
  redfinMatch: boolean;
  matchConfidence: "high" | "medium" | "low";
  beds?: number | null;
  baths?: number | null;
  squareFeet?: number | null;
  listPrice?: number | null;
  mlsId?: string | null;
  listingStatus?: string | null;
  listingUrl?: string | null;
  listingDate?: string | null;
  source?: "realtor" | "redfin" | null;
}): string {
  return JSON.stringify({
    realtorIndex: decision.realtorIndex,
    redfinMatch: decision.redfinMatch,
    matchConfidence: decision.matchConfidence,
    merge: {
      source: decision.source ?? (decision.realtorIndex != null ? "realtor" : decision.redfinMatch ? "redfin" : null),
      beds: decision.beds ?? null,
      baths: decision.baths ?? null,
      squareFeet: decision.squareFeet ?? null,
      listPrice: decision.listPrice ?? null,
      mlsId: decision.mlsId ?? null,
      listingStatus: decision.listingStatus ?? null,
      listingUrl: decision.listingUrl ?? null,
      listingDate: decision.listingDate ?? null,
    },
  });
}

beforeEach(() => {
  mockIsConfigured.mockReturnValue(true);
  mockChat.mockReset();
});

describe("aiMatchProperty — fallback cases", () => {
  it("returns fallback when OpenAI is not configured", async () => {
    mockIsConfigured.mockReturnValue(false);
    const result = await aiMatchProperty({
      stored: { address: "123 Main St, Dallas, TX 75201" },
      realtorCandidates: [makeCandidate()],
      redfinCandidate: null,
    });
    expect(result.fallbackUsed).toBe(true);
    expect((result as { fallbackReason: string }).fallbackReason).toMatch(/not configured/i);
  });

  it("returns fallback when there are no candidates at all", async () => {
    const result = await aiMatchProperty({
      stored: { address: "123 Main St, Dallas, TX 75201" },
      realtorCandidates: [],
      redfinCandidate: null,
    });
    expect(result.fallbackUsed).toBe(true);
    expect((result as { fallbackReason: string }).fallbackReason).toMatch(/no candidates/i);
  });

  it("returns fallback when LLM response is not valid JSON", async () => {
    mockChat.mockResolvedValue("not valid json at all");
    const result = await aiMatchProperty({
      stored: { address: "123 Main St, Dallas, TX 75201" },
      realtorCandidates: [makeCandidate()],
      redfinCandidate: null,
    });
    expect(result.fallbackUsed).toBe(true);
    expect((result as { fallbackReason: string }).fallbackReason).toMatch(/parse failed/i);
  });

  it("returns fallback when LLM response is missing required fields", async () => {
    mockChat.mockResolvedValue(JSON.stringify({ realtorIndex: 0 }));
    const result = await aiMatchProperty({
      stored: { address: "123 Main St, Dallas, TX 75201" },
      realtorCandidates: [makeCandidate()],
      redfinCandidate: null,
    });
    expect(result.fallbackUsed).toBe(true);
  });

  it("returns fallback when chatCompletion throws", async () => {
    mockChat.mockRejectedValue(new Error("network error"));
    const result = await aiMatchProperty({
      stored: { address: "123 Main St, Dallas, TX 75201" },
      realtorCandidates: [makeCandidate()],
      redfinCandidate: null,
    });
    expect(result.fallbackUsed).toBe(true);
    expect((result as { fallbackReason: string }).fallbackReason).toMatch(/network error/i);
  });
});

describe("aiMatchProperty — wrong unit number rejection", () => {
  it("rejects a candidate that is a different unit at the same building", async () => {
    mockChat.mockResolvedValue(
      llmResponse({
        realtorIndex: null,
        redfinMatch: false,
        matchConfidence: "low",
        source: null,
      }),
    );

    const wrongUnitCandidate = makeCandidate({
      listingUrl: "https://www.realtor.com/realestateandhomes-detail/500-Main-St-Apt-2B",
    });

    const result = await aiMatchProperty({
      stored: { address: "500 Main St Apt 3A, Dallas, TX 75201", beds: 2, baths: 1, sqft: 950 },
      realtorCandidates: [wrongUnitCandidate],
      redfinCandidate: null,
    });

    expect(result.fallbackUsed).toBe(false);
    if (!result.fallbackUsed) {
      expect(result.realtorIndex).toBeNull();
      expect(result.redfinMatch).toBe(false);
      expect(result.matchConfidence).toBe("low");
      expect(result.mergedResult.source).toBeNull();
      expect(result.mergedResult.beds).toBeNull();
    }
  });

  it("includes stored unit context in the prompt so the LLM can discriminate", async () => {
    const promptSpy = vi.fn((args: { messages: Array<{ content: string }> }) =>
      Promise.resolve(
        llmResponse({ realtorIndex: null, redfinMatch: false, matchConfidence: "low", source: null }),
      ),
    );
    mockChat.mockImplementation(promptSpy);

    await aiMatchProperty({
      stored: { address: "500 Main St Apt 3A, Dallas, TX 75201", beds: 2, baths: 1, sqft: 950 },
      realtorCandidates: [makeCandidate()],
      redfinCandidate: null,
    });

    const prompt: string = promptSpy.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("500 Main St Apt 3A");
    expect(prompt).toContain("Beds: 2");
    expect(prompt).toContain("Baths: 1");
    expect(prompt).toContain("Sq ft: 950");
  });
});

describe("aiMatchProperty — nearby-but-different address rejection", () => {
  it("rejects a candidate at a nearby but different street number", async () => {
    mockChat.mockResolvedValue(
      llmResponse({
        realtorIndex: null,
        redfinMatch: false,
        matchConfidence: "low",
        source: null,
      }),
    );

    const nearbyCandidate = makeCandidate({
      listingUrl: "https://www.realtor.com/realestateandhomes-detail/124-Main-St",
    });

    const result = await aiMatchProperty({
      stored: { address: "123 Main St, Dallas, TX 75201", beds: 3, baths: 2, sqft: 1800 },
      realtorCandidates: [nearbyCandidate],
      redfinCandidate: null,
    });

    expect(result.fallbackUsed).toBe(false);
    if (!result.fallbackUsed) {
      expect(result.realtorIndex).toBeNull();
      expect(result.matchConfidence).toBe("low");
    }
  });

  it("rejects redfin candidate at a similar-but-different address", async () => {
    mockChat.mockResolvedValue(
      llmResponse({
        realtorIndex: null,
        redfinMatch: false,
        matchConfidence: "low",
        source: null,
      }),
    );

    const nearbyRedfin = makeCandidate({
      source: "redfin",
      listingUrl: "https://www.redfin.com/home/TX/Dallas/456-Elm-St",
    });

    const result = await aiMatchProperty({
      stored: { address: "789 Elm St, Dallas, TX 75201" },
      realtorCandidates: [],
      redfinCandidate: nearbyRedfin,
    });

    expect(result.fallbackUsed).toBe(false);
    if (!result.fallbackUsed) {
      expect(result.redfinMatch).toBe(false);
      expect(result.mergedResult.source).toBeNull();
    }
  });
});

describe("aiMatchProperty — successful match", () => {
  it("returns merged result with high confidence for an exact address match", async () => {
    mockChat.mockResolvedValue(
      llmResponse({
        realtorIndex: 0,
        redfinMatch: false,
        matchConfidence: "high",
        beds: 4,
        baths: 3,
        squareFeet: 2500,
        listPrice: 620000,
        mlsId: "MLS123",
        listingStatus: "active",
        listingUrl: "https://www.realtor.com/realestateandhomes-detail/4920-Naphill-Rd",
        listingDate: "2024-01-15",
        source: "realtor",
      }),
    );

    const candidate = makeCandidate({
      beds: 4,
      baths: 3,
      squareFeet: 2500,
      listPrice: 620000,
      mlsId: "MLS123",
    });

    const result = await aiMatchProperty({
      stored: { address: "4920 Naphill Rd, McKinney, TX 75070", beds: 4, baths: 3, sqft: 2500 },
      realtorCandidates: [candidate],
      redfinCandidate: null,
    });

    expect(result.fallbackUsed).toBe(false);
    if (!result.fallbackUsed) {
      expect(result.realtorIndex).toBe(0);
      expect(result.matchConfidence).toBe("high");
      expect(result.mergedResult.beds).toBe(4);
      expect(result.mergedResult.baths).toBe(3);
      expect(result.mergedResult.listPrice).toBe(620000);
      expect(result.mergedResult.source).toBe("realtor");
      expect(result.mergedResult.lastVerifiedAt).toBeTruthy();
    }
  });

  it("picks redfin candidate when LLM selects it over no realtor match", async () => {
    mockChat.mockResolvedValue(
      llmResponse({
        realtorIndex: null,
        redfinMatch: true,
        matchConfidence: "medium",
        beds: 3,
        baths: 2,
        squareFeet: 1600,
        listPrice: 380000,
        listingStatus: "active",
        source: "redfin",
      }),
    );

    const redfinCandidate = makeCandidate({
      source: "redfin",
      beds: 3,
      baths: 2,
      squareFeet: 1600,
      listPrice: 380000,
    });

    const result = await aiMatchProperty({
      stored: { address: "321 Oak Ave, Plano, TX 75025" },
      realtorCandidates: [],
      redfinCandidate,
    });

    expect(result.fallbackUsed).toBe(false);
    if (!result.fallbackUsed) {
      expect(result.realtorIndex).toBeNull();
      expect(result.redfinMatch).toBe(true);
      expect(result.matchConfidence).toBe("medium");
      expect(result.mergedResult.source).toBe("redfin");
      expect(result.mergedResult.listPrice).toBe(380000);
    }
  });

  it("includes lat/lng hint in prompt when stored coordinates are available", async () => {
    const promptSpy = vi.fn(() =>
      Promise.resolve(
        llmResponse({ realtorIndex: 0, redfinMatch: false, matchConfidence: "high", beds: 3, baths: 2, squareFeet: 1800, listPrice: 450000, source: "realtor" }),
      ),
    );
    mockChat.mockImplementation(promptSpy);

    await aiMatchProperty({
      stored: {
        address: "123 Main St, Dallas, TX 75201",
        lat: 32.7767,
        lng: -96.797,
        beds: 3,
        baths: 2,
        sqft: 1800,
      },
      realtorCandidates: [makeCandidate()],
      redfinCandidate: null,
    });

    const callArgs = (promptSpy.mock.calls[0] as unknown as [{ messages: Array<{ content: string }> }])[0];
    const prompt: string = callArgs.messages[0]!.content;
    expect(prompt).toContain("32.7767");
    expect(prompt).toContain("-96.797");
  });
});
