// Tests for the checks on what the user types.

import { describe, expect, it } from 'vitest';
import { validateCorrection, validateManualEntry, type ManualEntryInput } from '../src/validation';

const now = new Date('2026-10-28T12:00'); // a fixed "now" so the tests always behave the same
const input = (overrides: Partial<ManualEntryInput>): ManualEntryInput => ({
  mode: 'times',
  date: '2026-10-27',
  startTime: '08:00',
  endTime: '09:30',
  hours: 0,
  minutes: 0,
  ...overrides,
});

describe('manual entries with start and end time', () => {
  it('accepts a normal entry and calculates the duration', () => {
    const r = validateManualEntry(input({}), now);
    expect(r.errors).toEqual([]);
    expect(r).toMatchObject({ start: '2026-10-27T08:00', end: '2026-10-27T09:30', duration_minutes: 90 });
  });

  it('rejects an end time before the start time', () => {
    expect(validateManualEntry(input({ endTime: '07:00' }), now).errors).toContain('The end time must be after the start time.');
  });

  it('rejects entries in the future', () => {
    expect(validateManualEntry(input({ date: '2026-10-28', endTime: '13:00' }), now).errors).toContain(
      'This entry ends in the future.',
    );
  });

  it('warns (but does not block) for more than 10 hours', () => {
    const r = validateManualEntry(input({ startTime: '06:00', endTime: '17:00' }), now);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });
});

describe('manual entries with only a duration', () => {
  it('accepts hours and minutes', () => {
    const r = validateManualEntry(input({ mode: 'duration', hours: 1, minutes: 15 }), now);
    expect(r.errors).toEqual([]);
    expect(r).toMatchObject({ start: '2026-10-27', end: '', duration_minutes: 75 });
  });

  it('rejects zero, negative and future-dated entries', () => {
    expect(validateManualEntry(input({ mode: 'duration' }), now).errors).not.toEqual([]);
    expect(validateManualEntry(input({ mode: 'duration', hours: -1 }), now).errors).not.toEqual([]);
    expect(validateManualEntry(input({ mode: 'duration', hours: 1, date: '2026-10-29' }), now).errors).toContain(
      'The date is in the future.',
    );
  });
});

describe('corrections', () => {
  it('require a reason and a real change', () => {
    expect(validateCorrection(60, 45, '').errors).toContain('Please give a reason for the correction.');
    expect(validateCorrection(60, 60, 'x').errors).toHaveLength(1);
    expect(validateCorrection(60, -5, 'x').errors).toHaveLength(1);
    expect(validateCorrection(60, 45, 'Took a break').errors).toEqual([]);
  });

  it('allow correcting an entry down to zero (e.g. logged by mistake)', () => {
    expect(validateCorrection(60, 0, 'Wrong project').errors).toEqual([]);
  });
});
