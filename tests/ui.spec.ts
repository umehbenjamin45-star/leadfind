import { test, expect } from "@playwright/test";
test("empty real-data workspace and navigation work on desktop and mobile", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5173");
  await expect(
    page.getByRole("heading", { name: "Find local businesses", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your next client could be around the corner"),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Leads/ }).click();
  await expect(page.getByText("No saved leads yet")).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("Local mode active")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("button", { name: "Find Businesses", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Search businesses", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("lead verification, notes, contact history, export and reload with explicit test fixture", async ({
  page,
}) => {
  await page.route("**/api/search", (route) =>
    route.fulfill({
      json: {
        location: "Akure",
        cached: false,
        elements: [
          {
            id: 123,
            type: "node",
            lat: 7.25,
            lon: 5.2,
            tags: {
              name: "UI test fixture",
              phone: "+2348000000000",
              "addr:city": "Akure",
            },
          },
        ],
      },
    }),
  );
  await page.goto("http://127.0.0.1:5173");
  await page
    .getByRole("button", { name: "Search businesses", exact: true })
    .click();
  await page
    .getByRole("button", { name: "UI test fixture", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("No website found in available business data."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Save lead", exact: true }).click();
  await dialog
    .getByLabel("Verification status")
    .selectOption("Verified — No Website Found");
  await dialog.getByLabel("Verified phone", { exact: true }).fill("12345");
  await dialog.getByLabel("Research notes").fill("Called owner.");
  await dialog.getByLabel("Contact notes").fill("Follow up next week");
  await dialog.getByRole("button", { name: "Record contact" }).click();
  await expect(dialog.getByText("Follow up next week")).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Verify Online", exact: true }),
  ).toHaveAttribute("href", /google.com\/search/);
  await page.getByRole("button", { name: "Close details" }).click();
  await page.reload();
  await page.getByRole("button", { name: /^Leads/ }).click();
  await page
    .getByRole("button", { name: "UI test fixture", exact: true })
    .click();
  await expect(page.getByLabel("Verified phone", { exact: true })).toHaveValue(
    "12345",
  );
  await expect(page.getByLabel("Research notes")).toHaveValue("Called owner.");
});

test('live Akure OSM search, filtering, map and CSV download',async({page})=>{
  test.setTimeout(65000);
  await page.goto('http://127.0.0.1:5173');
  await page.getByLabel('Business category',{exact:true}).fill('School');
  await page.getByLabel('Results',{exact:true}).selectOption('25');
  await page.getByLabel('Radius',{exact:true}).selectOption('10000');
  await page.getByRole('button',{name:'Search businesses',exact:true}).click();
  await expect(page.getByRole('button',{name:'Fiwasaye Grammar School',exact:true})).toBeVisible({timeout:60000});
  await page.getByLabel('Website status',{exact:true}).selectOption('No Website Found');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export filtered',exact:true}).click();
  expect((await download).suggestedFilename()).toMatch(/leadfind.*\.csv/);
  await page.getByRole('button',{name:'map view',exact:true}).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.leaflet-interactive').first()).toBeVisible();
});
