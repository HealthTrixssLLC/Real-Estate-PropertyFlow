/**
 * Browser-side property fetch utilities.
 *
 * These run in the user's browser (real IP) rather than on the server,
 * bypassing server-IP blocking that affects server-side scraping.
 *
 * CORS note: both fetches are wrapped in try/catch — if a provider blocks
 * cross-origin reads the candidate is silently omitted and the other is used.
 */

export interface PropertyCandidate {
  source: "realtor" | "redfin"
  beds?: number | null
  baths?: number | null
  squareFeet?: number | null
  listPrice?: number | null
  mlsId?: string | null
  listingStatus: "active" | "recently_sold" | "off_market" | "unknown" | null
  listingUrl?: string | null
  listingDate?: string | null
  lastVerifiedAt: string
}

export interface BrowserFetchResult {
  realtorCandidates: PropertyCandidate[]
  redfinCandidate: PropertyCandidate | null
}

function mapRedfinStatus(
  rawStatus: string | undefined | null,
  isSold: boolean,
  listPrice: number | null,
): PropertyCandidate["listingStatus"] {
  if (rawStatus) {
    const lower = rawStatus.toLowerCase()
    if (
      lower.includes("active") ||
      lower.includes("for_sale") ||
      lower.includes("for sale") ||
      lower === "fs" ||
      lower === "fs_active"
    )
      return "active"
    if (lower.includes("sold") || lower === "s" || lower === "rs") return "recently_sold"
    if (
      lower.includes("off") ||
      lower.includes("withdrawn") ||
      lower.includes("expired") ||
      lower === "d"
    )
      return "off_market"
    if (lower.includes("pending") || lower.includes("contract")) return "active"
    return "unknown"
  }
  return isSold ? "recently_sold" : listPrice != null ? "active" : "unknown"
}

async function browserFetchRealtor(address: string): Promise<PropertyCandidate[]> {
  const encoded = encodeURIComponent(address)
  const url = `/api/property-lookup/realtor?address=${encoded}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      credentials: "include",
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return []

    const outcome = (await res.json()) as {
      result?: PropertyCandidate | null
      candidates?: PropertyCandidate[]
    }

    if (outcome.candidates?.length) return outcome.candidates
    if (outcome.result) return [outcome.result]
    return []
  } catch {
    clearTimeout(timeout)
    return []
  }
}

async function browserFetchRedfin(address: string): Promise<PropertyCandidate | null> {
  const encoded = encodeURIComponent(address)
  const autocompleteUrl = `https://www.redfin.com/stingray/api/search/autocomplete?location=${encoded}&v=2`

  let propertyId: string | null = null
  let propertyUrl: string | null = null

  const controller1 = new AbortController()
  const timeout1 = setTimeout(() => controller1.abort(), 8000)
  try {
    const res = await fetch(autocompleteUrl, {
      headers: { Accept: "application/json" },
      signal: controller1.signal,
    })
    clearTimeout(timeout1)
    if (!res.ok) return null

    const text = await res.text()
    const json = JSON.parse(text.replace(/^\{\}&&/, "")) as {
      payload?: {
        sections?: Array<{
          rows?: Array<{
            id?: { type?: string; tableId?: string; url?: string }
          }>
        }>
      }
    }

    const rows = json?.payload?.sections?.flatMap((s) => s.rows ?? []) ?? []
    const homeRow = rows.find(
      (r) => r.id?.type === "2" || r.id?.url?.includes("/home/"),
    )
    if (!homeRow?.id) return null

    if (homeRow.id.tableId) propertyId = homeRow.id.tableId
    if (homeRow.id.url) propertyUrl = homeRow.id.url
  } catch {
    clearTimeout(timeout1)
    return null
  }

  if (!propertyId && !propertyUrl) return null

  const listingUrl = propertyUrl ? `https://www.redfin.com${propertyUrl}` : null
  const isSold = propertyUrl?.includes("/sold/") ?? false

  if (propertyId) {
    const detailsUrl = `https://www.redfin.com/stingray/api/home/details/aboveTheFold?propertyId=${propertyId}&accessLevel=3&v=11`
    const controller2 = new AbortController()
    const timeout2 = setTimeout(() => controller2.abort(), 8000)
    try {
      const res2 = await fetch(detailsUrl, {
        headers: { Accept: "application/json" },
        signal: controller2.signal,
      })
      clearTimeout(timeout2)
      if (res2.ok) {
        const text = await res2.text()
        const data = JSON.parse(text.replace(/^\{\}&&/, "")) as {
          payload?: {
            mainHouseInfo?: {
              beds?: number
              baths?: number
              sqFt?: { value?: number }
              priceInfo?: { amount?: number }
              mlsId?: string
              status?: string
              listingStatus?: string
              saleStatus?: string
              listDate?: string
            }
            listingInfo?: {
              status?: string
              listingStatus?: string
              dateListed?: string
            }
          }
        }
        const info = data?.payload?.mainHouseInfo
        if (info) {
          const beds = info.beds ?? null
          const baths = info.baths ?? null
          const squareFeet = info.sqFt?.value ?? null
          const listPrice = info.priceInfo?.amount ?? null
          const mlsId = info.mlsId ?? null
          const rawStatus =
            info.status ??
            info.listingStatus ??
            info.saleStatus ??
            data?.payload?.listingInfo?.status ??
            data?.payload?.listingInfo?.listingStatus
          const listingDate =
            info.listDate ?? data?.payload?.listingInfo?.dateListed ?? null
          const listingStatus = mapRedfinStatus(rawStatus, isSold, listPrice)
          if (
            beds != null ||
            baths != null ||
            squareFeet != null ||
            listPrice != null ||
            mlsId != null
          ) {
            return {
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
            }
          }
        }
      } else {
        clearTimeout(timeout2)
      }
    } catch {
      clearTimeout(timeout2)
    }
  }

  if (listingUrl) {
    const controller3 = new AbortController()
    const timeout3 = setTimeout(() => controller3.abort(), 8000)
    try {
      const res3 = await fetch(listingUrl, {
        headers: { Accept: "text/html" },
        signal: controller3.signal,
      })
      clearTimeout(timeout3)
      if (res3.ok) {
        const html = await res3.text()
        const jsonLdMatch = html.match(
          /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
        )
        if (jsonLdMatch) {
          try {
            const ld = JSON.parse(jsonLdMatch[1]) as {
              offers?: { price?: number | string }
              numberOfRooms?: number | string
              floorSize?: { value?: number | string }
            }
            const listPrice =
              ld.offers?.price != null ? Number(ld.offers.price) : null
            const beds =
              ld.numberOfRooms != null ? Number(ld.numberOfRooms) : null
            const squareFeet =
              ld.floorSize?.value != null ? Number(ld.floorSize.value) : null
            if (
              (listPrice != null && !isNaN(listPrice)) ||
              (beds != null && !isNaN(beds)) ||
              (squareFeet != null && !isNaN(squareFeet))
            ) {
              const listingStatus: PropertyCandidate["listingStatus"] = isSold
                ? "recently_sold"
                : listPrice != null
                  ? "active"
                  : "unknown"
              return {
                source: "redfin",
                beds: beds != null && isNaN(beds) ? null : beds,
                baths: null,
                squareFeet:
                  squareFeet != null && isNaN(squareFeet) ? null : squareFeet,
                listPrice:
                  listPrice != null && isNaN(listPrice) ? null : listPrice,
                mlsId: null,
                listingStatus,
                listingUrl,
                listingDate: null,
                lastVerifiedAt: new Date().toISOString(),
              }
            }
          } catch {
          }
        }
      }
    } catch {
      clearTimeout(timeout3)
    }
  }

  return null
}

export async function browserFetchPropertyCandidates(
  address: string,
): Promise<BrowserFetchResult> {
  const [realtorResult, redfinResult] = await Promise.allSettled([
    browserFetchRealtor(address),
    browserFetchRedfin(address),
  ])
  return {
    realtorCandidates:
      realtorResult.status === "fulfilled" ? realtorResult.value : [],
    redfinCandidate:
      redfinResult.status === "fulfilled" ? redfinResult.value : null,
  }
}
