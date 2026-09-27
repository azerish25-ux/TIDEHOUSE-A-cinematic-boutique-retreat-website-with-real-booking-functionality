import { test, expect } from "@playwright/test";
import { addDays, today } from "../../lib/domain";

const arrival = addDays(today(), 190);
const departure = addDays(arrival, 3);
const query = `cabin=2&guests=2&arrival=${arrival}&departure=${departure}`;

test("public stay sharing contains choices but no guest or booking secrets", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as unknown as { __tidehouseShare?: string }).__tidehouseShare = value;
        },
      },
    });
  });
  await page.goto(`/stay?${query}`);
  await expect(page.getByRole("button", { name: "Continue to your details" })).toBeEnabled();
  await page.getByRole("button", { name: "Share this stay" }).click();
  await expect(page.locator(".stay-share-result")).toContainText("no names, email or private booking details");
  const url = await page.evaluate(() => (window as unknown as { __tidehouseShare?: string }).__tidehouseShare ?? "");
  expect(url).toContain("cabin=2");
  expect(url).toContain(`arrival=${arrival}`);
  expect(url).toContain(`departure=${departure}`);
  expect(url).not.toMatch(/token|email|booking\//i);
});

test("calendar can be operated from the keyboard without hiding unavailable dates", async ({ page }) => {
  await page.goto(`/stay?${query}`);
  await expect(page.getByRole("button", { name: "Continue to your details" })).toBeEnabled();
  const start = page.locator(".calendar-days button.range-start");
  await start.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Arrival", { exact: true })).toHaveValue(addDays(arrival, 1));
  await expect(page.locator(".calendar-announcement")).toContainText("Now choose a departure");
  expect(await page.locator(".calendar-days button[aria-disabled='true']").count()).toBeGreaterThan(0);
});
