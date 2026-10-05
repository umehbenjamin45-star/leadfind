# Validation — 4 October 2026

- Node 24.19.0, npm 11.9.0; frozen installation (`npm ci`) passed.
- `npm run build`: TypeScript and Vite production build passed.
- `npm test`: 5 tests passed covering score rules, contact tags, website status, way centers, duplicate detection, CSV escaping/formula protection, and verification links.
- `npx playwright test`: 3 Chromium tests passed. Desktop/mobile navigation, no horizontal mobile overflow, saved lead persistence through reload, separate verified phone, notes and contact history were checked with clearly labeled test-only fixtures. The third test used live OSM data for Akure schools, no-website filtering, CSV download and Leaflet markers.
- Live 10 km searches with a 25-result limit returned HTTP 200: Akure School 25, Ikeja Restaurant 25, Lagos Bakery 6, Ibadan Pharmacy 19, Abuja Hotel 25. Counts represent retrieved OSM records, including unnamed records; they are not exhaustive business counts.
- Akure Restaurant at 3 km returned HTTP 200 with 0 results. This is sparse mapped coverage, not an integration error.
- Repeated identical Akure School search returned cached:true without another upstream request.
- API health and frontend HTML requests passed. Production health and nested SPA route passed.
- Desktop screenshot visually reviewed; mobile layout checked in Chromium.

Supabase authentication and cloud storage are implemented but untested without a user project. Local browser persistence needs no credentials. No fake businesses are included in application code. Live public services can be busy or change data; live tests depend on their availability.

Configuration draft saved: installation script, startup instructions, and custom OSM/font network domains. Saving does not publish the environment. A new task restored from a published snapshot has not been independently tested.

## Vercel preparation — 5 October 2026

- Split the reusable Express app from the local listening server; added Vercel function routing, Node 24 pin, 60-second function limit, and safe response headers.
- Added browser caching and cooldown persistence for serverless cold starts.
- Production build and all 3 browser tests passed after adaptation.
- The exported serverless handler was exercised locally: health HTTP 200, invalid input HTTP 400, live Akure School search HTTP 200 with 25 records.
- Vercel account authentication is not present in this workspace. A deployed Vercel URL and platform routing remain unverified.
- Vercel Hobby's commercial-use restriction may conflict with this business prospecting use case; free local operation remains available.
