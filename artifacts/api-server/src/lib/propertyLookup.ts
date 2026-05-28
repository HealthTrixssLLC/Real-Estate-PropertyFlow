export interface PropertyLookupResult {
  source: "realtor" | "redfin" | null;
  beds?: number | null;
  baths?: number | null;
  squareFeet?: number | null;
  listPrice?: number | null;
  mlsId?: string | null;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function lookupRealtor(address: string): Promise<PropertyLookupResult | null> {
  const url = `https://www.realtor.com/api/v1/rdc_search_srp?client_id=rdc-search-new-communities&schema=vesta`;
  const body = JSON.stringify({
    query: `query HomeSearch($query: home_search_criteria, $limit: Int) {
      home_search(query: $query, limit: $limit) {
        results {
          property {
            beds
            baths_consolidated
            sqft
            list_price
            mpr_id
          }
          listing_id
        }
      }
    }`,
    variables: {
      query: {
        status: ["for_sale", "recently_sold"],
        address,
      },
      limit: 1,
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
    if (!res.ok) return null;

    const data = (await res.json()) as {
      data?: {
        home_search?: {
          results?: Array<{
            listing_id?: string;
            property?: {
              beds?: number;
              baths_consolidated?: number;
              sqft?: number;
              list_price?: number;
              mpr_id?: string;
            };
          }>;
        };
      };
    };

    const results = data?.data?.home_search?.results;
    if (!results?.length) return null;
    const prop = results[0].property;
    if (!prop) return null;

    const beds = prop.beds ?? null;
    const baths = prop.baths_consolidated ?? null;
    const squareFeet = prop.sqft ?? null;
    const listPrice = prop.list_price ?? null;
    const mlsId = results[0].listing_id ?? prop.mpr_id ?? null;

    if (beds == null && baths == null && squareFeet == null && listPrice == null && mlsId == null) {
      return null;
    }
    return { source: "realtor", beds, baths, squareFeet, listPrice, mlsId };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function lookupRedfin(address: string): Promise<PropertyLookupResult | null> {
  const encoded = encodeURIComponent(address);

  const controller1 = new AbortController();
  const timeout1 = setTimeout(() => controller1.abort(), 6000);
  let propertyId: string | null = null;
  let url2: string | null = null;

  try {
    const autocompleteRes = await fetch(
      `https://www.redfin.com/stingray/api/search/autocomplete?location=${encoded}&v=2`,
      {
        headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
        signal: controller1.signal,
      }
    );
    clearTimeout(timeout1);
    if (!autocompleteRes.ok) return null;

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
    if (!homeRow?.id) return null;

    if (homeRow.id.tableId) {
      propertyId = homeRow.id.tableId;
    }
    if (homeRow.id.url) {
      url2 = homeRow.id.url;
    }
  } catch {
    clearTimeout(timeout1);
    return null;
  }

  if (!propertyId && !url2) return null;

  const controller2 = new AbortController();
  const timeout2 = setTimeout(() => controller2.abort(), 6000);
  try {
    const detailsUrl = propertyId
      ? `https://www.redfin.com/stingray/api/home/details/belowTheFold?propertyId=${propertyId}&accessLevel=3&v=11`
      : `https://www.redfin.com${url2}`;

    const detailsRes = await fetch(detailsUrl, {
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
      signal: controller2.signal,
    });
    clearTimeout(timeout2);
    if (!detailsRes.ok) return null;

    const text = await detailsRes.text();
    const data = JSON.parse(text.replace(/^{}&&/, "")) as {
      payload?: {
        mainHouseInfo?: {
          beds?: number;
          baths?: number;
          sqFt?: { value?: number };
          priceInfo?: { amount?: number };
          mlsId?: string;
        };
        publicRecordsInfo?: {
          basicInfo?: {
            beds?: number;
            baths?: number;
            sqFt?: { value?: number };
          };
        };
      };
    };

    const info = data?.payload?.mainHouseInfo;
    if (!info) return null;

    const beds = info.beds ?? null;
    const baths = info.baths ?? null;
    const squareFeet = info.sqFt?.value ?? null;
    const listPrice = info.priceInfo?.amount ?? null;
    const mlsId = info.mlsId ?? null;

    if (beds == null && baths == null && squareFeet == null && listPrice == null && mlsId == null) {
      return null;
    }
    return { source: "redfin", beds, baths, squareFeet, listPrice, mlsId };
  } catch {
    clearTimeout(timeout2);
    return null;
  }
}

export async function lookupPropertyDetails(address: string): Promise<PropertyLookupResult> {
  const empty: PropertyLookupResult = { source: null };
  if (!address?.trim()) return empty;
  try {
    const realtorResult = await lookupRealtor(address);
    if (realtorResult) return realtorResult;
    const redfinResult = await lookupRedfin(address);
    if (redfinResult) return redfinResult;
  } catch {
    // best-effort
  }
  return empty;
}
