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

// ── Fixture helpers ─────────────────────────────────────────────────────────

function makeAutocompleteResponse(
  mprId: string,
  line = "4920 Naphill Rd",
  city = "McKinney",
  state = "TX",
  zip = "75070",
) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        autocomplete: [
          { area_type: "address", mpr_id: mprId, line, city, state_code: state, postal_code: zip },
        ],
      }),
  };
}

function makeHulkResponse(status: string, listPrice = 620000) {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        data: {
          home_search: {
            results: [
              {
                property_id: "M12345",
                status,
                list_price: listPrice,
                beds: 4,
                baths_full: 3,
                baths_half: 0,
                sqft: 2500,
                list_date: "2024-01-15",
                permalink: "/realestateandhomes-detail/4920-Naphill-Rd_McKinney_TX_75070_M12345",
              },
            ],
          },
        },
      }),
  };
}

function emptyHulkResponse() {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({ data: { home_search: { results: [] } } }),
  };
}

function hulk404Response() {
  return { ok: false, status: 404 };
}

function emptyHtmlSearch() {
  return {
    ok: true,
    text: () => Promise.resolve("<html><body></body></html>"),
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

beforeEach(() => {
  mockFetch.mockReset();
});

// ── lookupPropertyDetails integration tests ─────────────────────────────────

describe("lookupPropertyDetails", () => {
  it("returns empty result for blank address", async () => {
    const result = await lookupPropertyDetails("");
    expect(result.source).toBeNull();
  });

  it("uses Realtor.com result when it returns an active listing via hulk", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("moveaws")) return Promise.resolve(makeAutocompleteResponse("M12345"));
      if (url.includes("hulk_main_srp")) return Promise.resolve(makeHulkResponse("for_sale"));
      if (url.includes("realestateandhomes-search")) return Promise.resolve(emptyHtmlSearch());
      if (url.includes("autocomplete")) return Promise.resolve(makeRedfinAutocompleteResponse());
      return Promise.resolve(makeRedfinDetailsResponse(620000, "Active"));
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("realtor");
    expect(result.listingStatus).toBe("active");
    expect(result.listPrice).toBe(620000);
    expect(result.lastVerifiedAt).toBeTruthy();
  });

  it("falls back to Redfin when Realtor.com autocomplete finds no match", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("moveaws")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ autocomplete: [] }),
        });
      }
      if (url.includes("autocomplete")) return Promise.resolve(makeRedfinAutocompleteResponse());
      return Promise.resolve(makeRedfinDetailsResponse(620000, "ACTIVE"));
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("redfin");
    expect(result.listingStatus).toBe("active");
    expect(result.listPrice).toBe(620000);
  });

  it("falls back to Redfin when Realtor.com GraphQL returns empty results", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("moveaws")) return Promise.resolve(makeAutocompleteResponse("M12345"));
      if (url.includes("hulk_main_srp")) return Promise.resolve(emptyHulkResponse());
      if (url.includes("realestateandhomes-search")) return Promise.resolve(emptyHtmlSearch());
      if (url.includes("autocomplete")) return Promise.resolve(makeRedfinAutocompleteResponse());
      return Promise.resolve(makeRedfinDetailsResponse(620000, "ACTIVE"));
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("redfin");
    expect(result.listingStatus).toBe("active");
    expect(result.listPrice).toBe(620000);
  });

  it("prefers active Redfin result over off-market Realtor result", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("moveaws")) return Promise.resolve(makeAutocompleteResponse("M12345"));
      if (url.includes("hulk_main_srp")) return Promise.resolve(makeHulkResponse("off_market"));
      if (url.includes("autocomplete")) return Promise.resolve(makeRedfinAutocompleteResponse());
      return Promise.resolve(makeRedfinDetailsResponse(620000, "Active"));
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("redfin");
    expect(result.listingStatus).toBe("active");
  });

  it("returns Realtor active listing over Redfin recently_sold", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("moveaws")) return Promise.resolve(makeAutocompleteResponse("M12345"));
      if (url.includes("hulk_main_srp")) return Promise.resolve(makeHulkResponse("for_sale", 620000));
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
      if (url.includes("moveaws") || url.includes("realtor.com")) {
        return new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error("AbortError")), 50),
        );
      }
      if (url.includes("autocomplete")) return Promise.resolve(makeRedfinAutocompleteResponse());
      return Promise.resolve(makeRedfinDetailsResponse(620000, "Active"));
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("redfin");
    expect(result.listingStatus).toBe("active");
  });

  it("handles both providers returning null — returns source: null with lastVerifiedAt", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("moveaws")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ autocomplete: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(`{}&&${JSON.stringify({ payload: { sections: [] } })}`),
        json: () => Promise.resolve({ autocomplete: [] }),
      });
    });

    const result = await lookupPropertyDetails("999 Nonexistent St, Nowhere, TX 00000");
    expect(result.source).toBeNull();
    expect(result.listingStatus).toBeNull();
    expect(result.lastVerifiedAt).toBeTruthy();
  });

  it("handles already-active property with updated list price via hulk", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("moveaws")) return Promise.resolve(makeAutocompleteResponse("M12345"));
      if (url.includes("hulk_main_srp")) return Promise.resolve(makeHulkResponse("for_sale", 625000));
      if (url.includes("autocomplete")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`{}&&${JSON.stringify({ payload: { sections: [] } })}`),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("realtor");
    expect(result.listingStatus).toBe("active");
    expect(result.listPrice).toBe(625000);
  });

  it("sends the address to the Realtor autocomplete as a URL query param", async () => {
    const capturedUrls: string[] = [];
    mockFetch.mockImplementation((url: string) => {
      capturedUrls.push(url);
      if (url.includes("moveaws")) return Promise.resolve(makeAutocompleteResponse("M12345"));
      if (url.includes("hulk_main_srp")) return Promise.resolve(makeHulkResponse("for_sale"));
      if (url.includes("autocomplete")) return Promise.resolve(makeRedfinAutocompleteResponse());
      return Promise.resolve(makeRedfinDetailsResponse(620000, "Active"));
    });

    await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    const autocompleteUrl = capturedUrls.find((u) => u.includes("moveaws"));
    expect(autocompleteUrl).toBeTruthy();
    expect(autocompleteUrl).toContain("4920");
    expect(autocompleteUrl).toContain("Naphill");
  });

  it("sends the original address with ZIP+4 to autocomplete unchanged", async () => {
    const capturedUrls: string[] = [];
    mockFetch.mockImplementation((url: string) => {
      capturedUrls.push(url);
      if (url.includes("moveaws")) return Promise.resolve(makeAutocompleteResponse("M12345"));
      if (url.includes("hulk_main_srp")) return Promise.resolve(makeHulkResponse("for_sale"));
      if (url.includes("autocomplete")) return Promise.resolve(makeRedfinAutocompleteResponse());
      return Promise.resolve(makeRedfinDetailsResponse(620000, "Active"));
    });

    await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070-1234");
    const autocompleteUrl = capturedUrls.find((u) => u.includes("moveaws"));
    expect(autocompleteUrl).toBeTruthy();
    const decodedUrl = decodeURIComponent((autocompleteUrl ?? "").replace(/\+/g, " "));
    expect(decodedUrl).toContain("4920 Naphill Rd");
  });

  // ── Regression: 4920 Naphill Rd, McKinney, TX 75070 ─────────────────────
  it("regression: Redfin still runs when Realtor GraphQL returns 404", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("moveaws")) return Promise.resolve(makeAutocompleteResponse("M12345"));
      if (url.includes("hulk_main_srp")) return Promise.resolve(hulk404Response());
      if (url.includes("realestateandhomes-search")) return Promise.resolve(emptyHtmlSearch());
      if (url.includes("autocomplete")) return Promise.resolve(makeRedfinAutocompleteResponse());
      return Promise.resolve(makeRedfinDetailsResponse(620000, "Active"));
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("redfin");
    expect(result.listPrice).toBe(620000);
  });

  it("regression: Redfin still runs when Realtor GraphQL returns 403", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("moveaws")) return Promise.resolve(makeAutocompleteResponse("M12345"));
      if (url.includes("hulk_main_srp")) return Promise.resolve({ ok: false, status: 403 });
      if (url.includes("realestateandhomes-search")) return Promise.resolve(emptyHtmlSearch());
      if (url.includes("autocomplete")) return Promise.resolve(makeRedfinAutocompleteResponse());
      return Promise.resolve(makeRedfinDetailsResponse(620000, "Active"));
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("redfin");
  });

  it("rdc_search_srp is no longer referenced: hulk_main_srp is called instead", async () => {
    const capturedUrls: string[] = [];
    mockFetch.mockImplementation((url: string) => {
      capturedUrls.push(url);
      if (url.includes("moveaws")) return Promise.resolve(makeAutocompleteResponse("M12345"));
      if (url.includes("hulk_main_srp")) return Promise.resolve(makeHulkResponse("for_sale"));
      if (url.includes("autocomplete")) return Promise.resolve(makeRedfinAutocompleteResponse());
      return Promise.resolve(makeRedfinDetailsResponse(620000, "Active"));
    });

    await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    const rdcCall = capturedUrls.find((u) => u.includes("rdc_search_srp"));
    expect(rdcCall).toBeUndefined();
    const hulkCall = capturedUrls.find((u) => u.includes("hulk_main_srp"));
    expect(hulkCall).toBeTruthy();
  });

  it("listing status is not set to active based on price alone when status is missing", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("moveaws")) return Promise.resolve(makeAutocompleteResponse("M12345"));
      if (url.includes("hulk_main_srp")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: {
                home_search: {
                  results: [
                    {
                      property_id: "M12345",
                      status: null,
                      list_price: 500000,
                      beds: 3,
                      baths_full: 2,
                      sqft: 1800,
                      permalink: "/realestateandhomes-detail/4920-Naphill-Rd_McKinney_TX_75070_M12345",
                    },
                  ],
                },
              },
            }),
        });
      }
      if (url.includes("autocomplete")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`{}&&${JSON.stringify({ payload: { sections: [] } })}`),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    if (result.source === "realtor") {
      expect(result.listingStatus).not.toBe("active");
    }
  });

  it("HTML fallback path: parses detail page when GraphQL fails and search finds a match", async () => {
    const detailHtml = `<html><head>
      <script type="application/ld+json">{
        "@type": "SingleFamilyResidence",
        "offers": { "price": 599000, "availability": "http://schema.org/InStock" },
        "numberOfRooms": 4,
        "floorSize": { "value": 2400 }
      }</script></head></html>`;

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("moveaws")) return Promise.resolve(makeAutocompleteResponse("M12345"));
      if (url.includes("hulk_main_srp")) return Promise.resolve(emptyHulkResponse());
      if (url.includes("realestateandhomes-search")) {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              `<html><a href="/realestateandhomes-detail/4920-Naphill-Rd_McKinney_TX">listing</a></html>`,
            ),
        });
      }
      if (url.includes("realestateandhomes-detail")) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(detailHtml) });
      }
      if (url.includes("autocomplete")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`{}&&${JSON.stringify({ payload: { sections: [] } })}`),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const result = await lookupPropertyDetails("4920 Naphill Rd, McKinney, TX 75070");
    expect(result.source).toBe("realtor");
    expect(result.listPrice).toBe(599000);
    expect(result.beds).toBe(4);
    expect(result.squareFeet).toBe(2400);
  });
});
