// The timer ("Begin" / "Rest").
// Only the moment you tapped Begin is stored – on this device, not in Excel. So the timer keeps
// going correctly while the app is closed or the phone restarts. When you tap Rest it becomes a
// normal time entry (with start and end) and syncs like any other entry.

import { getSetting, setSetting } from './db';
import { LONG_WARNING, localDateTime } from './validation';

export interface RunningTimer {
  started_at: string; // ISO time of "Begin"
  project_id: string;
  milestone_id: string;
  note: string; // can be typed while the timer runs
  long_warning_dismissed: boolean; // "Keep running" was chosen after the 8-hour warning
}

/** After this long the app asks whether the timer was forgotten (SPEC: 8 hours). */
export const LONG_RUNNING_MS = 8 * 60 * 60 * 1000;

export async function loadTimer(): Promise<RunningTimer | null> {
  return (await getSetting<RunningTimer | null>('timer')) ?? null;
}

export async function saveTimer(timer: RunningTimer | null): Promise<void> {
  await setSetting('timer', timer);
}

export function elapsedMs(timer: RunningTimer, now: Date = new Date()): number {
  return Math.max(0, now.getTime() - Date.parse(timer.started_at));
}

export function isLongRunning(timer: RunningTimer, now: Date = new Date()): boolean {
  return elapsedMs(timer, now) >= LONG_RUNNING_MS;
}

/** 5025000 ms -> "1:23:45" */
export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(total / 3600)}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

/** Drops the seconds, exactly like the times shown on screen (08:00:40 -> 08:00). */
const toMinute = (d: Date) => new Date(Math.floor(d.getTime() / 60000) * 60000);

/**
 * Turns the timer into the fields of a time entry, ending at `end` (normally now, or a time the
 * user picked after forgetting to stop). Seconds are dropped from start and end, so the entry
 * matches the times shown on screen.
 */
export function finishTimer(timer: RunningTimer, end: Date, now: Date = new Date()) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const start = toMinute(new Date(timer.started_at));
  const stop = toMinute(end);
  const runMs = end.getTime() - Date.parse(timer.started_at);
  if (runMs <= 0) errors.push('The end must be after the moment the timer began.');
  if (end.getTime() > now.getTime() + 60_000) errors.push('The end cannot be in the future.');
  const duration_minutes = Math.round((stop.getTime() - start.getTime()) / 60000);
  const tooShort = errors.length === 0 && (runMs < 60_000 || duration_minutes < 1);
  if (errors.length === 0 && duration_minutes > 10 * 60) warnings.push(LONG_WARNING);
  return { errors, warnings, tooShort, start: localDateTime(start), end: localDateTime(stop), duration_minutes };
}
