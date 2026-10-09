import { type BrowserContext, expect, type Page, test as base } from "@playwright/test";
import { fileURLToPath } from "node:url";

const FAKE_MEDIA = fileURLToPath(new URL("../fake-media.js", import.meta.url));

type Viewport = { width: number; height: number };

/**
 * `newPerson()` opens a page in its own browser context (separate cookies =
 * a separate person) with synthetic camera/mic/screen devices: headless
 * browsers can't reach real devices, so getUserMedia returns a canvas video
 * and an oscillator tone. Every context is closed after the test, so
 * meetings from one test never keep running into the next.
 */
export const test = base.extend<{ newPerson: (viewport?: Viewport) => Promise<Page> }>({
  newPerson: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (viewport = { width: 1275, height: 900 }) => {
      const context = await browser.newContext({
        viewport,
        timezoneId: "Asia/Kolkata",
        permissions: ["clipboard-read", "clipboard-write"],
      });
      contexts.push(context);
      await context.addInitScript({ path: FAKE_MEDIA });
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

/** Home → New meeting; returns the meeting code. */
export async function startInstantMeeting(page: Page, { devices = true } = {}): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "New meeting", exact: true }).first().click();
  await page.waitForURL(/\/wc\/\d{11}$/);
  await page
    .getByRole("button", { name: devices ? "Use microphone and camera" : "Continue without microphone and camera" })
    .click();
  return page.url().split("/").pop()!;
}

/** The invite link for a meeting the page's user can access. */
export async function inviteLinkFor(page: Page, code: string): Promise<string> {
  return page.evaluate(async (meeting) => {
    const res = await fetch("/api/meetings/join-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting }),
    });
    return (await res.json()).invite_link as string;
  }, code);
}

/** Invite link → "Join from browser" → name → Join. */
export async function joinViaLink(page: Page, invite: string, name: string): Promise<void> {
  await page.goto(invite);
  await page.getByRole("link", { name: "Join from browser" }).first().click();
  await page.getByLabel("Your Name").fill(name);
  await page.getByRole("button", { name: "Join", exact: true }).click();
}

export async function endMeetingForAll(page: Page): Promise<void> {
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page.getByRole("button", { name: "End Meeting for All" }).click();
  await page.waitForURL("/");
}

/** Number of <video> elements actually rendering frames (self view + received streams). */
export function liveVideoCount(page: Page): Promise<number> {
  return page.evaluate(
    () => [...document.querySelectorAll("video")].filter((v) => v.videoWidth > 0 && !v.paused).length,
  );
}

export const participantRow = (page: Page, name: string) => page.locator("li", { hasText: name });

export { expect };
