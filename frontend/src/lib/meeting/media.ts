"use client";

import { create } from "zustand";

/**
 * Local media (microphone, camera, screen share) for the meeting room.
 *
 * Tracks live here so the toolbar, device menus, self-view and the
 * peer connections all read one source of truth. Muting the mic disables the
 * track (instant, no renegotiation); turning the camera off stops the track so
 * the camera light goes off, like Zoom.
 */

export type Permission = "prompt" | "granted" | "denied" | "skipped";

interface Devices {
  mics: MediaDeviceInfo[];
  cams: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
}

interface MediaState {
  permission: Permission;
  audioTrack: MediaStreamTrack | null;
  videoTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  /** "Join Audio" done: the mic track exists (it may still be muted). */
  audioConnected: boolean;
  micMuted: boolean;
  devices: Devices;
  micId: string | null;
  camId: string | null;
  speakerId: string | null;
  error: string | null;

  requestAccess: (want: { audio: boolean; video: boolean; startMuted: boolean }) => Promise<void>;
  skipAccess: () => void;
  connectAudio: () => Promise<void>;
  setMicMuted: (muted: boolean) => void;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  selectMic: (deviceId: string) => Promise<void>;
  selectCamera: (deviceId: string) => Promise<void>;
  selectSpeaker: (deviceId: string) => void;
  startShare: () => Promise<boolean>;
  stopShare: () => void;
  stopAll: () => void;
}

const VIDEO_CONSTRAINTS: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };

function describe(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "Permission to use the camera or microphone was denied";
  if (name === "NotFoundError") return "No camera or microphone was found";
  if (name === "NotReadableError") return "Your camera or microphone is in use by another app";
  return "Couldn't access your camera or microphone";
}

async function listDevices(): Promise<Devices> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return {
    mics: all.filter((d) => d.kind === "audioinput"),
    cams: all.filter((d) => d.kind === "videoinput"),
    speakers: all.filter((d) => d.kind === "audiooutput"),
  };
}

export const useMedia = create<MediaState>((set, get) => {
  async function getMic(deviceId?: string | null) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    });
    return stream.getAudioTracks()[0];
  }

  async function getCam(deviceId?: string | null) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { ...VIDEO_CONSTRAINTS, deviceId: { exact: deviceId } } : VIDEO_CONSTRAINTS,
    });
    return stream.getVideoTracks()[0];
  }

  async function refreshDevices() {
    try {
      set({ devices: await listDevices() });
    } catch {
      /* enumerateDevices unsupported — device menus just stay empty */
    }
  }

  return {
    permission: "prompt",
    audioTrack: null,
    videoTrack: null,
    screenTrack: null,
    audioConnected: false,
    micMuted: true,
    devices: { mics: [], cams: [], speakers: [] },
    micId: null,
    camId: null,
    speakerId: null,
    error: null,

    async requestAccess({ audio, video, startMuted }) {
      set({ error: null });
      // One prompt for both (the browser remembers the grant for later toggles);
      // fall back to whichever device exists if the machine lacks the other.
      const attempts: MediaStreamConstraints[] = [
        { audio: true, video: VIDEO_CONSTRAINTS },
        { audio: true },
        { video: VIDEO_CONSTRAINTS },
      ];
      let stream: MediaStream | null = null;
      let error: string | null = null;
      for (const constraints of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          error ??= describe(err);
          if (err instanceof DOMException && err.name === "NotAllowedError") break;
        }
      }
      if (!stream) {
        set({ permission: "denied", error });
        await refreshDevices();
        return;
      }

      const audioTrack = stream.getAudioTracks()[0] ?? null;
      const videoTrack = stream.getVideoTracks()[0] ?? null;
      const keepAudio = audio && audioTrack !== null;
      if (audioTrack) {
        if (keepAudio) audioTrack.enabled = !startMuted;
        else audioTrack.stop();
      }
      if (videoTrack && !video) videoTrack.stop();
      set({
        permission: "granted",
        error: audioTrack && videoTrack ? null : error,
        audioTrack: keepAudio ? audioTrack : null,
        audioConnected: keepAudio,
        micMuted: startMuted,
        videoTrack: video ? videoTrack : null,
        micId: audioTrack?.getSettings().deviceId ?? null,
        camId: videoTrack?.getSettings().deviceId ?? null,
      });
      await refreshDevices();
    },

    skipAccess: () => set({ permission: "skipped" }),

    async connectAudio() {
      if (get().audioTrack) return;
      try {
        const track = await getMic(get().micId);
        track.enabled = false; // join muted, like Zoom
        set({ audioTrack: track, audioConnected: true, micMuted: true, permission: "granted", error: null });
        await refreshDevices();
      } catch (err) {
        set({ error: describe(err) });
      }
    },

    setMicMuted(muted) {
      const track = get().audioTrack;
      if (!track) return;
      track.enabled = !muted;
      set({ micMuted: muted });
    },

    async startCamera() {
      if (get().videoTrack) return;
      try {
        const track = await getCam(get().camId);
        set({ videoTrack: track, permission: "granted", error: null });
        await refreshDevices();
      } catch (err) {
        set({ error: describe(err) });
      }
    },

    stopCamera() {
      get().videoTrack?.stop();
      set({ videoTrack: null });
    },

    async selectMic(deviceId) {
      const old = get().audioTrack;
      set({ micId: deviceId });
      if (!old) return;
      const track = await getMic(deviceId);
      track.enabled = !get().micMuted;
      old.stop();
      set({ audioTrack: track });
    },

    async selectCamera(deviceId) {
      const old = get().videoTrack;
      set({ camId: deviceId });
      if (!old) return;
      const track = await getCam(deviceId);
      old.stop();
      set({ videoTrack: track });
    },

    selectSpeaker: (deviceId) => set({ speakerId: deviceId }),

    async startShare() {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const [track] = stream.getVideoTracks();
        // The browser's own "Stop sharing" button ends the track.
        track.addEventListener("ended", () => get().screenTrack === track && set({ screenTrack: null }));
        set({ screenTrack: track });
        return true;
      } catch {
        return false; // user cancelled the picker
      }
    },

    stopShare() {
      get().screenTrack?.stop();
      set({ screenTrack: null });
    },

    stopAll() {
      const { audioTrack, videoTrack, screenTrack } = get();
      [audioTrack, videoTrack, screenTrack].forEach((t) => t?.stop());
      set({
        permission: "prompt",
        audioTrack: null,
        videoTrack: null,
        screenTrack: null,
        audioConnected: false,
        micMuted: true,
        error: null,
      });
    },
  };
});
