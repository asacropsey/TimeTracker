// Numbers for the Progress screen, calculated from the current state (never stored).

import type { AppState, Project } from './types';
import { localDate } from './validation';

/** Colours for projects in the weekly chart (from the crest; checked for contrast and colour-blindness). */
export const PROJECT_COLORS = ['#b8892d', '#467cc0', '#76923b', '#90589d']; // gold, blue, olive, plum
export const OTHER_COLOR = '#7d8592'; // everything beyond the fourth project

/**
 * Each project keeps the same colour for good: colours follow the order projects were created in
 * (archived ones included), never their rank, so nothing is repainted when something changes.
 */
export function projectColor(state: AppState, projectId: string): string {
  const index = state.projects.findIndex((p) => p.project_id === projectId);
  return PROJECT_COLORS[index] ?? OTHER_COLOR;
}

/** Monday of the week a date ('YYYY-MM-DD…') falls in, as 'YYYY-MM-DD'. */
export function weekStart(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T12:00`); // midday: safe from daylight-saving jumps
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDate(d);
}

/** The Mondays of the last `count` weeks, oldest first, ending with the current week. */
export function lastWeeks(count: number, today: Date = new Date()): string[] {
  const current = new Date(`${weekStart(localDate(today))}T12:00`);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(current);
    d.setDate(d.getDate() - 7 * (count - 1 - i));
    return localDate(d);
  });
}

/**
 * Minutes per project per week. An entry counts in the week it was worked in; its corrections count
 * in that same week (the entry's corrected total is used), whenever the correction was made.
 */
export function minutesPerWeek(state: AppState, weeks: string[]): Map<string, number[]> {
  const result = new Map<string, number[]>();
  const index = new Map(weeks.map((w, i) => [w, i]));
  for (const view of state.entries) {
    const i = index.get(weekStart(view.entry.start));
    if (i === undefined) continue;
    const row = result.get(view.entry.project_id) ?? weeks.map(() => 0);
    row[i] += view.effective_minutes;
    result.set(view.entry.project_id, row);
  }
  return result;
}

export interface ProjectSummary {
  project: Project;
  loggedMinutes: number;
  plannedHours: number;
  timePercent: number | null; // null when nothing is planned yet
  milestonesDone: number;
  milestonesTotal: number;
  milestonePercent: number | null; // null when there are no milestones
  thisWeekMinutes: number;
}

export function summarize(state: AppState, project: Project, today: Date = new Date()): ProjectSummary {
  const milestones = state.milestones.filter((m) => m.project_id === project.project_id);
  const loggedMinutes = state.minutesByProject.get(project.project_id) ?? 0;
  const plannedHours = milestones.reduce((sum, m) => sum + m.planned_hours, 0);
  const done = milestones.filter((m) => m.status === 'done').length;
  const thisWeek = weekStart(localDate(today));
  const thisWeekMinutes = state.entries
    .filter((v) => v.entry.project_id === project.project_id && weekStart(v.entry.start) === thisWeek)
    .reduce((sum, v) => sum + v.effective_minutes, 0);
  return {
    project,
    loggedMinutes,
    plannedHours,
    timePercent: plannedHours > 0 ? Math.round((loggedMinutes / 60 / plannedHours) * 100) : null,
    milestonesDone: done,
    milestonesTotal: milestones.length,
    milestonePercent: milestones.length > 0 ? Math.round((done / milestones.length) * 100) : null,
    thisWeekMinutes,
  };
}

/** Logged vs planned for one milestone (% may go above 100). */
export function milestonePercent(loggedMinutes: number, plannedHours: number): number {
  return plannedHours > 0 ? Math.round((loggedMinutes / 60 / plannedHours) * 100) : 0;
}
