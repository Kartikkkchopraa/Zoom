import type { Page } from "@playwright/test";

import { endMeetingForAll, expect, inviteLinkFor, joinViaLink, liveVideoCount, participantRow, startInstantMeeting, test } from "./helpers";

/** Two real browsers in one meeting: WebRTC media plus WebSocket signaling. */

type NewPerson = () => Promise<Page>;

async function hostAndGuest(newPerson: NewPerson): Promise<{ host: Page; guest: Page; code: string; invite: string }> {
  const host = await newPerson();
  const code = await startInstantMeeting(host);
  const invite = await inviteLinkFor(host, code);
  const guest = await newPerson();
  await joinViaLink(guest, invite, "Guest Tester");
  await guest.getByRole("button", { name: "Use microphone and camera" }).click();
  await expect(host.getByRole("button", { name: "Participants", exact: true })).toContainText("2");
  return { host, guest, code, invite };
}

test("video flows both ways; state, chat and reactions sync", async ({ newPerson }) => {
  const { host, guest } = await hostAndGuest(newPerson);

  // Self view + the other person's camera on each side.
  await expect.poll(() => liveVideoCount(host)).toBeGreaterThanOrEqual(2);
  await expect.poll(() => liveVideoCount(guest)).toBeGreaterThanOrEqual(2);

  await host.getByRole("button", { name: "Participants", exact: true }).click();
  await guest.getByRole("button", { name: "Participants", exact: true }).click();
  await expect(guest.getByText("(Host)")).toBeVisible();

  await guest.getByRole("button", { name: "Unmute", exact: true }).click();
  await expect(participantRow(host, "Guest Tester").locator("svg.lucide-mic")).toHaveCount(1);

  await guest.getByRole("button", { name: "Chat", exact: true }).click();
  await guest.getByLabel("Type message").fill("Hello host!");
  await guest.keyboard.press("Enter");
  await expect(host.getByText("Guest Tester: Hello host!")).toBeVisible(); // toast while chat is closed
  await host.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(host.getByText("Hello host!", { exact: true })).toBeVisible();

  await guest.getByRole("button", { name: "React", exact: true }).click();
  await guest.getByRole("button", { name: "Raise Hand" }).click();
  await expect(host.getByText("Guest Tester raised their hand")).toBeVisible();

  await endMeetingForAll(host);
  await expect(guest.getByText("This meeting has been ended by host")).toBeVisible();
});

test("only one person can share at a time", async ({ newPerson }) => {
  const { host, guest } = await hostAndGuest(newPerson);
  await host.getByRole("button", { name: "Share", exact: true }).click();
  await expect(guest.getByText("Aryan Chopra's screen")).toBeVisible();

  await guest.getByRole("button", { name: "Share", exact: true }).click();
  await expect(guest.getByText("Aryan Chopra is already sharing their screen")).toBeVisible();
  await expect(guest.getByText("You are screen sharing")).toHaveCount(0);
  await endMeetingForAll(host);
});

test("attendees wait until the host starts a scheduled meeting", async ({ newPerson }) => {
  const host = await newPerson();
  await host.goto("/");
  const meeting = await host.evaluate(async () => {
    const start = new Date(Date.now() + 3600e3);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}:00`;
    const res = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "E2E Waiting",
        start_time: local,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        duration_minutes: 30,
      }),
    });
    return res.json();
  });

  const guest = await newPerson();
  await joinViaLink(guest, meeting.invite_link.replace(/^https?:\/\/[^/]+/, ""), "Early Bird");
  await expect(guest.getByText("Please wait for the host to start this meeting.")).toBeVisible();

  await host.goto(`/meetings?id=${meeting.id}`);
  await host.getByRole("button", { name: "Start", exact: true }).click();
  await expect(guest.getByRole("button", { name: "Use microphone and camera" })).toBeVisible();

  await host.getByRole("button", { name: "Continue without microphone and camera" }).click();
  await endMeetingForAll(host);
});

test("host can end for all even after another tab switched accounts", async ({ newPerson }) => {
  const { host, guest } = await hostAndGuest(newPerson);

  // Same browser, new tab: sign in as someone else (replaces the shared session cookie).
  const otherTab = await host.context().newPage();
  await otherTab.goto("/");
  await otherTab.evaluate(() =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "priya@zoomclone.dev", password: "password123" }),
    }),
  );

  await endMeetingForAll(host);
  await expect(guest.getByText("This meeting has been ended by host")).toBeVisible();
});
