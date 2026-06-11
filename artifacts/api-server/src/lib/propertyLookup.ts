import { logger } from "./logger";
import { aiMatchProperty } from "./aiPropertyMatcher";
import {
  resolveRealtorAddress,
  fetchRealtorGraphql,
  findRealtorPropertyPage,
  fetchAndParseRealtorDetailPage,
  mapRealtorStatus,
  calculateBaths,
  makeAbsoluteRealtorUrl,
  detailUrlAddressMatches,
} from "./realtorProvider";

export interface PropertyLookupResult {
  source: "realtor" | "redfin" | null;
  beds?: number | null;
  baths?: number | null;
  squareFeet?: number | null;
  listPrice?: number | null;
  mlsId?: string | null;
  listingStatus: "active" | "recently_sold" | "off_market" | "unknown" | null;
  listingUrl: string | null;
  listingDate: string | null;
  lastVerifiedAt: string;
  matchConfidence?: "high" | "medium" | "low" | null;
}

interface ProviderOutcome {
  result: PropertyLookupResult | null;
  candidates: PropertyLookupResult[];
  searchQuery: string;
  matchCount: number;
  error?: string;
}

const CONFIDENCE: Record<string, number> = {
  active: 4,
  recently_sold: 3,
  off_market: 2,
  unknown: 1,
};

function confidenceOf(r: PropertyLookupResult | null): number {
  if (!r) return 0;
  return CONFIDENCE[r.listingStatus ?? ""] ?? 1;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ABBREV_MAP: [RegExp, string][] = [
  [/\brd\b/g, "road"],
  [/\bst\b/g, "street"],
  [/\bave\b/g, "avenue"],
  [/\bblvd\b/g, "boulevard"],
  [/\bdr\b/g, "drive"],
  [/\bct\b/g, "court"],
  [/\bln\b/g, "lane"],
  [/\bpkwy\b/g, "parkway"],
  [/\bpl\b/g, "place"],
  [/\bwy\b/g, "way"],
  [/\bhwy\b/g, "highway"],
  [/\bcir\b/g, "circle"],
  [/\bter\b/g, "terrace"],
];

export function normalizeAddress(raw: string): string {
  let s = raw.toLowerCase().trim();
  for (const [pattern, replacement] of ABBREV_MAP) {
    s = s.replace(pattern, replacement);
  }
  s = s.replace(/\b(\d{5})-\d{4}\b/g, "$1");
  s = s.replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

function mapRedfinStatus(
  rawStatus: string | undefined | null,
  isSold: boolean,
  listPrice: number | null,
): PropertyLookupResult["listingStatus"] {
  if (rawStatus) {
    const lower = rawStatus.toLowerCase();
    if (
      lower.includes("active") ||
      lower.includes("for_sale") ||
      lower.includes("for sale") ||
      lower === "fs" ||
      lower === "fs_active"
    ) {
      return "active";
    }
    if (lower.includes("sold") || lower === "s" || lower === "rs") {
      return "recently_sold";
    }
    if (
      lower.includes("off") ||
      lower.includes("withdrawn") ||
      lower.includes("expired") ||
      lower === "d"
    ) {
      return "off_market";
    }
    if (lower.includes("pending") || lower.includes("contract")) {
      return "active";
    }
    return "unknown";
  }
  return isSold ? "recently_sold" : listPrice != null ? "active" : "unknown";
}

export async function lookupRealtor(originalAddress: string): Promise<ProviderOutcome> {
  const now = new Date().toISOString();
  const empty: ProviderOutcome = {
    result: null,
    candidates: [],
    searchQuery: originalAddress,
    matchCount: 0,
  };

  const suggestion = await resolveRealtorAddress(originalAddress);
  if (!suggestion?.mpr_id) {
    logger.info(
      { originalAddress, stage: "autocomplete", reason: "no_match" },
      "realtor_lookup_complete",
    );
    return { ...empty, error: "autocomplete_no_match" };
  }

  const mprId = suggestion.mpr_id;

  const graphqlResult = await fetchRealtorGraphql(mprId, originalAddress);
  const isGraphqlFailure =
    "stage" in graphqlResult && "reason" in graphqlResult;

  if (!isGraphqlFailure) {
    const hit = graphqlResult;
    const listPrice = hit.list_price ?? null;
    const beds = hit.beds ?? null;
    const baths = calculateBaths(hit.baths_full, hit.baths_half);
    const squareFeet = hit.sqft ?? null;
    const mlsId = hit.property_id ?? mprId;
    const rawStatus = hit.status ?? null;

    const listingStatus =
      rawStatus != null
        ? mapRealtorStatus(rawStatus)
        : "unknown";

    const listingUrl = makeAbsoluteRealtorUrl(hit.permalink);
    const listingDate = hit.list_date ?? null;

    if (
      beds != null ||
      baths != null ||
      squareFeet != null ||
      listPrice != null ||
      mlsId != null
    ) {
      const candidate: PropertyLookupResult = {
        source: "realtor",
        beds,
        baths,
        squareFeet,
        listPrice,
        mlsId,
        listingStatus,
        listingUrl,
        listingDate,
        lastVerifiedAt: now,
      };

      logger.info(
        {
          originalAddress,
          stage: "hulk",
          listingStatus,
          listPrice,
          beds,
          baths,
          squareFeet,
        },
        "realtor_lookup_complete",
      );

      return {
        result: candidate,
        candidates: [candidate],
        searchQuery: originalAddress,
        matchCount: 1,
      };
    }
  }

  logger.info(
    {
      originalAddress,
      stage: "html_fallback",
      graphqlFailure: isGraphqlFailure
        ? (graphqlResult as { reason: string }).reason
        : "no_data",
    },
    "realtor_lookup_complete",
  );

  const pageUrl = await findRealtorPropertyPage(originalAddress);
  if (!pageUrl) {
    return { ...empty, error: "html_fallback_no_page" };
  }

  if (!detailUrlAddressMatches(pageUrl, originalAddress)) {
    logger.warn(
      { originalAddress, pageUrl, stage: "html_fallback" },
      "realtor_lookup_complete",
    );
    return { ...empty, error: "html_fallback_address_mismatch" };
  }

  const parsed = await fetchAndParseRealtorDetailPage(pageUrl);
  if (!parsed) {
    return { ...empty, error: "html_fallback_parse_failed" };
  }

  const candidate: PropertyLookupResult = {
    source: "realtor",
    beds: parsed.beds,
    baths: parsed.baths,
    squareFeet: parsed.squareFeet,
    listPrice: parsed.listPrice,
    mlsId: parsed.mlsId ?? mprId,
    listingStatus: parsed.listingStatus,
    listingUrl: pageUrl,
    listingDate: parsed.listingDate,
    lastVerifiedAt: now,
  };

  return {
    result: candidate,
    candidates: [candidate],
    searchQuery: originalAddress,
    matchCount: 1,
  };
}

async function scrapeRedfinPage(
  pageUrl: string,
  isSold: boolean,
): Promise<PropertyLookupResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = await res.text();

    const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!jsonLdMatch) return null;

    let jsonLd: unknown;
    try {
      jsonLd = JSON.parse(jsonLdMatch[1]);
    } catch {
      return null;
    }

    const ld = jsonLd as {
      offers?: { price?: number | string; priceCurrency?: string };
      numberOfRooms?: number | string;
      floorSize?: { value?: number | string; unitCode?: string };
    };

    const listPrice = ld.offers?.price != null ? Number(ld.offers.price) : null;
    const beds = ld.numberOfRooms != null ? Number(ld.numberOfRooms) : null;
    const squareFeet = ld.floorSize?.value != null ? Number(ld.floorSize.value) : null;

    if (listPrice == null && beds == null && squareFeet == null) return null;

    const listingStatus = isSold ? "recently_sold" : listPrice != null ? "active" : "unknown";

    return {
      source: "redfin",
      beds: isNaN(beds as number) ? null : beds,
      baths: null,
      squareFeet: isNaN(squareFeet as number) ? null : squareFeet,
      listPrice: isNaN(listPrice as number) ? null : listPrice,
      mlsId: null,
      listingStatus,
      listingUrl: pageUrl,
      listingDate: null,
      lastVerifiedAt: new Date().toISOString(),
    };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function lookupRedfin(originalAddress: string): Promise<ProviderOutcome> {
  const encoded = encodeURIComponent(originalAddress);
  const autocompleteUrl = `https://www.redfin.com/stingray/api/search/autocomplete?location=${encoded}&v=2`;

  const controller1 = new AbortController();
  const timeout1 = setTimeout(() => controller1.abort(), 6000);
  let propertyId: string | null = null;
  let propertyUrl: string | null = null;

  try {
    const autocompleteRes = await fetch(autocompleteUrl, {
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
      signal: controller1.signal,
    });
    clearTimeout(timeout1);
    if (!autocompleteRes.ok) return { result: null, candidates: [], searchQuery: autocompleteUrl, matchCount: 0, error: `Autocomplete HTTP ${autocompleteRes.status}` };

    const text = await autocompleteRes.text();
    const json = JSON.parse(text.replace(/^{}&&/, "")) as {
      payload?: {
        sections?: Array<{
          rows?: Array<{
            id?: { type?: string; tableId?: string; url?: string };
            type?: string;
          }>;
        }>;
      };
    };

    const rows = json?.payload?.sections?.flatMap(s => s.rows ?? []) ?? [];
    const homeRow = rows.find(r => r.id?.type === "2" || r.id?.url?.includes("/home/"));
    if (!homeRow?.id) return { result: null, candidates: [], searchQuery: autocompleteUrl, matchCount: 0 };

    if (homeRow.id.tableId) {
      propertyId = homeRow.id.tableId;
    }
    if (homeRow.id.url) {
      propertyUrl = homeRow.id.url;
    }
  } catch (err: unknown) {
    clearTimeout(timeout1);
    const message = err instanceof Error ? err.message : String(err);
    return { result: null, candidates: [], searchQuery: autocompleteUrl, matchCount: 0, error: message };
  }

  if (!propertyId && !propertyUrl) return { result: null, candidates: [], searchQuery: autocompleteUrl, matchCount: 0 };

  const listingUrl = propertyUrl ? `https://www.redfin.com${propertyUrl}` : null;
  const isSold = propertyUrl?.includes("/sold/") ?? false;

  if (propertyId) {
    const detailsUrl = `https://www.redfin.com/stingray/api/home/details/aboveTheFold?propertyId=${propertyId}&accessLevel=3&v=11`;
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), 6000);
    try {
      const detailsRes = await fetch(detailsUrl, {
        headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
        signal: controller2.signal,
      });
      clearTimeout(timeout2);

      if (detailsRes.ok) {
        const text = await detailsRes.text();
        const data = JSON.parse(text.replace(/^{}&&/, "")) as {
          payload?: {
            mainHouseInfo?: {
              beds?: number;
              baths?: number;
              sqFt?: { value?: number };
              priceInfo?: { amount?: number };
              mlsId?: string;
              status?: string;
              listingStatus?: string;
              saleStatus?: string;
              listDate?: string;
            };
            listingInfo?: {
              status?: string;
              listingStatus?: string;
              dateListed?: string;
            };
          };
        };

        const info = data?.payload?.mainHouseInfo;
        if (info) {
          const beds = info.beds ?? null;
          const baths = info.baths ?? null;
          const squareFeet = info.sqFt?.value ?? null;
          const listPrice = info.priceInfo?.amount ?? null;
          const mlsId = info.mlsId ?? null;

          const rawStatus =
            info.status ??
            info.listingStatus ??
            info.saleStatus ??
            data?.payload?.listingInfo?.status ??
            data?.payload?.listingInfo?.listingStatus;
          const listingDate = info.listDate ?? data?.payload?.listingInfo?.dateListed ?? null;
          const listingStatus = mapRedfinStatus(rawStatus, isSold, listPrice);

          if (beds != null || baths != null || squareFeet != null || listPrice != null || mlsId != null) {
            const result: PropertyLookupResult = {
              source: "redfin",
              beds,
              baths,
              squareFeet,
              listPrice,
              mlsId,
              listingStatus,
              listingUrl,
              listingDate,
              lastVerifiedAt: new Date().toISOString(),
            };
            return {
              result,
              candidates: [result],
              searchQuery: autocompleteUrl,
              matchCount: 1,
            };
          }
        }
      } else {
        clearTimeout(timeout2);
      }
    } catch {
      clearTimeout(timeout2);
    }
  }

  if (listingUrl) {
    const scraped = await scrapeRedfinPage(listingUrl, isSold);
    if (scraped) {
      return { result: scraped, candidates: [scraped], searchQuery: autocompleteUrl, matchCount: 1 };
    }
  }

  return { result: null, candidates: [], searchQuery: autocompleteUrl, matchCount: propertyId || propertyUrl ? 1 : 0 };
}

export interface StoredPropertyHint {
  lat?: number | null;
  lng?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
}

/**
 * Takes pre-fetched Realtor/Redfin candidates (e.g. from browser-side proxy),
 * runs AI matching, and returns the best `PropertyLookupResult`.
 * Used by both `lookupPropertyDetails` (server-scrape path) and the
 * `POST /properties/process-lookup` endpoint (browser-proxy path).
 */
export async function processLookupCandidates(
  address: string,
  realtorCandidates: PropertyLookupResult[],
  redfinCandidate: PropertyLookupResult | null,
  propertyId?: string,
  storedHint?: StoredPropertyHint,
): Promise<PropertyLookupResult> {
  const lastVerifiedAt = new Date().toISOString();
  const empty: PropertyLookupResult = {
    source: null,
    listingStatus: null,
    listingUrl: null,
    listingDate: null,
    lastVerifiedAt,
  };

  if (!realtorCandidates.length && !redfinCandidate) {
    return { ...empty, lastVerifiedAt };
  }

  const aiResult = await aiMatchProperty({
    stored: {
      address,
      lat: storedHint?.lat,
      lng: storedHint?.lng,
      beds: storedHint?.beds,
      baths: storedHint?.baths,
      sqft: storedHint?.sqft,
    },
    realtorCandidates,
    redfinCandidate,
  });

  let selected: PropertyLookupResult;
  let acceptedReason: string;
  let rejectedProvider: string | undefined;
  let rejectedReason: string | undefined;
  let aiMatchConfidence: string | undefined;
  let aiSelectedRealtor: number | null | undefined;
  let aiSelectedRedfin: boolean | undefined;
  let aiFallbackUsed: boolean;

  const realtorResult = realtorCandidates[0] ?? null;
  const redfinResult = redfinCandidate;

  if (!aiResult.fallbackUsed) {
    const decision = aiResult;
    aiFallbackUsed = false;
    aiMatchConfidence = decision.matchConfidence;
    aiSelectedRealtor = decision.realtorIndex;
    aiSelectedRedfin = decision.redfinMatch;

    const mergedHasData =
      decision.mergedResult.beds != null ||
      decision.mergedResult.baths != null ||
      decision.mergedResult.squareFeet != null ||
      decision.mergedResult.listPrice != null ||
      decision.mergedResult.mlsId != null ||
      decision.mergedResult.listingUrl != null;

    if (mergedHasData) {
      selected = decision.mergedResult;
      acceptedReason = `ai_match confidence=${decision.matchConfidence} realtorIdx=${decision.realtorIndex ?? "none"} redfinMatch=${decision.redfinMatch}`;
    } else {
      logger.warn(
        { propertyId, originalAddress: address, aiDecision: { realtorIndex: decision.realtorIndex, redfinMatch: decision.redfinMatch } },
        "property_refresh_ai_no_match",
      );
      return { ...empty, lastVerifiedAt };
    }
  } else {
    aiFallbackUsed = true;
    logger.warn(
      { propertyId, originalAddress: address, fallbackReason: aiResult.fallbackReason },
      "property_refresh_ai_fallback",
    );

    const realtorConf = confidenceOf(realtorResult);
    const redfinConf = confidenceOf(redfinResult);

    if (realtorConf >= redfinConf) {
      selected = realtorResult ?? (redfinResult as PropertyLookupResult);
      if (realtorResult) {
        acceptedReason = `realtor confidence=${realtorConf} >= redfin confidence=${redfinConf}`;
        if (redfinResult && redfinConf < realtorConf) {
          rejectedProvider = "redfin";
          rejectedReason = `redfin confidence=${redfinConf} lower than realtor=${realtorConf}`;
        }
      } else {
        acceptedReason = "realtor returned null; using redfin fallback";
      }
    } else {
      selected = redfinResult as PropertyLookupResult;
      acceptedReason = `redfin confidence=${redfinConf} > realtor confidence=${realtorConf}`;
      rejectedProvider = "realtor";
      rejectedReason = `realtor confidence=${realtorConf} lower than redfin=${redfinConf}`;
    }
  }

  const normalizedAddress = normalizeAddress(address);
  logger.info(
    {
      propertyId,
      originalAddress: address,
      normalizedAddress,
      selectedSource: selected.source,
      selectedMatch: {
        beds: selected.beds,
        baths: selected.baths,
        squareFeet: selected.squareFeet,
        listPrice: selected.listPrice,
        mlsId: selected.mlsId,
        listingStatus: selected.listingStatus,
        listingUrl: selected.listingUrl,
        listingDate: selected.listingDate,
      },
      matchConfidence: confidenceOf(selected),
      listingStatus: selected.listingStatus,
      listPrice: selected.listPrice,
      acceptedReason,
      rejectedProvider,
      rejectedReason,
      aiMatchConfidence,
      aiSelectedRealtor,
      aiSelectedRedfin,
      aiFallbackUsed,
    },
    "property_refresh_complete",
  );

  selected.matchConfidence = (aiMatchConfidence as "high" | "medium" | "low" | undefined) ?? null;

  return selected;
}

export async function lookupPropertyDetails(
  address: string,
  propertyId?: string,
  storedHint?: StoredPropertyHint,
): Promise<PropertyLookupResult> {
  const lastVerifiedAt = new Date().toISOString();
  const empty: PropertyLookupResult = {
    source: null,
    listingStatus: null,
    listingUrl: null,
    listingDate: null,
    lastVerifiedAt,
  };
  if (!address?.trim()) return empty;

  const normalizedAddress = normalizeAddress(address);

  logger.info(
    { propertyId, originalAddress: address, normalizedAddress },
    "property_refresh_start",
  );

  const [realtorSettled, redfinSettled] = await Promise.allSettled([
    lookupRealtor(address),
    lookupRedfin(address),
  ]);

  const realtorPkg: ProviderOutcome = realtorSettled.status === "fulfilled"
    ? realtorSettled.value
    : { result: null, candidates: [], searchQuery: address, matchCount: 0, error: String((realtorSettled as PromiseRejectedResult).reason) };

  const redfinPkg: ProviderOutcome = redfinSettled.status === "fulfilled"
    ? redfinSettled.value
    : { result: null, candidates: [], searchQuery: address, matchCount: 0, error: String((redfinSettled as PromiseRejectedResult).reason) };

  const realtorResult = realtorPkg.result;
  const redfinResult = redfinPkg.result;

  if (!realtorResult && !redfinResult) {
    logger.warn(
      {
        propertyId,
        originalAddress: address,
        normalizedAddress,
        providers: [
          { name: "realtor", searchQuery: realtorPkg.searchQuery, matchCount: realtorPkg.matchCount, error: realtorPkg.error },
          { name: "redfin",  searchQuery: redfinPkg.searchQuery,  matchCount: redfinPkg.matchCount,  error: redfinPkg.error },
        ],
      },
      "property_refresh_no_results",
    );
    return { ...empty, lastVerifiedAt };
  }

  return processLookupCandidates(
    address,
    realtorPkg.candidates,
    redfinPkg.result,
    propertyId,
    storedHint,
  );
}
