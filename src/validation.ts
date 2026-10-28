// Checks what the user typed before anything is saved.
// "errors" block saving; "warnings" only ask the user to confirm.

const TEN_HOURS = 10 * 60;
const LONG_WARNING = 'This is longer than 10 hours. Is that correct?';

export interface ManualEntryInput {
  mode: 'times' | 'duration';
  date: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:mm' (mode 'times')
  endTime: string; // 'HH:mm' (mode 'times')
  hours: number; // (mode 'duration')
  minutes: number; // (mode 'duration')
}

export interface EntryCheck {
  errors: string[];
  warnings: string[];
  start: string;
  end: string;
  duration_minutes: number;
}

/** Today's date as 'YYYY-MM-DD' in local time. */
export function localDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function validateManualEntry(input: ManualEntryInput, now: Date = new Date()): EntryCheck {
  const result: EntryCheck = { errors: [], warnings: [], start: '', end: '', duration_minutes: 0 };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    result.errors.push('Please choose a date.');
    return result;
  }

  if (input.mode === 'times') {
    if (!input.startTime || !input.endTime) {
      result.errors.push('Please enter a start time and an end time.');
      return result;
    }
    const start = new Date(`${input.date}T${input.startTime}`);
    const end = new Date(`${input.date}T${input.endTime}`);
    if (end <= start) result.errors.push('The end time must be after the start time.');
    if (end > now) result.errors.push('This entry ends in the future.');
    result.start = `${input.date}T${input.startTime}`;
    result.end = `${input.date}T${input.endTime}`;
    result.duration_minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  } else {
    const hours = Number.isFinite(input.hours) ? input.hours : 0;
    const minutes = Number.isFinite(input.minutes) ? input.minutes : 0;
    if (hours < 0 || minutes < 0) result.errors.push('Hours and minutes cannot be negative.');
    result.duration_minutes = Math.round(hours * 60 + minutes);
    if (result.duration_minutes <= 0) result.errors.push('Please enter how long you worked.');
    if (input.date > localDate(now)) result.errors.push('The date is in the future.');
    result.start = input.date;
  }

  if (result.errors.length === 0 && result.duration_minutes > TEN_HOURS) result.warnings.push(LONG_WARNING);
  return result;
}

export function validateCorrection(currentMinutes: number, correctedMinutes: number, reason: string) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Number.isFinite(correctedMinutes) || correctedMinutes < 0) errors.push('The corrected time cannot be negative.');
  else if (correctedMinutes === currentMinutes) errors.push('The corrected time is the same as the current time.');
  if (!reason.trim()) errors.push('Please give a reason for the correction.');
  if (errors.length === 0 && correctedMinutes > TEN_HOURS) warnings.push(LONG_WARNING);
  return { errors, warnings };
}
