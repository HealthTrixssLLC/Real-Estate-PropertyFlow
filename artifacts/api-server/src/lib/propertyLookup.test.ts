import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeAddress, lookupPropertyDetails } from "./propertyLookup";

describe("normalizeAddress", () => {
  it("lowercases and strips commas", () => {
    expect(normalizeAddress("123 Main Street, Dallas, TX 75201")).toBe(
      "123 main street dallas tx 75201",
    );
  });

  it("expands Rd to road (case-insensitive)", () => {
    expect(normalizeAddress("4920 Naphill Rd, McKinney, TX 75070")).toBe(
      "4920 naphill road mckinney tx 75070",
    );
  });

  it("expands St to street", () => {
    expect(normalizeAddress("100 Oak st, Frisco, TX")).toBe(
      "100 oak street frisco tx",
    );
  });

  it("expands Ave to avenue", () => {
    expect(normalizeAddress("500 Elm Ave, Plano, TX")).toBe(
      "500 elm avenue plano tx",
    );
  });

  it("expands Blvd to boulevard", () => {
    expect(normalizeAddress("1200 Preston Blvd, Allen, TX")).toBe(
      "1200 preston boulevard allen tx",
    );
  });

  it("expands Dr to drive", () => {
    expect(normalizeAddress("88 Cedar Dr, Prosper, TX")).toBe(
      "88 cedar drive prosper tx",
    );
  });

  it("expands Ct to court", () => {
    expect(normalizeAddress("9 Willow Ct, Murphy, TX")).toBe(
      "9 willow court murphy tx",
    );
  });

  it("expands Ln to lane", () => {
    expect(normalizeAddress("42 Meadow Ln, Wylie, TX")).toBe(
      "42 meadow lane wylie tx",
    );
  });

  it("expands Pkwy to parkway", () => {
    expect(normalizeAddress("777 Legacy Pkwy, Plano, TX")).toBe(
      "777 legacy parkway plano tx",
    );
  });

  it("normalizes ZIP+4 to five digits", () => {
    expect(normalizeAddress("4920 Naphill Rd, McKinney, TX 75070-1234")).toBe(
      "4920 naphill road mckinney tx 75070",
    );
  });

  it("handles mixed-case abbreviation", () => {
    expect(normalizeAddress("4920 Naphill RD, McKinney, TX 75070")).toBe(
      "4920 naphill road mckinney tx 75070",
    );
  });

  it("collapses extra whitespace", () => {
    expect(normalizeAddress("4920  Naphill   Rd ,  McKinney , TX  75070")).toBe(
      "4920 naphill road mckinney tx 75070",
    );
  });

  it("strips periods and hashes", () => {
    expect(normalizeAddress("100 Oak St. #2, Dallas, TX")).toBe(
      "100 oak street 2 dallas tx",
    );
  });

  it("handles missing ZIP gracefully", () => {
    expect(normalizeAddress("4920 Naphill Rd, McKinney, TX")).toBe(
      "4920 naphill road mckinney tx",
    );
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetch = vi.fn() as unknown as ReturnType<typeof vi.fn<(url: string, opts?: RequestInit) => Promise<any>>>;

vi.stubGlobal("fetch", mockFetch);

function makeRealtorResponse(status: string, listPrice?: number) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        data: {
          home_search: {
            results: [
              {
                listing_id: "mls123",
                listing: { status, list_date: "2024-01-15" },
                property: {
                  beds: 4,
                  baths_consolidated: 3,
                  sqft: 2500,
                  list_price: listPrice ?? 620000,
                },
                href: "https://www.realtor.com/realestateandhomes-detail/4920-Naphill-Rd",
              },
            ],
          },
        },
      }),
  };
}

function makeRedfinAutocompleteResponse(url = "/home/TX/McKinney/4920-Naphill-Rd/1234567") {
  const text = `{}&&${JSON.stringify({
    payload: {
      sections: [
        {
          rows: [
            {
              id: { type: "2", tableId: "9876", url },
            },
          ],
        },
      ],
    },
  })}`;
  return {
    ok: true,
    text: () => Promise.resolve(text),
  };
}

function makeRedfinDetailsResponse(listPrice?: number, status?: string) {
  const text = `{}&&${JSON.stringify({
    payload: {
      mainHouseInfo: {
        beds: 4,
        baths: 3,
        sqFt: { value: 2500 },
        priceInfo: { amount: listPrice ?? 620000 },
        mlsId: "mls456",
        status: status,
      },
    },
  })}`;
  return {
    ok: true,
    text: () => Promise.resolve(text),
  };
}

function emptyRealtorResponse() {
  return {
    ok: true,
    json: () => Promise.resolve({ data: { home_search: { results: [] } } }),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("lookupPropertyDetails", () => {
  it("returns empty result for blank address", async () => {
    const result = await lookupPropertyDetails("");
    expect(result.source).toBeNull();
  });

  it("uses Realtor.com result when it returns an active listing", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("realtor.com")) {
        return Promise.resolve(makeRealtorResponse("for_sale"));
      }
      return Promise.resolve(makeRedfinAutocompleteResponse());
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("realtor");
    expect(result.listingStatus).toBe("active");
    expect(result.listPrice).toBe(620000);
    expect(result.lastVerifiedAt).toBeTruthy();
  });

  it("falls back to Redfin when Realtor.com returns null", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("realtor.com")) {
        return Promise.resolve(emptyRealtorResponse());
      }
      if (url.includes("autocomplete")) {
        return Promise.resolve(makeRedfinAutocompleteResponse());
      }
      return Promise.resolve(makeRedfinDetailsResponse(620000, "ACTIVE"));
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("redfin");
    expect(result.listingStatus).toBe("active");
    expect(result.listPrice).toBe(620000);
  });

  it("prefers active Redfin result over off-market Realtor result", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("realtor.com")) {
        return Promise.resolve(makeRealtorResponse("off_market"));
      }
      if (url.includes("autocomplete")) {
        return Promise.resolve(makeRedfinAutocompleteResponse());
      }
      return Promise.resolve(makeRedfinDetailsResponse(620000, "Active"));
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("redfin");
    expect(result.listingStatus).toBe("active");
  });

  it("returns Realtor active listing over Redfin recently_sold", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("realtor.com")) {
        return Promise.resolve(makeRealtorResponse("for_sale"));
      }
      if (url.includes("autocomplete")) {
        return Promise.resolve(makeRedfinAutocompleteResponse("/sold/TX/McKinney/4920-Naphill-Rd/1234567"));
      }
      return Promise.resolve(makeRedfinDetailsResponse(580000));
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("realtor");
    expect(result.listingStatus).toBe("active");
    expect(result.listPrice).toBe(620000);
  });

  it("handles provider timeout gracefully and returns result from other provider", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("realtor.com")) {
        return new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error("AbortError")), 50),
        );
      }
      if (url.includes("autocomplete")) {
        return Promise.resolve(makeRedfinAutocompleteResponse());
      }
      return Promise.resolve(makeRedfinDetailsResponse(620000, "Active"));
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("redfin");
    expect(result.listingStatus).toBe("active");
  });

  it("handles both providers returning null — returns source: null with lastVerifiedAt", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(emptyRealtorResponse()),
    );

    const result = await lookupPropertyDetails("999 Nonexistent St, Nowhere, TX 00000");
    expect(result.source).toBeNull();
    expect(result.listingStatus).toBeNull();
    expect(result.lastVerifiedAt).toBeTruthy();
  });

  it("handles already-active property with updated list price", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("realtor.com")) {
        return Promise.resolve(makeRealtorResponse("for_sale", 625000));
      }
      return Promise.resolve(emptyRealtorResponse());
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("realtor");
    expect(result.listingStatus).toBe("active");
    expect(result.listPrice).toBe(625000);
  });

  it("normalizes Rd → road and lowercases before sending to providers", async () => {
    const capturedAddresses: string[] = [];
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes("realtor.com") && opts?.body) {
        const body = JSON.parse(opts.body as string) as {
          variables?: { query?: { address?: string } };
        };
        const addr = body?.variables?.query?.address;
        if (addr) capturedAddresses.push(addr);
        return Promise.resolve(makeRealtorResponse("for_sale"));
      }
      return Promise.resolve(emptyRealtorResponse());
    });

    await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(capturedAddresses[0]).toContain("road");
    expect(capturedAddresses[0]).not.toMatch(/\brd\b/i);
    expect(capturedAddresses[0]).toBe(capturedAddresses[0].toLowerCase());
  });

  it("normalizes ZIP+4 to 5-digit ZIP before lookup", async () => {
    const capturedAddresses: string[] = [];
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes("realtor.com") && opts?.body) {
        const body = JSON.parse(opts.body as string) as {
          variables?: { query?: { address?: string } };
        };
        const addr = body?.variables?.query?.address;
        if (addr) capturedAddresses.push(addr);
        return Promise.resolve(makeRealtorResponse("for_sale"));
      }
      return Promise.resolve(emptyRealtorResponse());
    });

    await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070-1234");
    expect(capturedAddresses[0]).toContain("75070");
    expect(capturedAddresses[0]).not.toContain("75070-1234");
  });
});
