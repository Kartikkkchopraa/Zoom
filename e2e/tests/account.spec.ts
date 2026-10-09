import type { Page } from "@playwright/test";

import { endMeetingForAll, expect, inviteLinkFor, joinViaLink, startInstantMeeting, test } from "./helpers";

/** Sign in / sign up / sign out, guests, and user settings. */

const currentUser = (page: Page) =>
  page.evaluate(async () => {
    const res = await fetch("/api/users/me");
    return res.ok ? (await res.json()).user : null;
  });

test("default user, sign out, sign up, guest join, sign back in", async ({ newPerson }) => {
  const page = await newPerson();
  await page.goto("/");
  expect((await currentUser(page))?.email).toBe("kartikchopra@demo.dev");

  await page.getByRole("button", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/signin/);
  await page.goto("/meetings");
  await page.waitForURL(/\/signin\?next=%2Fmeetings/);

  await page.getByLabel("Email Address").fill("kartikchopra@demo.dev");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText("Incorrect email or password")).toBeVisible();

  await page.getByRole("link", { name: "Sign Up Free" }).click();
  await page.getByLabel("Full Name").fill("Neha Tester");
  await page.getByLabel("Email Address").fill(`neha.${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("supersecret");
  await page.getByRole("button", { name: "Sign Up" }).click();
  await page.waitForURL("/meetings");
  expect((await currentUser(page))?.name).toBe("Neha Tester");

  // The new account hosts; a signed-out guest joins by link.
  const code = await startInstantMeeting(page, { devices: false });
  const invite = await inviteLinkFor(page, code);
  // A fresh device opening the invite link directly joins as a guest.
  const guest = await newPerson();
  await joinViaLink(guest, invite, "Anonymous Guest", { video: false });
  await expect(guest.getByRole("link", { name: "Sign In" })).toBeVisible();
  await page.getByRole("button", { name: "Participants", exact: true }).click();
  await expect(page.getByText("Neha Tester(Host, me)")).toBeVisible();
  await expect(page.locator("li", { hasText: "Anonymous Guest" })).toBeVisible();
  await endMeetingForAll(page);

  await page.getByRole("button", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email Address").fill("kartikchopra@demo.dev");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("/");
  expect((await currentUser(page))?.email).toBe("kartikchopra@demo.dev");
});

test("settings are saved and applied when joining", async ({ newPerson }) => {
  const page = await newPerson();
  await page.goto("/settings");
  const restore = () =>
    page.evaluate(async () => {
      const patch = (url: string, body: object) =>
        fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await patch("/api/users/me/settings", { mute_mic_on_join: true, video_off_on_join: false });
      await patch("/api/users/me", { name: "Kartik Chopra" });
    });

  try {
    await page.getByLabel("Display name").fill("Kartik Chopra QA");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Profile updated")).toBeVisible();

    await page.getByRole("button", { name: "Audio" }).click();
    await page.getByRole("switch", { name: "Mute my microphone when joining a meeting" }).click();
    await page.getByRole("button", { name: "Video" }).click();
    await page.getByRole("switch", { name: "Turn off my video when joining a meeting" }).click();
    await expect(page.getByRole("switch", { name: "Turn off my video when joining a meeting" })).toBeChecked();

    await startInstantMeeting(page);
    await expect(page.getByRole("button", { name: "Start Video", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mute", exact: true })).toBeVisible();
    await endMeetingForAll(page);
  } finally {
    await restore();
  }
});

test("unknown pages show the 404 page", async ({ page }) => {
  await page.goto("/nope-not-a-page");
  await expect(page.getByText("Page not found")).toBeVisible();
});
