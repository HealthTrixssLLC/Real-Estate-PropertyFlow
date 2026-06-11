import { logger } from "./logger";
import { aiMatchProperty } from "./aiPropertyMatcher";

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

function mapRealtorStatus(raw: string | undefined | null): PropertyLookupResult["listingStatus"] {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase();
  if (lower === "for_sale" || lower === "for sale" || lower === "active") return "active";
  if (lower === "recently_sold" || lower === "sold") return "recently_sold";
  if (lower === "off_market" || lower === "not_for_sale") return "off_market";
  return "unknown";
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

async function lookupRealtor(originalAddress: string): Promise<ProviderOutcome> {
  const url = `https://www.realtor.com/api/v1/rdc_search_srp?client_id=rdc-search-new-communities&schema=vesta`;
  const body = JSON.stringify({
    query: `query HomeSearch($query: home_search_criteria, $limit: Int) {
      home_search(query: $query, limit: $limit) {
        results {
          listing_id
          listing {
            status
            list_date
          }
          property {
            beds
            baths_consolidated
            sqft
            list_price
            mpr_id
          }
          href
        }
      }
    }`,
    variables: {
      query: {
        status: ["for_sale", "recently_sold"],
        address: originalAddress,
      },
      limit: 3,
    },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        Origin: "https://www.realtor.com",
        Referer: "https://www.realtor.com/",
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { result: null, candidates: [], searchQuery: originalAddress, matchCount: 0, error: `HTTP ${res.status}` };

    const data = (await res.json()) as {
      data?: {
        home_search?: {
          results?: Array<{
            listing_id?: string;
            listing?: { status?: string; list_date?: string };
            property?: {
              beds?: number;
              baths_consolidated?: number;
              sqft?: number;
              list_price?: number;
              mpr_id?: string;
            };
            href?: string;
          }>;
        };
      };
    };

    const results = data?.data?.home_search?.results ?? [];
    const matchCount = results.length;
    if (!matchCount) return { result: null, candidates: [], searchQuery: originalAddress, matchCount: 0 };

    const now = new Date().toISOString();

    const candidates: PropertyLookupResult[] = [];
    for (const r of results) {
      const prop = r.property;
      if (!prop) continue;
      const beds = prop.beds ?? null;
      const baths = prop.baths_consolidated ?? null;
      const squareFeet = prop.sqft ?? null;
      const listPrice = prop.list_price ?? null;
      const mlsId = r.listing_id ?? prop.mpr_id ?? null;
      const listingStatus = mapRealtorStatus(r.listing?.status);
      const listingUrl = r.href ?? null;
      const listingDate = r.listing?.list_date ?? null;
      if (beds == null && baths == null && squareFeet == null && listPrice == null && mlsId == null) continue;
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
      candidates.push(candidate);
    }

    if (!candidates.length) return { result: null, candidates: [], searchQuery: originalAddress, matchCount };

    const active = candidates.find(c => c.listingStatus === "active");
    const best = active ?? candidates[0];

    return {
      result: best,
      candidates,
      searchQuery: originalAddress,
      matchCount,
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    return { result: null, candidates: [], searchQuery: originalAddress, matchCount: 0, error: message };
  }
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
