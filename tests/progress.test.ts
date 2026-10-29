// Tests for the Progress screen's numbers (SPEC "Progress & dashboard").

import { describe, expect, it } from 'vitest';
import { createCorrection, createMilestone, createProject, createTimeEntry, updateMilestone, updateProject } from '../src/events';
import { lastWeeks, milestonePercent, minutesPerWeek, projectColor, summarize, weekStart } from '../src/progress';
import { buildState } from '../src/state';
import type { AppEvent } from '../src/types';

const today = new Date('2026-10-29T10:00'); // a Thursday

function setup() {
  const events: AppEvent[] = [...createProject('computer', 'WP-Examen', ''), ...createProject('computer', 'Roman', '')];
  let state = buildState(events);
  const [wp, roman] = state.projects;
  events.push(...createMilestone('computer', wp.project_id, 'Steuerrecht', 10, 1));
  events.push(...createMilestone('computer', wp.project_id, 'Bilanz', 4, 2));
  state = buildState(events);
  const add = (projectId: string, milestoneId: string, start: string, minutes: number) =>
    events.push(...createTimeEntry('phone', { project_id: projectId, milestone_id: milestoneId, start, end: '', duration_minutes: minutes, note: '' }));
  return { events, wp, roman, ms: state.milestones, add };
}

describe('weeks', () => {
  it('start on Monday', () => {
    expect(weekStart('2026-10-29')).toBe('2026-10-26'); // Thursday → Monday
    expect(weekStart('2026-10-26T08:00')).toBe('2026-10-26'); // Monday stays
    expect(weekStart('2026-11-01')).toBe('2026-10-26'); // Sunday belongs to the week before
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // across the daylight-saving change
  });

  it('the last 12 weeks end with the current one', () => {
    const weeks = lastWeeks(12, today);
    expect(weeks).toHaveLength(12);
    expect(weeks.at(-1)).toBe('2026-10-26');
    expect(weeks[0]).toBe('2026-08-10');
  });
});

describe('hours per week per project', () => {
  it('adds up entries in the week they were worked', () => {
    const { events, wp, roman, add } = setup();
    add(wp.project_id, '', '2026-10-26T08:00', 60);
    add(wp.project_id, '', '2026-11-01', 30); // Sunday, same week
    add(wp.project_id, '', '2026-10-25', 45); // Sunday, week before
    add(roman.project_id, '', '2026-10-28', 120);
    const weeks = lastWeeks(2, today);
    const result = minutesPerWeek(buildState(events), weeks);
    expect(result.get(wp.project_id)).toEqual([45, 90]);
    expect(result.get(roman.project_id)).toEqual([0, 120]);
  });

  it('a correction counts in the week of the entry it corrects, not when it was made', () => {
    const { events, wp, add } = setup();
    add(wp.project_id, '', '2026-10-20', 90); // last week
    const view = buildState(events).entries[0];
    events.push(...createCorrection('phone', view, 60, 'break')); // made today
    const result = minutesPerWeek(buildState(events), lastWeeks(2, today));
    expect(result.get(wp.project_id)).toEqual([60, 0]);
  });
});

describe('project summary', () => {
  it('shows time-based and milestone-based progress separately', () => {
    const { events, wp, ms, add } = setup();
    add(wp.project_id, ms[0].milestone_id, '2026-10-27', 7 * 60);
    events.push(...updateMilestone('computer', ms[1], 'status', 'done'));
    const s = summarize(buildState(events), buildState(events).projects[0], today);
    expect(s).toMatchObject({
      loggedMinutes: 420,
      plannedHours: 14,
      timePercent: 50,
      milestonesDone: 1,
      milestonesTotal: 2,
      milestonePercent: 50,
      thisWeekMinutes: 420,
    });
    expect(s.project.project_id).toBe(wp.project_id);
  });

  it('has no percentage when nothing is planned yet', () => {
    const { events, roman } = setup();
    const s = summarize(buildState(events), roman, today);
    expect(s.timePercent).toBeNull();
    expect(s.milestonePercent).toBeNull();
  });

  it('milestone % may go above 100 (overrun)', () => {
    expect(milestonePercent(15 * 60, 10)).toBe(150);
    expect(milestonePercent(30, 0)).toBe(0);
  });
});

describe('project colours', () => {
  it('follow the project for good – archiving another one does not repaint it', () => {
    const { events, wp, roman } = setup();
    const before = projectColor(buildState(events), roman.project_id);
    events.push(...updateProject('computer', wp, 'status', 'archived'));
    expect(projectColor(buildState(events), roman.project_id)).toBe(before);
    expect(projectColor(buildState(events), wp.project_id)).not.toBe(before);
  });
});
