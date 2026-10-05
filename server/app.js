import { fetch, EnvHttpProxyAgent } from "undici";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const categories = JSON.parse(
  fs.readFileSync(path.join(root, "src/categories.json"), "utf8"),
);
const app = express();
app.use(express.json({ limit: "16kb" }));
const cache = new Map(),
  geoCache = new Map();
let lastSearch = 0,
  lastGeo = 0;
let busy = false;
const dispatcher = new EnvHttpProxyAgent();
const ttl = 30 * 60 * 1000;
async function request(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    dispatcher,
    headers: {
      "User-Agent":
        process.env.LEADFIND_USER_AGENT ||
        "LEADFIND/1.0 (+https://github.com/umehbenjamin45-star/leadfind)",
      ...options.headers,
    },
    signal: AbortSignal.timeout(40000),
  });
  if (!r.ok) throw new Error(`Upstream HTTP ${r.status}`);
  return r.json();
}
app.get("/api/health", (_, res) =>
  res.json({ ok: true, provider: "OpenStreetMap" }),
);
app.post("/api/search", async (req, res) => {
  const { location, category, refresh = false } = req.body || {};
  const limit = Number(req.body.limit ?? 50),
    radius = Number(req.body.radius ?? 3000);
  if (
    typeof location !== "string" ||
    !location.trim() ||
    location.length > 180 ||
    typeof category !== "string" ||
    category.length > 60 ||
    ![25, 50, 100].includes(limit) ||
    ![1000, 3000, 5000, 10000].includes(radius)
  )
    return res.status(400).json({
      error:
        "Please enter a location and choose a supported search limit and radius.",
    });
  const key = JSON.stringify([
    location.trim().toLowerCase(),
    category,
    limit,
    radius,
  ]);
  const cached = cache.get(key);
  if (!refresh && cached && Date.now() - cached.time < ttl)
    return res.json({ ...cached.data, cached: true });
  if (busy || Date.now() - lastSearch < 10000)
    return res.status(429).json({
      error:
        "Please wait 10 seconds between searches. Cached searches remain available.",
    });
  let tags = categories[category];
  if (!tags) {
    const m = category.match(
      /^(amenity|shop|tourism|office|craft|leisure|healthcare)=([a-z_]+)$/,
    );
    if (!m)
      return res.status(400).json({
        error: "For custom searches use an OSM tag, for example shop=books.",
      });
    tags = [[m[1], m[2]]];
  }
  busy = true;
  lastSearch = Date.now();
  try {
    let geo = geoCache.get(location.trim().toLowerCase());
    if (!geo) {
      const wait = Math.max(0, 1100 - (Date.now() - lastGeo));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      lastGeo = Date.now();
      const places = await request(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(location)}`,
      );
      if (!places.length)
        return res.status(404).json({
          error: "Location could not be found. Please refine the location.",
        });
      geo = places[0];
      geoCache.set(location.trim().toLowerCase(), geo);
    }
    const lat = Number(geo.lat),
      lon = Number(geo.lon);
    const clauses = tags
      .map(
        ([k, v, k2, v2]) =>
          `nwr(around:${radius},${lat},${lon})["${k}"${v === "*" ? "" : `="${v}"`} ]${k2 ? `["${k2}"="${v2}"]` : ""};`,
      )
      .join("");
    const query = `[out:json][timeout:35];(${clauses});out center tags ${limit};`;
    const data = await request("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
    });
    const result = {
      elements: data.elements.slice(0, limit),
      location: geo.display_name,
      cached: false,
    };
    cache.set(key, { time: Date.now(), data: result });
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    res.json(result);
  } catch (error) {
    console.error("Business search failed:", error.message);
    res.status(503).json({
      error:
        "Business data service is temporarily unavailable. Please try again shortly.",
    });
  } finally {
    busy = false;
  }
});

export default app;
