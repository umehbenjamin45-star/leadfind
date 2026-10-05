import { normalizeBusiness, deduplicate, type Business } from "./model";
export interface BusinessDataProvider {
  searchBusinesses(query: {
    location: string;
    category: string;
    limit: number;
    radius: number;
    refresh?: boolean;
  }): Promise<{ businesses: Business[]; location: string; cached: boolean }>;
  normalizeBusiness(element: unknown, category: string): Business;
  getBusinessDetails(business: Business): Business;
}
export class OpenStreetMapProvider implements BusinessDataProvider {
  normalizeBusiness = normalizeBusiness;
  getBusinessDetails = (business: Business) => business;
  async searchBusinesses(
    query: Parameters<BusinessDataProvider["searchBusinesses"]>[0],
  ) {
    // Browser caching survives serverless cold starts. Server limits still apply.
    const key = JSON.stringify([
      query.location.trim().toLowerCase(),
      query.category,
      query.limit,
      query.radius,
    ]);
    let cache: Record<string, { time: number; data: any }> = {};
    let lastRequest = 0;
    try {
      cache = JSON.parse(localStorage.getItem("leadfind:searchCache") || "{}");
      lastRequest = Number(localStorage.getItem("leadfind:lastRequest") || 0);
    } catch {
      /* Storage is optional; the server still protects requests. */
    }
    const entry = cache[key];
    if (!query.refresh && entry && Date.now() - entry.time < 30 * 60 * 1000) {
      return {
        businesses: deduplicate(
          entry.data.elements.map((e: unknown) =>
            this.normalizeBusiness(e, query.category),
          ),
        ),
        location: entry.data.location,
        cached: true,
      };
    }
    if (Date.now() - lastRequest < 10000)
      throw new Error(
        "Please wait 10 seconds between searches. Cached searches remain available.",
      );
    try {
      localStorage.setItem("leadfind:lastRequest", String(Date.now()));
    } catch {
      /* optional */
    }
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Business data service is temporarily unavailable. Please try again shortly.",
      );
    }
    if (!response.ok)
      throw new Error(
        data.error ||
          "Business data service is temporarily unavailable. Please try again shortly.",
      );
    try {
      cache[key] = { time: Date.now(), data };
      const retained = Object.fromEntries(
        Object.entries(cache)
          .filter(([, v]) => Date.now() - v.time < 30 * 60 * 1000)
          .sort((a, b) => b[1].time - a[1].time)
          .slice(0, 10),
      );
      localStorage.setItem("leadfind:searchCache", JSON.stringify(retained));
    } catch {
      /* Full/private storage does not prevent searching. */
    }
    return {
      businesses: deduplicate(
        data.elements.map((e: unknown) =>
          this.normalizeBusiness(e, query.category),
        ),
      ),
      location: data.location,
      cached: data.cached,
    };
  }
}
