import { endMeetingForAll, expect, startInstantMeeting, test } from "./helpers";
/** Core assignment flows: instant meeting, join (ID / link / passcode), schedule, manage. */

test("new meeting creates a unique ID and opens the room as host", async ({ newPerson }) => {
  const page = await newPerson();
  const code = await startInstantMeeting(page, { devices: false });
  expect(code).toMatch(/^\d{11}$/);
  await expect(page.getByRole("button", { name: "Host tools" })).toBeVisible();
  await endMeetingForAll(page);
});

test("join validates the meeting ID and passcode", async ({ newPerson }) => {
  // Priya's personal room: read its ID and passcode as Priya.
  const priya = await newPerson();
  await priya.goto("/signin");
  await priya.getByLabel("Email Address").fill("priya@zoomclone.dev");
  await priya.getByLabel("Password", { exact: true }).fill("password123");
  await priya.getByRole("button", { name: "Sign In" }).click();
  await priya.waitForURL("/");
  const room = await priya.evaluate(async () => (await (await fetch("/api/users/me")).json()).personal_meeting);

  const page = await newPerson();
  await page.goto("/");
  await page.getByRole("button", { name: "Join", exact: true }).first().click();

  await page.getByLabel("Meeting ID or invite link").fill("123 4567 8901");
  await page.getByRole("dialog").getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("not valid");

  await page.getByLabel("Meeting ID or invite link").fill(room.meeting_code);
  await page.getByLabel("Your name").fill("Test Guest");
  await page.getByRole("dialog").getByRole("button", { name: "Join", exact: true }).click();
  await page.getByPlaceholder("Meeting passcode").fill("wrong");
  await page.getByRole("button", { name: "Join meeting" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Incorrect");

  await page.getByPlaceholder("Meeting passcode").fill(room.passcode);
  await page.getByRole("button", { name: "Join meeting" }).click();
  await page.waitForURL(`/wc/${room.meeting_code}`);
  // Priya hasn't started her room yet.
  await expect(page.getByText("Please wait for the host to start this meeting.")).toBeVisible();
  await page.getByRole("button", { name: "Leave", exact: true }).click();

  // An invite link carries the passcode, so no prompt.
  await page.goto(room.invite_link.replace(/^https?:\/\/[^/]+/, ""));
  await page.getByRole("link", { name: "Join from browser" }).first().click();
  await page.getByLabel("Your Name").fill("Link Guest");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByText("Please wait for the host to start this meeting.")).toBeVisible();

  await page.goto("/wc/99999999999/join");
  await expect(page.getByText("not valid")).toBeVisible();
});

test("schedule, show invitation, edit and delete a meeting", async ({ newPerson }) => {
  const page = await newPerson();
  await page.goto("/meetings/schedule");
  await page.getByLabel("Topic").fill("Playwright Sync");
  await page.getByRole("button", { name: "Add Description" }).click();
  await page.getByPlaceholder("Enter a description").fill("Automated test meeting");
  await page.getByLabel("Invitees").fill("priya@zoomclone.dev");
  await page.getByLabel("Invitees").press("Enter");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/meetings\?id=\d+/);
  await expect(page.getByRole("heading", { name: "Playwright Sync" })).toBeVisible();

  await page.getByRole("button", { name: "Show Meeting Invitation" }).click();
  await expect(page.getByText("is inviting you to a scheduled Zoom meeting")).toBeVisible();
  await page.getByRole("button", { name: "Copy Invitation" }).click();
  await expect(page.getByText("Meeting invitation copied to clipboard")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Playwright Sync");

  // Shows up on Home's upcoming list too.
  await page.goto("/");
  await expect(page.getByText("Playwright Sync").first()).toBeVisible();
  await page.goBack();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Topic").fill("Playwright Sync (edited)");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Playwright Sync (edited)" })).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Meeting deleted")).toBeVisible();
});

test("meetings tab shows the PMI and previous meetings; Start from Home", async ({ newPerson }) => {
  const page = await newPerson();
  await page.goto("/meetings");
  await expect(page.getByRole("heading", { name: "My Personal Meeting ID (PMI)" })).toBeVisible();
  await page.getByRole("tab", { name: "previous" }).click();
  await expect(page.getByText("Backend Architecture Discussion").first()).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).first().click();
  await page.waitForURL(/\/wc\/\d+$/);
  await page.getByRole("button", { name: "Continue without microphone and camera" }).click();
  await expect(page.getByRole("button", { name: "Host tools" })).toBeVisible();
  await endMeetingForAll(page);
});
