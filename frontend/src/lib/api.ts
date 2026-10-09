import type { Me, Meeting, MeetingRoom, MeetingScope, UserSettings } from "./types";

export const isUnauthenticated = (err: unknown) => err instanceof ApiError && err.status === 401;

/** An error returned by the backend as {"error": {code, message}}. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (body?.error) throw new ApiError(res.status, body.error.code, body.error.message);
    // FastAPI request-validation errors: {"detail": [{msg, loc}, ...]}
    const detail = Array.isArray(body?.detail) ? body.detail[0]?.msg : body?.detail;
    throw new ApiError(res.status, "request_failed", detail ?? "Something went wrong");
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (body: unknown) => JSON.stringify(body);

export interface ScheduleInput {
  title: string;
  description?: string | null;
  start_time: string; // wall-clock ISO without offset, interpreted in `timezone`
  duration_minutes: number;
  timezone: string;
  use_pmi?: boolean;
  passcode?: string | null;
  waiting_room?: boolean;
  mute_on_entry?: boolean;
  host_video?: boolean;
  participant_video?: boolean;
  invitees?: string[];
}

export const api = {
  me: () => request<Me>("/users/me"),
  login: (email: string, password: string) =>
    request<Me>("/auth/login", { method: "POST", body: json({ email, password }) }),
  signup: (name: string, email: string, password: string) =>
    request<Me>("/auth/signup", { method: "POST", body: json({ name, email, password }) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  continueAsGuest: () => request<void>("/auth/guest", { method: "POST" }),
  updateMe: (patch: { name?: string }) =>
    request<Me>("/users/me", { method: "PATCH", body: json(patch) }),
  updateSettings: (patch: Partial<UserSettings>) =>
    request<Me>("/users/me/settings", { method: "PATCH", body: json(patch) }),

  listMeetings: (scope: MeetingScope, limit = 50) =>
    request<Meeting[]>(`/meetings?scope=${scope}&limit=${limit}`),
  calendar: (start: Date, end: Date) =>
    request<Meeting[]>(
      `/meetings/calendar?start=${encodeURIComponent(start.toISOString())}` +
        `&end=${encodeURIComponent(end.toISOString())}`,
    ),
  getMeeting: (id: number) => request<Meeting>(`/meetings/${id}`),
  invitation: (id: number) => request<{ text: string }>(`/meetings/${id}/invitation`),

  createInstant: (usePmi = false) =>
    request<Meeting>("/meetings/instant", { method: "POST", body: json({ use_pmi: usePmi }) }),
  schedule: (input: ScheduleInput) =>
    request<Meeting>("/meetings", { method: "POST", body: json(input) }),
  updateMeeting: (id: number, input: Partial<ScheduleInput>) =>
    request<Meeting>(`/meetings/${id}`, { method: "PATCH", body: json(input) }),
  deleteMeeting: (id: number) => request<void>(`/meetings/${id}`, { method: "DELETE" }),
  startMeeting: (id: number) => request<Meeting>(`/meetings/${id}/start`, { method: "POST" }),
  endMeeting: (id: number) => request<Meeting>(`/meetings/${id}/end`, { method: "POST" }),

  rtcConfig: () => request<{ ice_servers: RTCIceServer[] }>("/rtc/config"),

  joinCheck: (meeting: string, passcode?: string) =>
    request<MeetingRoom>("/meetings/join-check", {
      method: "POST",
      body: json({ meeting, passcode: passcode || null }),
    }),
};
