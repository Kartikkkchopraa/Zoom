import { api } from "./api";
import { toast } from "./toast";

export async function copyText(text: string, successMessage = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text);
    toast(successMessage, "success");
  } catch {
    toast("Couldn't access the clipboard", "error");
  }
}

/** Zoom's "Copy Invitation": the full invitation text built by the backend. */
export async function copyInvitation(meetingId: number) {
  try {
    const { text } = await api.invitation(meetingId);
    await copyText(text, "Meeting invitation copied to clipboard");
  } catch {
    toast("Couldn't load the invitation", "error");
  }
}
