export type Business = {
  id: string;
  provider: string;
  providerId: string;
  osmType: string;
  name: string;
  category: string;
  address: string;
  city: string;
  region: string;
  country: string;
  postcode: string;
  latitude: number;
  longitude: number;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  websiteStatus: string;
  openingHours: string;
  facebook: string;
  instagram: string;
  leadScore: number;
  leadClassification: string;
  contactQuality: string;
  osmLink: string;
  rawData: Record<string, string>;
  foundAt: string;
};
export const statuses = [
  "New",
  "Researching",
  "Verified",
  "Contacted",
  "Interested",
  "Follow Up",
  "Client",
  "Not Interested",
  "Archived",
];
export const verificationStatuses = [
  "Not Verified",
  "Verified — No Website Found",
  "Verified — Website Exists",
  "Needs More Research",
  "Incorrect Business",
];
export type Lead = {
  business: Business;
  status: string;
  verification: string;
  verified: Record<string, string>;
  notes: string;
  history: { date: string; method: string; notes: string }[];
  savedAt: string;
};
export function normalizeUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    return /^https?:$/.test(url.protocol) &&
      url.hostname.includes(".") &&
      !/\s/.test(value)
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export function normalizeBusiness(e: any, category: string): Business {
  const t = e.tags || {};
  const get = (key: string) => t[`contact:${key}`] || t[key] || "";
  const original = get("website") || t.url || t["contact:url"] || "";
  const website = normalizeUrl(original);
  const facebook = get("facebook"),
    instagram = get("instagram");
  const phone = get("phone") || get("mobile");
  const email = get("email");
  const street = [t["addr:housenumber"], t["addr:street"]]
    .filter(Boolean)
    .join(" ");
  const city = t["addr:city"] || t["addr:town"] || t["addr:village"] || "";
  const address = [
    street,
    t["addr:suburb"],
    city,
    t["addr:state"],
    t["addr:country"],
  ]
    .filter(Boolean)
    .join(", ");
  const websiteStatus = website
    ? "Website Found"
    : original
      ? "Unknown"
      : "No Website Found";
  const score = Math.min(
    100,
    (websiteStatus === "No Website Found" ? 40 : 0) +
      (phone ? 20 : 0) +
      (email ? 15 : 0) +
      (facebook || instagram ? 10 : 0) +
      (street && city ? 5 : 0) +
      (t.opening_hours ? 5 : 0) +
      (t.name ? 5 : 0),
  );
  return {
    id: `osm:${e.type}:${e.id}`,
    provider: "OpenStreetMap",
    providerId: String(e.id),
    osmType: e.type,
    name: t.name || "",
    category,
    address,
    city,
    region: t["addr:state"] || "",
    country: t["addr:country"] || "",
    postcode: t["addr:postcode"] || "",
    latitude: e.lat ?? e.center?.lat,
    longitude: e.lon ?? e.center?.lon,
    phone,
    mobile: get("mobile"),
    email,
    website,
    websiteStatus,
    openingHours: t.opening_hours || "",
    facebook,
    instagram,
    leadScore: score,
    leadClassification:
      score >= 80
        ? "HOT LEAD"
        : score >= 55
          ? "GOOD LEAD"
          : score >= 30
            ? "POSSIBLE LEAD"
            : "LOW DATA",
    contactQuality:
      phone && email
        ? "Excellent"
        : phone
          ? "Good"
          : email || facebook || instagram
            ? "Medium"
            : "Low",
    osmLink: `https://www.openstreetmap.org/${e.type}/${e.id}`,
    rawData: t,
    foundAt: new Date().toISOString(),
  };
}
export function deduplicate(items: Business[]) {
  const ids = new Set<string>(),
    locations = new Set<string>();
  return items.filter((b) => {
    const key = `${b.name.toLowerCase()}|${b.latitude?.toFixed(5)}|${b.longitude?.toFixed(5)}`;
    if (ids.has(b.id) || (b.name && locations.has(key))) return false;
    ids.add(b.id);
    if (b.name) locations.add(key);
    return true;
  });
}
export function verifyLink(b: Business, kind = "website phone") {
  return `https://www.google.com/search?q=${encodeURIComponent(`"${b.name || b.category}" "${b.city || b.address || `${b.latitude}, ${b.longitude}`}" ${kind}`)}`;
}
export function csv(rows: Lead[]) {
  const headers = [
    "Business Name",
    "Category",
    "Address",
    "City",
    "State",
    "Country",
    "Phone",
    "Email",
    "Website",
    "Website Status",
    "Verified Website",
    "Verified Phone",
    "Verified Email",
    "Lead Score",
    "Lead Classification",
    "Verification Status",
    "Lead Status",
    "Notes",
    "Latitude",
    "Longitude",
    "OSM Link",
  ];
  const escape = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    headers,
    ...rows.map((l) => {
      const b = l.business;
      return [
        b.name,
        b.category,
        b.address,
        b.city,
        b.region,
        b.country,
        b.phone,
        b.email,
        b.website,
        b.websiteStatus,
        l.verified.website,
        l.verified.phone,
        l.verified.email,
        b.leadScore,
        b.leadClassification,
        l.verification,
        l.status,
        l.notes,
        b.latitude,
        b.longitude,
        b.osmLink,
      ];
    }),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
}
export const newLead = (business: Business): Lead => ({
  business,
  status: "New",
  verification: "Not Verified",
  verified: {},
  notes: "",
  history: [],
  savedAt: new Date().toISOString(),
});
