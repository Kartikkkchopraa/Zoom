import { endMeetingForAll, expect, inviteLinkFor, joinViaLink, participantRow, startInstantMeeting, test } from "./helpers";

/** Host and co-host moderation, all enforced by the server. */

test("mute, ask to unmute, mute all, co-host, waiting room, remove, lock, hand over", async ({ newPerson }) => {
  const host = await newPerson();
  const code = await startInstantMeeting(host);
  const invite = await inviteLinkFor(host, code);

  const guest = await newPerson();
  await joinViaLink(guest, invite, "Guest Tester");
  await guest.getByRole("button", { name: "Unmute", exact: true }).click();
  await host.getByRole("button", { name: "Participants", exact: true }).click();
  const guestRow = participantRow(host, "Guest Tester");

  await test.step("mute one participant", async () => {
    await guestRow.hover();
    await guestRow.getByRole("button", { name: "Mute", exact: true }).click();
    await expect(guest.getByText("You have been muted by Kartik Chopra")).toBeVisible();
  });

  await test.step("ask to unmute", async () => {
    await guestRow.hover();
    await guestRow.getByRole("button", { name: "Ask to Unmute" }).click();
    await guest.getByRole("dialog").getByRole("button", { name: "Unmute" }).click();
    await expect(guest.getByRole("button", { name: "Mute", exact: true })).toBeVisible();
  });

  await test.step("mute all without self-unmute", async () => {
    await host.getByRole("button", { name: "Mute All" }).click();
    await host.getByRole("dialog").getByLabel("Allow participants to unmute themselves").uncheck();
    await host.getByRole("dialog").getByRole("button", { name: "Yes" }).click();
    await guest.getByRole("button", { name: "Unmute", exact: true }).click();
    await expect(guest.getByText("The host has disabled unmuting")).toBeVisible();
  });

  await test.step("make co-host", async () => {
    await guestRow.hover();
    await host.getByRole("button", { name: "Options for Guest Tester", exact: true }).click();
    await host.getByRole("button", { name: "Make Co-Host" }).click();
    await expect(guest.getByText("You are now a co-host")).toBeVisible();
    await expect(guest.getByRole("button", { name: "Host tools" })).toBeVisible();
  });

  const third = await newPerson();
  await test.step("waiting room", async () => {
    await host.locator("aside").getByRole("button", { name: "More", exact: true }).click();
    await host.getByRole("button", { name: "Enable Waiting Room" }).click();
    await host.keyboard.press("Escape");
    await joinViaLink(third, invite, "Third Person");
    await expect(third.getByText("Please wait, the meeting host will let you in soon.")).toBeVisible();
    await expect(host.getByText("Waiting Room (1)")).toBeVisible();
    await participantRow(host, "Third Person").getByRole("button", { name: "Admit" }).click();
    await expect(third.getByRole("button", { name: "Participants", exact: true })).toBeVisible();
  });

  await test.step("remove, and the removed browser can't rejoin", async () => {
    await participantRow(host, "Third Person").hover();
    await host.getByRole("button", { name: "Options for Third Person", exact: true }).click();
    await host.getByRole("button", { name: "Remove" }).click();
    await host.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expect(third.getByText("You have been removed from this meeting by the host")).toBeVisible();
    await third.getByRole("button", { name: "OK" }).click();
    await joinViaLink(third, invite, "Third Again");
    await expect(third.getByText("You have been removed from this meeting")).toBeVisible();
  });

  await test.step("lock meeting", async () => {
    await host.locator("aside").getByRole("button", { name: "More", exact: true }).click();
    await host.getByRole("button", { name: "Enable Waiting Room" }).click();
    await host.getByRole("button", { name: "Lock Meeting" }).click();
    await host.keyboard.press("Escape");
    const late = await newPerson();
    await joinViaLink(late, invite, "Latecomer");
    await expect(late.getByText("This meeting has been locked by the host")).toBeVisible();
  });

  await test.step("host leaves and hands over", async () => {
    await host.getByRole("button", { name: "End", exact: true }).click();
    await host.getByRole("button", { name: "Leave Meeting" }).click();
    await host.getByRole("button", { name: "Assign and Leave" }).click();
    await host.waitForURL("/");
    await expect(guest.getByText("You are now the host")).toBeVisible();
    await guest.getByRole("button", { name: "End", exact: true }).click();
    await expect(guest.getByRole("button", { name: "End Meeting for All" })).toBeVisible();
  });
});

test("hosts get a waiting room prompt to admit people", async ({ newPerson }) => {
  const host = await newPerson();
  const code = await startInstantMeeting(host, { devices: false });
  const invite = await inviteLinkFor(host, code);
  await host.getByRole("button", { name: "Participants", exact: true }).click();
  await host.locator("aside").getByRole("button", { name: "More", exact: true }).click();
  await host.getByRole("button", { name: "Enable Waiting Room" }).click();
  await host.keyboard.press("Escape");
  await host.getByRole("button", { name: "Participants", exact: true }).click(); // close the panel

  const guest = await newPerson();
  await joinViaLink(guest, invite, "Waiting Guest", { video: false });
  await expect(guest.getByText("Please wait, the meeting host will let you in soon.")).toBeVisible();

  const prompt = host.getByRole("status").filter({ hasText: "Waiting Guest entered the waiting room" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Admit" }).click();
  await expect(prompt).toBeHidden();
  await expect(guest.getByRole("button", { name: "Participants", exact: true })).toBeVisible();
  await endMeetingForAll(host);
});
