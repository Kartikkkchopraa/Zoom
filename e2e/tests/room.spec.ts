import { endMeetingForAll, expect, test } from "./helpers";

/** The meeting room UI with a single participant. */

test("devices, panels, reactions, info and end", async ({ newPerson }) => {
  const page = await newPerson();
  await page.goto("/");
  await page.getByRole("button", { name: "New meeting", exact: true }).first().click();
  await page.waitForURL(/\/wc\/\d{11}$/);

  await expect(page.getByText("Do you want people to see you in the meeting?")).toBeVisible();
  await page.getByRole("button", { name: "Use microphone and camera" }).click();
  await expect(page.locator("video").first()).toBeVisible();

  await page.getByRole("button", { name: "Stop Video", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start Video", exact: true })).toBeVisible();

  const audio = page.getByRole("button", { name: /^(Unmute|Mute)$/ });
  const before = await audio.getAttribute("aria-label");
  await audio.click();
  await expect(audio).not.toHaveAttribute("aria-label", before!);

  await page.getByRole("button", { name: "Participants", exact: true }).click();
  await expect(page.getByText("Participants (1)")).toBeVisible();

  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByLabel("Type message").fill("Hello from the meeting room!");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Hello from the meeting room!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "React", exact: true }).click();
  await page.getByRole("button", { name: "React 🎉" }).click();
  await expect(page.getByText("🎉").first()).toBeVisible();

  await page.getByRole("button", { name: /'s Zoom Meeting$/ }).click();
  await expect(page.getByText("Participant ID")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Host tools", exact: true }).click();
  await expect(page.getByText("Allow all participants to:")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.keyboard.press("Escape");

  await endMeetingForAll(page);
  expect(await page.locator("video").count()).toBe(0);
});

test("screen share and gallery view", async ({ newPerson }) => {
  const page = await newPerson();
  await page.goto("/");
  await page.getByRole("button", { name: "New meeting", exact: true }).first().click();
  await page.getByRole("button", { name: "Use microphone and camera" }).click();

  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByText("You are screen sharing")).toBeVisible();
  await page.getByRole("button", { name: "Stop Share" }).first().click();
  await expect(page.getByText("You are screen sharing")).toBeHidden();

  await page.getByRole("button", { name: "View" }).click();
  await page.getByRole("button", { name: /Gallery/ }).click();
  await endMeetingForAll(page);
});

test("phone layout is full screen with a compact toolbar", async ({ newPerson }) => {
  const page = await newPerson({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "New meeting", exact: true }).first().click();
  await page.getByRole("button", { name: "Continue without microphone and camera" }).click();
  for (const name of ["Join Audio", "Start Video", "Participants", "More", "End"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("camera allowed but microphone blocked: keeps video and explains", async ({ newPerson }) => {
  const page = await newPerson();
  // Like an iPhone where the browser app has camera access but no microphone access.
  await page.context().addInitScript(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints?.audio) throw new DOMException("Permission denied", "NotAllowedError");
      return getUserMedia(constraints);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "New meeting", exact: true }).first().click();
  await page.getByRole("button", { name: "Use microphone and camera" }).click();

  await expect(page.getByText("Access to your microphone is blocked")).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop Video", exact: true })).toBeVisible(); // camera kept
  await expect(page.getByRole("button", { name: "Join Audio", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Join Audio", exact: true }).click();
  await expect(page.getByText("Access to your microphone is blocked").first()).toBeVisible();
  await endMeetingForAll(page);
});
