/** Time zone options for the Schedule form, labelled like Zoom: "(GMT+5:30) India". */

const COMMON_ZONES: [string, string][] = [
  ["Pacific/Honolulu", "Hawaii"],
  ["America/Anchorage", "Alaska"],
  ["America/Los_Angeles", "Pacific Time (US and Canada)"],
  ["America/Denver", "Mountain Time (US and Canada)"],
  ["America/Chicago", "Central Time (US and Canada)"],
  ["America/New_York", "Eastern Time (US and Canada)"],
  ["America/Sao_Paulo", "Sao Paulo"],
  ["UTC", "Universal Time UTC"],
  ["Europe/London", "London"],
  ["Europe/Paris", "Paris"],
  ["Europe/Berlin", "Berlin"],
  ["Africa/Cairo", "Cairo"],
  ["Europe/Moscow", "Moscow"],
  ["Asia/Dubai", "Dubai"],
  ["Asia/Karachi", "Islamabad, Karachi"],
  ["Asia/Kolkata", "India"],
  ["Asia/Kathmandu", "Kathmandu"],
  ["Asia/Dhaka", "Dhaka"],
  ["Asia/Bangkok", "Bangkok"],
  ["Asia/Singapore", "Singapore"],
  ["Asia/Shanghai", "Beijing, Shanghai"],
  ["Asia/Tokyo", "Tokyo"],
  ["Australia/Sydney", "Sydney"],
  ["Pacific/Auckland", "Auckland"],
];

/** 'GMT+5:30' for a zone at the current date (accounts for DST). */
export function gmtOffset(timeZone: string, at = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  const offset = part?.value ?? "GMT";
  return offset === "GMT" ? "GMT+0:00" : offset.includes(":") ? offset : `${offset}:00`;
}

// Legacy names some browsers still report (Chrome says "Asia/Calcutta").
const ZONE_ALIASES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
};

export const canonicalZone = (tz: string) => ZONE_ALIASES[tz] ?? tz;

export const browserTimeZone = () => canonicalZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

export interface TimeZoneOption {
  value: string;
  label: string;
}

/** Common zones plus the browser's / meeting's zone if it isn't in the list. */
export function timeZoneOptions(...extra: string[]): TimeZoneOption[] {
  const zones = [...COMMON_ZONES];
  for (const tz of extra) {
    if (tz && !zones.some(([z]) => z === tz)) zones.push([tz, tz.split("/").pop()!.replace(/_/g, " ")]);
  }
  const minutes = (tz: string) => {
    const m = gmtOffset(tz).match(/GMT([+-])(\d+):(\d+)/);
    return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  };
  return zones
    .sort((a, b) => minutes(a[0]) - minutes(b[0]))
    .map(([value, name]) => ({ value, label: `(${gmtOffset(value)}) ${name}` }));
}

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
}

/** The wall-clock time an instant shows in a given zone. */
export function toWallClock(iso: string, timeZone: string): WallClock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return {
    year: +parts.year,
    month: +parts.month,
    day: +parts.day,
    hour: +parts.hour,
    minute: +parts.minute,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 'YYYY-MM-DDTHH:mm:00' — no offset; the backend interprets it in the chosen zone. */
export function wallClockToIso(w: WallClock): string {
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}:00`;
}
