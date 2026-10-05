# LEADFIND
Find local businesses that may need a website. A personal, $0-start prospecting tool using real OpenStreetMap data. No paid API keys, Google Maps scraping, AI, or automated outreach.

## Run locally
Node 22.12+ (validated with Node 24) and npm are required.

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```
Vite serves the frontend on port 5173 and proxies `/api` to the Express API on port 3001. Start both with `npm run dev`. Production: `npm run build`, then `npm start` (port 3001).

```sh
npm test
npm run build
npx playwright test # with dev servers running and Chromium installed
```

See VALIDATION.md for current-instance results.

## Workflow
Find → filter → manually verify → save → record contact → export. Search by location, category (or custom OSM tag such as `shop=books`), radius, and limit. Results contain only available OSM fields. Missing fields show **Not Available**. “No Website Found” means no website is listed in OSM, not proof a website does not exist. An invalid website field is **Unknown**. Verify Online opens a normal external web search; nothing is scraped from search results.

Leads, separate verified fields, notes, contact history, ignored businesses, results, and search history persist in browser localStorage. Settings offers a JSON backup/merge restore; CSV export supports all, filtered, selected, and saved leads. Local data stays in that browser. Clear browser storage only after a backup. No demo companies are supplied.

## Free optional Supabase persistence
Create a Supabase free project, run `supabase/schema.sql` in its SQL editor, enable email/password authentication, and set the values below in `.env.local`. Use the public anon key; never put a service-role key in the frontend. Restart Vite after editing configuration.

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Settings supports account creation, sign-in, upload of the current local lead workspace, and a merge of cloud leads. Upload replaces that account's cloud snapshot; merge preserves existing local entries with the same OSM ID. RLS isolates each account. Search history stays local. The compact JSON schema avoids unnecessary CRM tables and preserves original vs verified data. Cloud sync requires your own free project; local mode is fully functional without one.

## Architecture and public-service protection
- `src/categories.json`: centralized OSM tag mapping. Some subtype tags are sparsely mapped; use broader School/Salon categories if needed.
- `src/provider.ts`: replaceable `BusinessDataProvider` and `OpenStreetMapProvider`.
- `src/model.ts`: normalization, safe website URLs, score rules, duplicate detection, safe CSV export.
- `server/index.js`: server-side Nominatim geocoding and Overpass retrieval, 10-second global cooldown, duplicate-query caching for 30 minutes, serialized upstream searches, 1.1-second geocoder spacing, request timeouts, 25/50/100 results, 1–10 km radii. No mass crawling or aggressive retries. After an error, retry manually after the cooldown.
- `src/Map.tsx`: Leaflet and OSM tiles with attribution. Public OSM tile service is for modest interactive use, not bulk downloads.

Required network destinations: `nominatim.openstreetmap.org`, `overpass-api.de`, `tile.openstreetmap.org`, `registry.npmjs.org`. Fonts optionally use `fonts.googleapis.com` and `fonts.gstatic.com`; system fallback fonts work without them. Optional Supabase requires your project's hostname.

Searches use a radius around the first geocoding result, not an entire city/state boundary. Refine neighbourhood names for precision. OSM coverage varies by area: no results or missing contacts are legitimate outcomes. Scores rank only retrieved businesses, not every business in a city. Overpass output limits are applied before lead scoring.

## Vercel deployment ($0 starting budget)
The repository now includes a Vercel function (`api/index.js`), static Vite output, and `vercel.json` routing. The API and local server share `server/app.js`.

1. Import `umehbenjamin45-star/leadfind` in Vercel with your GitHub account.
2. Choose Vite, keep the root directory at the repository root, build command `npm run build`, and output `dist`. Node 24 is pinned in package.json.
3. Deploy on the free Hobby plan if your usage meets Vercel's current plan terms. No business-data API keys are required.
4. Open the deployment and run a small Akure School search (10 km, 25 results). `/api/health` should return `ok:true`.
5. Optional Supabase configuration uses the two VITE variables above; add your deployment URL to Supabase authentication settings and redeploy after changing build variables.

Both API routes use one serverless function, with a 60-second maximum duration. Upstream requests time out at 40 seconds. Browser caching and a persisted 10-second cooldown survive function restarts; each warm server instance additionally caches and serializes requests. Server-side state is per instance, so this version remains a personal research tool. A public multi-user deployment needs a shared cache/rate limiter to enforce global upstream limits. There is no automatic retry or background crawling. Free hosting limits and permitted usage can change; Vercel Hobby restricts commercial usage, so verify eligibility for your intended business use before relying on it. Local use remains free regardless of hosting eligibility.

Never place private credentials or Supabase service-role keys in VITE variables. The public Supabase anon key is protected by the supplied RLS schema.

Business data © OpenStreetMap contributors, available under the ODbL. See https://www.openstreetmap.org/copyright.
