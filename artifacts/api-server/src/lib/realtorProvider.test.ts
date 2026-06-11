import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isExactRealtorAddressMatch,
  mapRealtorStatus,
  calculateBaths,
  makeAbsoluteRealtorUrl,
  parseRealtorPropertyPage,
  fetchRealtorGraphql,
  resolveRealtorAddress,
  findRealtorPropertyPage,
  permalinkAddressMatches,
  detailUrlAddressMatches,
} from "./realtorProvider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetch = vi.fn() as unknown as ReturnType<typeof vi.fn<(url: string, opts?: RequestInit) => Promise<any>>>;
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ── isExactRealtorAddressMatch ──────────────────────────────────────────────

describe("isExactRealtorAddressMatch", () => {
  const makeSuggestion = (line: string, city: string, state: string, zip: string) => ({
    area_type: "address" as const,
    mpr_id: "M123",
    line,
    city,
    state_code: state,
    postal_code: zip,
  });

  it("accepts an exact address match", () => {
    expect(
      isExactRealtorAddressMatch(
        makeSuggestion("4920 Naphill Rd", "McKinney", "TX", "75070"),
        "4920 Naphill Rd, McKinney, TX 75070",
      ),
    ).toBe(true);
  });

  it("rejects a different street number", () => {
    expect(
      isExactRealtorAddressMatch(
        makeSuggestion("4921 Naphill Rd", "McKinney", "TX", "75070"),
        "4920 Naphill Rd, McKinney, TX 75070",
      ),
    ).toBe(false);
  });

  it("rejects a different city", () => {
    expect(
      isExactRealtorAddressMatch(
        makeSuggestion("4920 Naphill Rd", "Frisco", "TX", "75070"),
        "4920 Naphill Rd, McKinney, TX 75070",
      ),
    ).toBe(false);
  });

  it("rejects a different state", () => {
    expect(
      isExactRealtorAddressMatch(
        makeSuggestion("4920 Naphill Rd", "McKinney", "CA", "75070"),
        "4920 Naphill Rd, McKinney, TX 75070",
      ),
    ).toBe(false);
  });

  it("rejects a different ZIP when both have ZIP", () => {
    expect(
      isExactRealtorAddressMatch(
        makeSuggestion("4920 Naphill Rd", "McKinney", "TX", "75069"),
        "4920 Naphill Rd, McKinney, TX 75070",
      ),
    ).toBe(false);
  });

  it("accepts when abbreviation differs (Rd vs Road) via normalizeAddress", () => {
    expect(
      isExactRealtorAddressMatch(
        makeSuggestion("4920 Naphill Road", "McKinney", "TX", "75070"),
        "4920 Naphill Rd, McKinney, TX 75070",
      ),
    ).toBe(true);
  });

  it("accepts when case differs", () => {
    expect(
      isExactRealtorAddressMatch(
        makeSuggestion("4920 NAPHILL RD", "MCKINNEY", "TX", "75070"),
        "4920 Naphill Rd, McKinney, TX 75070",
      ),
    ).toBe(true);
  });

  it("rejects a wrong unit number at the same building", () => {
    expect(
      isExactRealtorAddressMatch(
        makeSuggestion("500 Main St Apt 2B", "Dallas", "TX", "75201"),
        "500 Main St Apt 3A, Dallas, TX 75201",
      ),
    ).toBe(false);
  });

  it("accepts matching unit numbers", () => {
    expect(
      isExactRealtorAddressMatch(
        makeSuggestion("500 Main St Apt 3A", "Dallas", "TX", "75201"),
        "500 Main St Apt 3A, Dallas, TX 75201",
      ),
    ).toBe(true);
  });

  it("rejects same street number on a different street name", () => {
    expect(
      isExactRealtorAddressMatch(
        makeSuggestion("4920 Oak Dr", "McKinney", "TX", "75070"),
        "4920 Naphill Rd, McKinney, TX 75070",
      ),
    ).toBe(false);
  });

  it("rejects if suggestion has no mpr_id in the outer check context (street number mismatch at zero)", () => {
    expect(
      isExactRealtorAddressMatch(
        { area_type: "address", mpr_id: "M999", line: "999 Other St", city: "Dallas", state_code: "TX", postal_code: "75201" },
        "123 Main St, Dallas, TX 75201",
      ),
    ).toBe(false);
  });
});

// ── mapRealtorStatus ────────────────────────────────────────────────────────

describe("mapRealtorStatus", () => {
  it("maps for_sale to active", () => {
    expect(mapRealtorStatus("for_sale")).toBe("active");
  });

  it("maps FOR_SALE (uppercase) to active", () => {
    expect(mapRealtorStatus("FOR_SALE")).toBe("active");
  });

  it("maps active to active", () => {
    expect(mapRealtorStatus("active")).toBe("active");
  });

  it("maps recently_sold to recently_sold", () => {
    expect(mapRealtorStatus("recently_sold")).toBe("recently_sold");
  });

  it("maps sold to recently_sold", () => {
    expect(mapRealtorStatus("sold")).toBe("recently_sold");
  });

  it("maps off_market to off_market", () => {
    expect(mapRealtorStatus("off_market")).toBe("off_market");
  });

  it("maps not_for_sale to off_market", () => {
    expect(mapRealtorStatus("not_for_sale")).toBe("off_market");
  });

  it("maps null to unknown", () => {
    expect(mapRealtorStatus(null)).toBe("unknown");
  });

  it("maps empty string to unknown", () => {
    expect(mapRealtorStatus("")).toBe("unknown");
  });

  it("maps unrecognized value to unknown", () => {
    expect(mapRealtorStatus("coming_soon")).toBe("unknown");
  });
});

// ── calculateBaths ──────────────────────────────────────────────────────────

describe("calculateBaths", () => {
  it("returns full baths when no half baths", () => {
    expect(calculateBaths(3, null)).toBe(3);
  });

  it("adds half baths as 0.5 each", () => {
    expect(calculateBaths(2, 1)).toBe(2.5);
  });

  it("returns null when both are null/zero", () => {
    expect(calculateBaths(null, null)).toBeNull();
  });

  it("returns 0.5 for one half bath and no full bath", () => {
    expect(calculateBaths(0, 1)).toBe(0.5);
  });
});

// ── makeAbsoluteRealtorUrl ──────────────────────────────────────────────────

describe("makeAbsoluteRealtorUrl", () => {
  it("returns null for null input", () => {
    expect(makeAbsoluteRealtorUrl(null)).toBeNull();
  });

  it("leaves an absolute URL unchanged", () => {
    expect(makeAbsoluteRealtorUrl("https://www.realtor.com/path")).toBe(
      "https://www.realtor.com/path",
    );
  });

  it("prepends the base URL to a relative path", () => {
    expect(makeAbsoluteRealtorUrl("/realestateandhomes-detail/123-Main-St")).toBe(
      "https://www.realtor.com/realestateandhomes-detail/123-Main-St",
    );
  });
});

// ── parseRealtorPropertyPage ────────────────────────────────────────────────

describe("parseRealtorPropertyPage", () => {
  it("parses JSON-LD with a SingleFamilyResidence schema", () => {
    const html = `<html><head>
      <script type="application/ld+json">{
        "@type": "SingleFamilyResidence",
        "offers": { "price": 620000, "availability": "http://schema.org/InStock" },
        "numberOfRooms": 4,
        "numberOfBathroomsTotal": 3,
        "floorSize": { "value": 2500 },
        "datePosted": "2024-01-15"
      }</script></head></html>`;

    const result = parseRealtorPropertyPage(html, "https://www.realtor.com/test");
    expect(result).not.toBeNull();
    expect(result?.listPrice).toBe(620000);
    expect(result?.beds).toBe(4);
    expect(result?.baths).toBe(3);
    expect(result?.squareFeet).toBe(2500);
    expect(result?.listingDate).toBe("2024-01-15");
  });

  it("parses Next.js data embedded in __NEXT_DATA__", () => {
    const listing = {
      list_price: 450000,
      beds: 3,
      baths_full: 2,
      baths_half: 1,
      sqft: 1800,
      status: "for_sale",
      list_date: "2024-03-01",
      property_id: "mls001",
    };
    const html = `<html><head>
      <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"listing":${JSON.stringify(listing)}}}}</script>
      </head></html>`;

    const result = parseRealtorPropertyPage(html, "https://www.realtor.com/test");
    expect(result).not.toBeNull();
    expect(result?.listPrice).toBe(450000);
    expect(result?.beds).toBe(3);
    expect(result?.baths).toBe(2.5);
    expect(result?.squareFeet).toBe(1800);
    expect(result?.listingStatus).toBe("active");
    expect(result?.mlsId).toBe("mls001");
  });

  it("parses structured script tags for price/beds/sqft", () => {
    const html = `<html><body>
      <script>var data = {"list_price": 375000, "beds": 3, "sqft": 1600, "status": "for_sale"};</script>
      </body></html>`;

    const result = parseRealtorPropertyPage(html, "https://www.realtor.com/test");
    expect(result).not.toBeNull();
    expect(result?.listPrice).toBe(375000);
    expect(result?.beds).toBe(3);
    expect(result?.squareFeet).toBe(1600);
  });

  it("returns null when HTML has no parseable data", () => {
    const html = "<html><body><p>Nothing here</p></body></html>";
    const result = parseRealtorPropertyPage(html, "https://www.realtor.com/test");
    expect(result).toBeNull();
  });

  it("does not infer active status from price alone in JSON-LD (no availability field)", () => {
    const html = `<html><head>
      <script type="application/ld+json">{
        "@type": "SingleFamilyResidence",
        "offers": { "price": 500000 },
        "numberOfRooms": 3,
        "floorSize": { "value": 1500 }
      }</script></head></html>`;

    const result = parseRealtorPropertyPage(html, "https://www.realtor.com/test");
    expect(result?.listingStatus).not.toBe("active");
  });
});

// ── permalinkAddressMatches ────────────────────────────────────────────────

describe("permalinkAddressMatches", () => {
  it("accepts a permalink with matching street number and city", () => {
    expect(
      permalinkAddressMatches(
        "/realestateandhomes-detail/4920-Naphill-Rd_McKinney_TX_75070_M12345",
        "4920 Naphill Rd, McKinney, TX 75070",
      ),
    ).toBe(true);
  });

  it("rejects a permalink with a different street number", () => {
    expect(
      permalinkAddressMatches(
        "/realestateandhomes-detail/4921-Naphill-Rd_McKinney_TX_75070_M99999",
        "4920 Naphill Rd, McKinney, TX 75070",
      ),
    ).toBe(false);
  });

  it("rejects a permalink with a different street name", () => {
    expect(
      permalinkAddressMatches(
        "/realestateandhomes-detail/4920-Oak-Dr_McKinney_TX_75070_M99999",
        "4920 Naphill Rd, McKinney, TX 75070",
      ),
    ).toBe(false);
  });

  it("rejects a permalink with a wrong unit number", () => {
    expect(
      permalinkAddressMatches(
        "/realestateandhomes-detail/500-Main-St-Apt-2B_Dallas_TX_75201_M99999",
        "500 Main St Apt 3A, Dallas, TX 75201",
      ),
    ).toBe(false);
  });

  it("returns true for an empty/missing permalink (cannot validate)", () => {
    expect(permalinkAddressMatches("", "4920 Naphill Rd, McKinney, TX 75070")).toBe(true);
  });
});

// ── detailUrlAddressMatches ────────────────────────────────────────────────

describe("detailUrlAddressMatches", () => {
  it("accepts a matching detail URL", () => {
    expect(
      detailUrlAddressMatches(
        "https://www.realtor.com/realestateandhomes-detail/4920-Naphill-Rd_McKinney_TX_75070_M12345",
        "4920 Naphill Rd, McKinney, TX 75070",
      ),
    ).toBe(true);
  });

  it("rejects a detail URL with a different street number", () => {
    expect(
      detailUrlAddressMatches(
        "https://www.realtor.com/realestateandhomes-detail/4921-Naphill-Rd_McKinney_TX_75070_M99999",
        "4920 Naphill Rd, McKinney, TX 75070",
      ),
    ).toBe(false);
  });
});

// ── fetchRealtorGraphql failure paths ──────────────────────────────────────

describe("fetchRealtorGraphql — failure paths", () => {
  it("returns a structured failure for HTTP 404", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const result = await fetchRealtorGraphql("M12345", "4920 Naphill Rd, McKinney, TX 75070");
    expect("reason" in result).toBe(true);
    if ("reason" in result) {
      expect(result.reason).toBe("not_found");
      expect(result.status).toBe(404);
    }
  });

  it("returns a structured failure for HTTP 403", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });
    const result = await fetchRealtorGraphql("M12345", "4920 Naphill Rd, McKinney, TX 75070");
    expect("reason" in result).toBe(true);
    if ("reason" in result) {
      expect(result.reason).toBe("forbidden");
      expect(result.status).toBe(403);
    }
  });

  it("returns a structured failure for HTTP 429", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });
    const result = await fetchRealtorGraphql("M12345", "4920 Naphill Rd, McKinney, TX 75070");
    expect("reason" in result).toBe(true);
    if ("reason" in result) {
      expect(result.reason).toBe("rate_limited");
    }
  });

  it("returns empty_results failure when results array is empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { home_search: { results: [] } } }),
    });
    const result = await fetchRealtorGraphql("M12345", "4920 Naphill Rd, McKinney, TX 75070");
    expect("reason" in result).toBe(true);
    if ("reason" in result) {
      expect(result.reason).toBe("empty_results");
    }
  });

  it("returns graphql_error failure when errors array is present", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          errors: [{ message: "Field not found" }],
        }),
    });
    const result = await fetchRealtorGraphql("M12345", "4920 Naphill Rd, McKinney, TX 75070");
    expect("reason" in result).toBe(true);
    if ("reason" in result) {
      expect(result.reason).toMatch(/graphql_error/);
    }
  });

  it("returns a successful result when data is valid", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            home_search: {
              results: [
                {
                  property_id: "M99999",
                  status: "for_sale",
                  list_price: 620000,
                  beds: 4,
                  baths_full: 3,
                  baths_half: 1,
                  sqft: 2500,
                  list_date: "2024-01-15",
                  permalink: "/realestateandhomes-detail/4920-Naphill-Rd_McKinney_TX_75070",
                },
              ],
            },
          },
        }),
    });
    const result = await fetchRealtorGraphql("M99999", "4920 Naphill Rd, McKinney, TX 75070");
    expect("reason" in result).toBe(false);
    if (!("reason" in result)) {
      expect(result.property_id).toBe("M99999");
      expect(result.status).toBe("for_sale");
      expect(result.list_price).toBe(620000);
      expect(result.beds).toBe(4);
    }
  });
});

// ── resolveRealtorAddress ──────────────────────────────────────────────────

describe("resolveRealtorAddress", () => {
  it("returns null when autocomplete returns no results", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ autocomplete: [] }),
    });
    const result = await resolveRealtorAddress("999 Fake St, Nowhere, TX 00000");
    expect(result).toBeNull();
  });

  it("returns null when no suggestion has area_type === address", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          autocomplete: [
            { area_type: "city", mpr_id: "", line: "McKinney", city: "McKinney", state_code: "TX", postal_code: "" },
          ],
        }),
    });
    const result = await resolveRealtorAddress("McKinney, TX");
    expect(result).toBeNull();
  });

  it("returns null when autocomplete HTTP fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const result = await resolveRealtorAddress("4920 Naphill Rd, McKinney, TX 75070");
    expect(result).toBeNull();
  });

  it("returns the matching suggestion when address matches", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          autocomplete: [
            {
              area_type: "address",
              mpr_id: "M12345",
              line: "4920 Naphill Rd",
              city: "McKinney",
              state_code: "TX",
              postal_code: "75070",
            },
          ],
        }),
    });
    const result = await resolveRealtorAddress("4920 Naphill Rd, McKinney, TX 75070");
    expect(result).not.toBeNull();
    expect(result?.mpr_id).toBe("M12345");
  });

  it("skips suggestions that do not match the requested address", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          autocomplete: [
            {
              area_type: "address",
              mpr_id: "M99999",
              line: "4921 Naphill Rd",
              city: "McKinney",
              state_code: "TX",
              postal_code: "75070",
            },
          ],
        }),
    });
    const result = await resolveRealtorAddress("4920 Naphill Rd, McKinney, TX 75070");
    expect(result).toBeNull();
  });
});

// ── findRealtorPropertyPage ────────────────────────────────────────────────

describe("findRealtorPropertyPage", () => {
  it("returns null when search page HTTP fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const result = await findRealtorPropertyPage("4920 Naphill Rd, McKinney, TX 75070");
    expect(result).toBeNull();
  });

  it("returns null when no detail links found", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("<html><body><p>No results</p></body></html>"),
    });
    const result = await findRealtorPropertyPage("4920 Naphill Rd, McKinney, TX 75070");
    expect(result).toBeNull();
  });

  it("returns matching detail page URL when street number matches", async () => {
    const html = `<html><body>
      <a href="/realestateandhomes-detail/4920-Naphill-Rd_McKinney_TX_75070_M12345">4920 Naphill Rd</a>
      </body></html>`;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(html),
    });
    const result = await findRealtorPropertyPage("4920 Naphill Rd, McKinney, TX 75070");
    expect(result).not.toBeNull();
    expect(result).toContain("4920");
    expect(result).toContain("realtor.com");
  });
});
