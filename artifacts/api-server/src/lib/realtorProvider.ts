import { logger } from "./logger";
import { normalizeAddress } from "./propertyLookup";
import type { PropertyLookupResult } from "./propertyLookup";

export const REALTOR_AUTOCOMPLETE_URL =
  "https://parser-external.geo.moveaws.com/suggest";
export const REALTOR_HULK_URL =
  "https://www.realtor.com/api/v1/hulk_main_srp";
export const REALTOR_BASE_URL = "https://www.realtor.com";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface RealtorAddressSuggestion {
  area_type: string;
  mpr_id: string;
  full_address?: string[];
  line?: string;
  city?: string;
  state_code?: string;
  postal_code?: string;
  country?: string;
  slug_id?: string;
}

export interface RealtorAutocompleteResponse {
  autocomplete?: RealtorAddressSuggestion[];
}

export interface RealtorHomeSearchResult {
  property_id?: string;
  status?: string;
  list_price?: number | null;
  beds?: number | null;
  baths_full?: number | null;
  baths_half?: number | null;
  sqft?: number | null;
  list_date?: string | null;
  permalink?: string | null;
}

export interface RealtorHomeSearchResponse {
  data?: {
    home_search?: {
      results?: RealtorHomeSearchResult[];
    };
  };
  errors?: Array<{ message: string }>;
}

interface GraphqlFailure {
  stage: string;
  status: number | null;
  reason: string;
}

// ── Address component parsing ─────────────────────────────────────────────

interface AddressComponents {
  streetNumber: string;
  streetName: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
}

const UNIT_RE =
  /\s+(apt|apartment|suite|ste|unit|#|floor|fl|bldg|building)\.?\s*(\S+.*)/i;

/**
 * Extract street number, street name, and unit from a normalized street line.
 * Input should already be normalized (lowercase, abbreviations expanded).
 */
function parseStreetLine(normStreet: string): {
  streetNumber: string;
  streetName: string;
  unit: string;
} {
  const numMatch = normStreet.match(/^(\d+[a-z]?)\s+/i);
  const streetNumber = numMatch ? numMatch[1].toLowerCase() : "";
  let rest = numMatch ? normStreet.slice(numMatch[0].length) : normStreet;

  let unit = "";
  const unitMatch = rest.match(UNIT_RE);
  if (unitMatch) {
    unit = unitMatch[2]?.toLowerCase().trim() ?? "";
    rest = rest.slice(0, rest.length - unitMatch[0].length).trim();
  }

  return { streetNumber, streetName: rest.trim(), unit };
}

/**
 * Parse a free-form address string into its constituent parts.
 * Splits on commas BEFORE normalization so the comma delimiters are preserved.
 * Handles formats: "4920 Naphill Rd Apt 3A, McKinney, TX 75070"
 */
export function parseAddressComponents(raw: string): AddressComponents {
  const commaParts = raw.split(",").map((p) => p.trim()).filter(Boolean);

  const streetRaw = normalizeAddress(commaParts[0] ?? "");
  const cityRaw = normalizeAddress(commaParts[1] ?? "");
  const stateZipRaw = normalizeAddress(commaParts.slice(2).join(" "));
  const state = stateZipRaw.match(/\b([a-z]{2})\b/)?.[1] ?? "";
  const zip = stateZipRaw.match(/\b(\d{5})\b/)?.[1] ?? "";

  const { streetNumber, streetName, unit } = parseStreetLine(streetRaw);

  return {
    streetNumber,
    streetName,
    unit,
    city: cityRaw.trim(),
    state,
    zip,
  };
}

/**
 * Parse a Realtor.com detail-page slug into address components.
 * Slug format examples:
 *   "4920-Naphill-Rd_McKinney_TX_75070_M12345"
 *   "500-Main-St-Apt-2B_Dallas_TX_75201_M99999"
 */
function parseSlugComponents(slug: string): AddressComponents {
  const parts = slug.split("_").filter(Boolean);
  const streetRaw = normalizeAddress((parts[0] ?? "").replace(/-/g, " "));
  const cityRaw = normalizeAddress((parts[1] ?? "").replace(/-/g, " "));
  const stateRaw = (parts[2] ?? "").toLowerCase().trim();
  const zipCandidate = parts[3] ?? "";
  const zip = /^\d{5}$/.test(zipCandidate) ? zipCandidate : "";

  const { streetNumber, streetName, unit } = parseStreetLine(streetRaw);

  return {
    streetNumber,
    streetName,
    unit,
    city: cityRaw,
    state: stateRaw,
    zip,
  };
}

export function mapRealtorStatus(
  raw: string | undefined | null,
): PropertyLookupResult["listingStatus"] {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase();
  if (
    lower === "for_sale" ||
    lower === "for sale" ||
    lower === "active" ||
    lower === "forsale"
  )
    return "active";
  if (lower === "recently_sold" || lower === "sold") return "recently_sold";
  if (lower === "off_market" || lower === "not_for_sale" || lower === "offmarket")
    return "off_market";
  return "unknown";
}

export function calculateBaths(
  full: number | null | undefined,
  half: number | null | undefined,
): number | null {
  const f = full ?? 0;
  const h = half ?? 0;
  if (f === 0 && h === 0) return null;
  return f + h * 0.5;
}

export function makeAbsoluteRealtorUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${REALTOR_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Compare two parsed address component sets.
 * Returns true if the addresses are the same property.
 */
function addressComponentsMatch(
  a: AddressComponents,
  b: AddressComponents,
): boolean {
  if (!a.streetNumber || !b.streetNumber) return false;
  if (a.streetNumber !== b.streetNumber) return false;

  if (a.unit && b.unit && a.unit !== b.unit) return false;

  if (a.city && b.city) {
    const cityA = a.city.replace(/\s+/g, "");
    const cityB = b.city.replace(/\s+/g, "");
    if (!cityA.includes(cityB) && !cityB.includes(cityA)) return false;
  }

  if (a.state && b.state && a.state !== b.state) return false;

  if (a.zip && b.zip && a.zip !== b.zip) return false;

  if (a.streetName && b.streetName) {
    const wordsA = a.streetName.split(/\s+/).filter(Boolean);
    const wordsB = b.streetName.split(/\s+/).filter(Boolean);
    const minLen = Math.min(wordsA.length, wordsB.length);
    if (minLen >= 1) {
      const overlap = wordsA.filter((w) => wordsB.includes(w));
      if (overlap.length < minLen) return false;
    }
  }

  return true;
}

/**
 * Compare the address from an autocomplete suggestion against the
 * original requested address. Requires street number, street name,
 * city, and state to match. Unit number must match if either side has one.
 * Uses normalizeAddress for abbreviation handling.
 */
export function isExactRealtorAddressMatch(
  suggestion: RealtorAddressSuggestion,
  requestedAddress: string,
): boolean {
  const streetLine = suggestion.line ?? "";
  const city = suggestion.city ?? "";
  const state = suggestion.state_code ?? "";
  const zip = suggestion.postal_code ?? "";

  const suggestionFull = [streetLine, city, state, zip].filter(Boolean).join(", ");
  const suggComponents = parseAddressComponents(suggestionFull);
  const reqComponents = parseAddressComponents(requestedAddress);

  return addressComponentsMatch(suggComponents, reqComponents);
}

/**
 * Validate a Realtor.com permalink/slug against the requested address.
 * Used to reject GraphQL results whose linked listing is at a different address.
 */
export function permalinkAddressMatches(
  permalink: string,
  requestedAddress: string,
): boolean {
  if (!permalink) return true;

  const m = permalink.match(/(?:realestateandhomes-detail\/)?([^/?#]+)$/);
  const slug = (m?.[1] ?? "").split("?")[0];

  if (!slug) return true;

  const slugComponents = parseSlugComponents(slug);
  const reqComponents = parseAddressComponents(requestedAddress);

  if (!slugComponents.streetNumber || !reqComponents.streetNumber) return true;
  return addressComponentsMatch(slugComponents, reqComponents);
}

/**
 * Validate a detail-page URL slug against the requested address.
 * Returns true if they appear to be the same property.
 */
export function detailUrlAddressMatches(
  detailUrl: string,
  requestedAddress: string,
): boolean {
  const m = detailUrl.match(/\/realestateandhomes-detail\/([^/?#]+)/);
  if (!m) return false;
  return permalinkAddressMatches(m[1] ?? "", requestedAddress);
}

/**
 * Geocode an address via Realtor.com's autocomplete endpoint.
 * Returns the first suggestion that is an address type with a non-empty
 * mpr_id AND passes the exact address match test.
 */
export async function resolveRealtorAddress(
  address: string,
): Promise<RealtorAddressSuggestion | null> {
  const params = new URLSearchParams({
    input: address,
    client_id: "rdc-home",
    limit: "5",
    area_types: "address",
  });
  const url = `${REALTOR_AUTOCOMPLETE_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        Referer: "https://www.realtor.com/",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    logger.info(
      { address, status: res.status, url },
      "realtor_autocomplete",
    );

    if (!res.ok) return null;

    const data = (await res.json()) as RealtorAutocompleteResponse;
    const suggestions = data?.autocomplete ?? [];

    for (const s of suggestions) {
      if (s.area_type !== "address" || !s.mpr_id) continue;
      const matches = isExactRealtorAddressMatch(s, address);
      logger.info(
        {
          address,
          mpr_id: s.mpr_id,
          suggestionLine: s.line,
          suggestionCity: s.city,
          suggestionState: s.state_code,
          matches,
        },
        "realtor_address_match",
      );
      if (matches) return s;
    }

    return null;
  } catch (err: unknown) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ address, error: message }, "realtor_autocomplete");
    return null;
  }
}

const HULK_QUERY = `query ConsumerSearchMainQuery($query: HomeSearchCriteria!, $limit: Int, $offset: Int, $sort_type: String, $client_data: JSON, $callfrom: String, $nrQueryType: String, $isClient: Boolean) {
  home_search: homes(query: $query, limit: $limit, offset: $offset, sort_type: $sort_type, client_data: $client_data, callfrom: $callfrom, nrQueryType: $nrQueryType, isClient: $isClient) {
    results {
      property_id
      status
      list_price
      beds
      baths_full
      baths_half
      sqft
      list_date
      permalink
    }
  }
}`;

/**
 * Query the Realtor.com hulk_main_srp GraphQL endpoint for a property
 * identified by its mpr_id.
 */
export async function fetchRealtorGraphql(
  mprId: string,
  requestedAddress: string,
): Promise<RealtorHomeSearchResult | GraphqlFailure> {
  const body = JSON.stringify({
    operationName: "ConsumerSearchMainQuery",
    query: HULK_QUERY,
    variables: {
      query: { property_id: [mprId] },
      limit: 1,
      offset: 0,
      sort_type: "relevant",
      client_data: { device_data: { device_type: "web" } },
      callfrom: "PCM",
      nrQueryType: "MAIN_SRP",
      isClient: true,
    },
  });

  const url = `${REALTOR_HULK_URL}?client_id=rdc-search-new-communities&schema=vesta`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

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

    logger.info(
      { mprId, requestedAddress, status: res.status },
      "realtor_hulk_search",
    );

    if (res.status === 403)
      return { stage: "hulk", status: 403, reason: "forbidden" };
    if (res.status === 404)
      return { stage: "hulk", status: 404, reason: "not_found" };
    if (res.status === 429)
      return { stage: "hulk", status: 429, reason: "rate_limited" };
    if (!res.ok)
      return { stage: "hulk", status: res.status, reason: `http_error_${res.status}` };

    let data: RealtorHomeSearchResponse;
    try {
      data = (await res.json()) as RealtorHomeSearchResponse;
    } catch {
      return { stage: "hulk", status: res.status, reason: "invalid_json" };
    }

    if (data.errors?.length) {
      return {
        stage: "hulk",
        status: null,
        reason: `graphql_error: ${data.errors[0]?.message ?? "unknown"}`,
      };
    }

    const results = data?.data?.home_search?.results ?? [];
    if (!results.length) {
      return { stage: "hulk", status: null, reason: "empty_results" };
    }

    const hit = results[0];
    if (!hit) return { stage: "hulk", status: null, reason: "empty_results" };

    if (hit.permalink && !permalinkAddressMatches(hit.permalink, requestedAddress)) {
      logger.warn(
        { mprId, permalink: hit.permalink, requestedAddress },
        "realtor_hulk_search",
      );
      return { stage: "hulk", status: null, reason: "address_mismatch" };
    }

    return hit;
  } catch (err: unknown) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ mprId, error: message }, "realtor_hulk_search");
    return { stage: "hulk", status: null, reason: message };
  }
}

/**
 * Search the Realtor.com website for the property detail page URL,
 * validating each candidate's address against the requested property.
 */
export async function findRealtorPropertyPage(
  address: string,
): Promise<string | null> {
  const encoded = encodeURIComponent(address);
  const searchUrl = `${REALTOR_BASE_URL}/realestateandhomes-search/?location=${encoded}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.realtor.com/",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    logger.info({ address, status: res.status }, "realtor_html_search");

    if (!res.ok) return null;

    const html = await res.text();
    const detailLinks = _extractDetailLinks(html);

    for (const link of detailLinks) {
      const absoluteUrl = makeAbsoluteRealtorUrl(link) ?? link;
      if (detailUrlAddressMatches(absoluteUrl, address)) {
        return absoluteUrl;
      }
    }

    return null;
  } catch (err: unknown) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ address, error: message }, "realtor_html_search");
    return null;
  }
}

function _extractDetailLinks(html: string): string[] {
  const links: string[] = [];
  const re = /href=["']([^"']*\/realestateandhomes-detail\/[^"'?#]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1] && !links.includes(m[1])) links.push(m[1]);
  }
  return links;
}

export interface ParsedRealtorPage {
  beds: number | null;
  baths: number | null;
  squareFeet: number | null;
  listPrice: number | null;
  mlsId: string | null;
  listingStatus: PropertyLookupResult["listingStatus"];
  listingDate: string | null;
}

/**
 * Parse a Realtor.com property detail HTML page.
 * Tries JSON-LD, embedded app JSON / Next.js data, and structured script tags in order.
 */
export function parseRealtorPropertyPage(
  html: string,
  pageUrl: string,
): ParsedRealtorPage | null {
  let result = _parseJsonLd(html);
  if (result) {
    logger.info({ pageUrl, method: "json_ld" }, "realtor_detail_parse");
    return result;
  }

  result = _parseNextJsData(html);
  if (result) {
    logger.info({ pageUrl, method: "nextjs_data" }, "realtor_detail_parse");
    return result;
  }

  result = _parseAppJson(html);
  if (result) {
    logger.info({ pageUrl, method: "app_json" }, "realtor_detail_parse");
    return result;
  }

  result = _parseStructuredScripts(html);
  if (result) {
    logger.info({ pageUrl, method: "structured_script" }, "realtor_detail_parse");
    return result;
  }

  logger.warn({ pageUrl }, "realtor_detail_parse");
  return null;
}

function _statusFromAvailability(availability: string): PropertyLookupResult["listingStatus"] {
  if (!availability) return "unknown";
  const lower = availability.toLowerCase();
  if (lower.includes("instock") || lower.includes("forsale") || lower.includes("for_sale"))
    return "active";
  if (lower.includes("sold") || lower.includes("discontinued"))
    return "recently_sold";
  if (lower.includes("outofstock"))
    return "off_market";
  return "unknown";
}

function _parseJsonLd(html: string): ParsedRealtorPage | null {
  const matches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of matches) {
    try {
      const ld = JSON.parse(m[1] ?? "{}") as {
        "@type"?: string;
        offers?: {
          price?: number | string;
          priceCurrency?: string;
          availability?: string;
        };
        numberOfRooms?: number | string;
        numberOfBathroomsTotal?: number | string;
        floorSize?: { value?: number | string };
        datePosted?: string;
        identifier?: string | { value?: string };
      };

      const listPrice = ld.offers?.price != null ? Number(ld.offers.price) : null;
      const beds = ld.numberOfRooms != null ? Number(ld.numberOfRooms) : null;
      const baths =
        ld.numberOfBathroomsTotal != null
          ? Number(ld.numberOfBathroomsTotal)
          : null;
      const squareFeet =
        ld.floorSize?.value != null ? Number(ld.floorSize.value) : null;
      const listingDate = ld.datePosted ?? null;

      const availability = ld.offers?.availability ?? "";
      const listingStatus = _statusFromAvailability(availability);

      let mlsId: string | null = null;
      if (ld.identifier) {
        mlsId =
          typeof ld.identifier === "string"
            ? ld.identifier
            : (ld.identifier.value ?? null);
      }

      if (
        (listPrice != null && !isNaN(listPrice)) ||
        (beds != null && !isNaN(beds)) ||
        (squareFeet != null && !isNaN(squareFeet))
      ) {
        return {
          beds: beds != null && isNaN(beds) ? null : beds,
          baths: baths != null && isNaN(baths) ? null : baths,
          squareFeet: squareFeet != null && isNaN(squareFeet) ? null : squareFeet,
          listPrice: listPrice != null && isNaN(listPrice) ? null : listPrice,
          mlsId,
          listingStatus,
          listingDate,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function _parseNextJsData(html: string): ParsedRealtorPage | null {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1] ?? "{}") as {
      props?: {
        pageProps?: {
          listing?: unknown;
          initialReduxState?: { propertyDetails?: unknown };
        };
      };
    };
    const listing =
      data?.props?.pageProps?.listing ??
      data?.props?.pageProps?.initialReduxState?.propertyDetails;
    if (!listing) return null;
    return _extractFromListingObject(listing as Record<string, unknown>);
  } catch {
    return null;
  }
}

function _parseAppJson(html: string): ParsedRealtorPage | null {
  const m = html.match(/window\.__APP_INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1] ?? "{}") as Record<string, unknown>;
    const listing =
      (data as { propertyDetail?: unknown })?.propertyDetail ??
      (data as { currentListing?: unknown })?.currentListing;
    if (!listing) return null;
    return _extractFromListingObject(listing as Record<string, unknown>);
  } catch {
    return null;
  }
}

function _parseStructuredScripts(html: string): ParsedRealtorPage | null {
  const priceMatch = html.match(/["']list_price["']\s*:\s*(\d+)/);
  const bedsMatch = html.match(/["']beds["']\s*:\s*(\d+)/);
  const sqftMatch = html.match(/["']sqft["']\s*:\s*(\d+)/);
  const statusMatch = html.match(/["']status["']\s*:\s*["']([^"']+)["']/);

  const listPrice = priceMatch ? Number(priceMatch[1]) : null;
  const beds = bedsMatch ? Number(bedsMatch[1]) : null;
  const squareFeet = sqftMatch ? Number(sqftMatch[1]) : null;
  const rawStatus = statusMatch ? statusMatch[1] : null;

  if (listPrice == null && beds == null && squareFeet == null) return null;

  const listingStatus = rawStatus ? mapRealtorStatus(rawStatus) : "unknown";

  return {
    beds,
    baths: null,
    squareFeet,
    listPrice,
    mlsId: null,
    listingStatus,
    listingDate: null,
  };
}

type ListingObj = {
  list_price?: number | string | null;
  beds?: number | null;
  baths_full?: number | null;
  baths_half?: number | null;
  sqft?: number | null;
  status?: string | null;
  list_date?: string | null;
  property_id?: string | null;
  mpr_id?: string | null;
  description?: {
    list_price?: number | null;
    beds?: number | null;
    baths_full?: number | null;
    baths_half?: number | null;
    sqft?: number | null;
    status?: string | null;
    list_date?: string | null;
  } | null;
};

function _extractFromListingObject(obj: Record<string, unknown>): ParsedRealtorPage | null {
  const l = obj as ListingObj;
  const desc = l.description ?? {};

  const listPrice = Number(l.list_price ?? desc.list_price ?? null);
  const beds = Number(l.beds ?? desc.beds ?? null) || null;
  const sqft = Number(l.sqft ?? desc.sqft ?? null) || null;
  const bathsFull = Number(l.baths_full ?? desc.baths_full ?? null) || null;
  const bathsHalf = Number(l.baths_half ?? desc.baths_half ?? null) || null;
  const baths = calculateBaths(bathsFull, bathsHalf);
  const rawStatus = (l.status ?? desc.status ?? null) as string | null;
  const listingDate = (l.list_date ?? desc.list_date ?? null) as string | null;
  const mlsId = (l.property_id ?? l.mpr_id ?? null) as string | null;

  if (!listPrice && !beds && !sqft) return null;

  return {
    beds,
    baths,
    squareFeet: sqft,
    listPrice: isNaN(listPrice) ? null : listPrice || null,
    mlsId,
    listingStatus: mapRealtorStatus(rawStatus),
    listingDate,
  };
}

/**
 * Fetch a Realtor.com property detail page and parse its data.
 */
export async function fetchAndParseRealtorDetailPage(
  pageUrl: string,
): Promise<ParsedRealtorPage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.realtor.com/",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    logger.info({ pageUrl, status: res.status }, "realtor_detail_fetch");

    if (!res.ok) return null;

    const html = await res.text();
    return parseRealtorPropertyPage(html, pageUrl);
  } catch (err: unknown) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ pageUrl, error: message }, "realtor_detail_fetch");
    return null;
  }
}
