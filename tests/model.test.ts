import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBusiness,
  normalizeUrl,
  deduplicate,
  csv,
  newLead,
  verifyLink,
} from "../src/model";
const element = {
  id: 123,
  type: "node",
  lat: 7.25,
  lon: 5.2,
  tags: {
    name: "Test fixture",
    phone: "+2348000000000",
    email: "fixture@example.com",
    "contact:instagram": "fixture",
    "addr:street": "Test Street",
    "addr:city": "Akure",
    opening_hours: "Mo-Fr 09:00-17:00",
  },
};
test("contact tags and all scoring rules yield hot lead without fabricated fields", () => {
  const b = normalizeBusiness(element, "Restaurant");
  assert.equal(b.leadScore, 100);
  assert.equal(b.websiteStatus, "No Website Found");
  assert.equal(b.contactQuality, "Excellent");
  assert.equal(b.country, "");
  assert.equal(b.website, "");
  assert.equal(b.osmLink, "https://www.openstreetmap.org/node/123");
});
test("valid website removes opportunity points; invalid website is unknown", () => {
  const b = normalizeBusiness(
    { ...element, tags: { ...element.tags, "contact:website": "example.com" } },
    "Restaurant",
  );
  assert.equal(b.website, "https://example.com/");
  assert.equal(b.leadScore, 60);
  assert.equal(
    normalizeBusiness(
      { ...element, tags: { website: "javascript:alert(1)" } },
      "Restaurant",
    ).websiteStatus,
    "Unknown",
  );
  assert.equal(normalizeUrl("javascript:alert(1)"), "");
});
test("way centers, empty fields, duplicate IDs and locations", () => {
  const b = normalizeBusiness(
    { id: 3, type: "way", center: { lat: 1, lon: 2 }, tags: {} },
    "School",
  );
  assert.equal(b.latitude, 1);
  assert.equal(b.leadScore, 40);
  assert.equal(b.contactQuality, "Low");
  assert.equal(deduplicate([b, b]).length, 1);
});
test("CSV quotes multiline notes and neutralizes formula injection", () => {
  const l = newLead(normalizeBusiness(element, "Restaurant"));
  l.notes = '=HYPERLINK("evil")\nsecond line';
  const output = csv([l]);
  assert.ok(output.includes('"\'=HYPERLINK(""evil"")\nsecond line"'));
  assert.ok(output.includes("Verified Website"));
});
test("verification opens an encoded search and preserves source data", () => {
  const b = normalizeBusiness(element, "Restaurant");
  assert.ok(verifyLink(b).includes("Akure"));
  const lead = newLead(b);
  lead.verified.phone = "123";
  assert.equal(lead.business.phone, "+2348000000000");
});
