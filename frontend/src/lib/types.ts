// Mirrors the backend Pydantic schemas (app/schemas/*.py).

export type MeetingType = "instant" | "scheduled" | "personal";
export type MeetingStatus = "not_started" | "live" | "ended";
export type MeetingScope = "upcoming" | "previous";

export interface UserBrief {
  id: number;
  name: string;
  initials: string;
  avatar_color: string;
}

export interface User extends UserBrief {
  email: string;
  timezone: string;
}

export interface UserSettings {
  mute_mic_on_join: boolean;
  video_off_on_join: boolean;
}

export interface Meeting {
  id: number;
  meeting_code: string;
  title: string;
  description: string | null;
  meeting_type: MeetingType;
  status: MeetingStatus;
  use_pmi: boolean;
  scheduled_start: string | null;
  duration_minutes: number | null;
  timezone: string;
  passcode: string | null;
  invite_link: string;
  waiting_room: boolean;
  mute_on_entry: boolean;
  host_video: boolean;
  participant_video: boolean;
  started_at: string | null;
  ended_at: string | null;
  host: UserBrief;
  participant_count: number;
  invitees: string[];
}

export interface MeetingRoom extends Meeting {
  is_host: boolean;
}

export interface Me {
  user: User;
  settings: UserSettings;
  personal_meeting: Meeting;
}
