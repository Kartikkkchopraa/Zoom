"use client";

import { useEffect, useState } from "react";

const SPEAKING_THRESHOLD = 0.04; // RMS level that counts as talking
const HOLD_MS = 600; // keep the highlight briefly after speech stops

/**
 * True while the audio track has voice activity — drives the active-speaker
 * border and (with several people) which tile Speaker view shows.
 */
export function useSpeaking(track: MediaStreamTrack | null | undefined, enabled = true): boolean {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!track || !enabled || track.readyState === "ended") {
      setSpeaking(false);
      return;
    }
    const ctx = new AudioContext();
    // Mobile starts audio contexts suspended until a user gesture.
    const resume = () => void ctx.resume();
    if (ctx.state === "suspended") document.addEventListener("pointerdown", resume, { once: true });
    const source = ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    let lastLoud = 0;
    let frame = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += v * v;
      const rms = Math.sqrt(sum / samples.length);
      const now = performance.now();
      if (rms > SPEAKING_THRESHOLD) lastLoud = now;
      setSpeaking(now - lastLoud < HOLD_MS);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      document.removeEventListener("pointerdown", resume);
      cancelAnimationFrame(frame);
      source.disconnect();
      void ctx.close();
    };
  }, [track, enabled]);

  return speaking;
}
