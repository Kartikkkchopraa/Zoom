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

/**
 * Make audio behave like iOS Safari: play() only works *during* a tap and the
 * autoplay attribute is ignored. Used to test the "Tap to turn on sound" path.
 */
export async function simulateIOSAudioRules(page: Page): Promise<void> {
  await page.context().addInitScript(() => {
    const w = window as typeof window & { __inTap?: boolean };
    for (const type of ["pointerdown", "click"]) {
      window.addEventListener(type, () => {
        w.__inTap = true;
        setTimeout(() => (w.__inTap = false));
      }, true);
    }
    Object.defineProperty(HTMLMediaElement.prototype, "autoplay", { get: () => false, set: () => {} });
    const setAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name: string, value: string) {
      if (this instanceof HTMLAudioElement && name.toLowerCase() === "autoplay") return;
      return setAttribute.call(this, name, value);
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLAudioElement && !w.__inTap) {
        return Promise.reject(new DOMException("play() requires a user gesture", "NotAllowedError"));
      }
      return play.call(this);
    };
  });
}

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

/**
 * Invite link → "Join from browser" → preview page: turn the camera on and the
 * mic off (unless `video: false`), fill the name, Join.
 */
export async function joinViaLink(page: Page, invite: string, name: string, { video = true } = {}): Promise<void> {
  await page.goto(invite);
  await page.getByRole("link", { name: "Join from browser" }).first().click();
  await page.getByRole("button", { name: "Mute", exact: true }).click();
  if (video) {
    await page.getByRole("button", { name: "Start Video", exact: true }).click();
    await expect(page.getByRole("button", { name: "Stop Video", exact: true })).toBeVisible();
  }
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
