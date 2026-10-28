// Tests for the timer (SPEC "Timer").

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { closeDbForTests } from '../src/db';
import { finishTimer, formatClock, isLongRunning, loadTimer, saveTimer, type RunningTimer } from '../src/timer';
import { formatWhen } from '../src/ui/dom';
import { createTimeEntry } from '../src/events';

const timer = (started: string): RunningTimer => ({
  started_at: new Date(started).toISOString(),
  project_id: 'p1',
  milestone_id: '',
  note: '',
  long_warning_dismissed: false,
});

describe('timer', () => {
  beforeEach(() => {
    closeDbForTests();
    globalThis.indexedDB = new IDBFactory();
  });

  it('survives closing the app / restarting the phone (it is stored on the device)', async () => {
    const t = timer('2026-10-28T08:00:00');
    await saveTimer(t);
    closeDbForTests(); // like closing the app
    expect(await loadTimer()).toEqual(t);
    await saveTimer(null);
    expect(await loadTimer()).toBeNull();
  });

  it('shows the running time as h:mm:ss', () => {
    expect(formatClock(5_025_000)).toBe('1:23:45');
    expect(formatClock(59_999)).toBe('0:00:59');
  });

  it('becomes a normal entry with start, end and duration (seconds dropped, as shown on screen)', () => {
    const r = finishTimer(timer('2026-10-28T08:00:20'), new Date('2026-10-28T09:30:40'), new Date('2026-10-28T09:30:40'));
    expect(r).toMatchObject({ errors: [], tooShort: false, start: '2026-10-28T08:00', end: '2026-10-28T09:30', duration_minutes: 90 });
  });

  it('a chosen end time gives exactly the duration you see (start 12:46:35, end 14:46 → 2 h)', () => {
    const r = finishTimer(timer('2026-10-28T12:46:35'), new Date('2026-10-28T14:46'), new Date('2026-10-28T21:00'));
    expect(r.duration_minutes).toBe(120);
  });

  it('a few seconds across a minute boundary is still "too short"', () => {
    const r = finishTimer(timer('2026-10-28T08:00:58'), new Date('2026-10-28T08:01:03'), new Date('2026-10-28T08:01:03'));
    expect(r.tooShort).toBe(true);
  });

  it('works across midnight', () => {
    const r = finishTimer(timer('2026-10-27T23:15:00'), new Date('2026-10-28T00:40:00'), new Date('2026-10-28T00:40:00'));
    expect(r).toMatchObject({ errors: [], start: '2026-10-27T23:15', end: '2026-10-28T00:40', duration_minutes: 85 });
    const [entry] = createTimeEntry('phone', { project_id: 'p', milestone_id: '', start: r.start, end: r.end, duration_minutes: 85, note: '' });
    expect(formatWhen(entry)).toBe('Tue, 27 Oct 2026 · 23:15–00:40 (+1 day)');
  });

  it('under a minute is too short to record', () => {
    const r = finishTimer(timer('2026-10-28T08:00:00'), new Date('2026-10-28T08:00:25'), new Date('2026-10-28T08:00:25'));
    expect(r.tooShort).toBe(true);
  });

  it('warns after 8 hours of running', () => {
    expect(isLongRunning(timer('2026-10-28T08:00:00'), new Date('2026-10-28T15:59:00'))).toBe(false);
    expect(isLongRunning(timer('2026-10-28T08:00:00'), new Date('2026-10-28T16:00:00'))).toBe(true);
  });

  it('"stop at a time I choose": must be after the start and not in the future', () => {
    const t = timer('2026-10-28T08:00:00');
    const now = new Date('2026-10-28T19:00:00');
    expect(finishTimer(t, new Date('2026-10-28T07:30:00'), now).errors).toEqual(['The end must be after the moment the timer began.']);
    expect(finishTimer(t, new Date('2026-10-28T20:00:00'), now).errors).toEqual(['The end cannot be in the future.']);
    expect(finishTimer(t, new Date('2026-10-28T12:30:00'), now)).toMatchObject({ errors: [], duration_minutes: 270 });
  });

  it('asks for confirmation above 10 hours, like manual entries', () => {
    const r = finishTimer(timer('2026-10-28T06:00:00'), new Date('2026-10-28T17:00:00'), new Date('2026-10-28T17:00:00'));
    expect(r.warnings).toHaveLength(1);
  });
});
