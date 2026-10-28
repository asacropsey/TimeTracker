// Tests that projects, milestones and totals are calculated correctly from the events.

import { describe, expect, it } from 'vitest';
import { createMilestone, createProject, createTimeEntry, updateMilestone, updateProject } from '../src/events';
import { buildState } from '../src/state';
import type { AppEvent } from '../src/types';

describe('buildState', () => {
  it('builds projects and ordered milestones', () => {
    const events: AppEvent[] = [...createProject('computer', 'WP-Examen', 'Exam prep')];
    const pid = events[0].kind === 'change' ? events[0].record_id : '';
    events.push(...createMilestone('computer', pid, 'Bilanzierung', 80, 2));
    events.push(...createMilestone('computer', pid, 'Steuerrecht', 120, 1));

    const state = buildState(events);
    expect(state.projects).toEqual([{ project_id: pid, name: 'WP-Examen', description: 'Exam prep', status: 'active' }]);
    expect(state.milestones.map((m) => [m.name, m.planned_hours])).toEqual([
      ['Steuerrecht', 120],
      ['Bilanzierung', 80],
    ]);
  });

  it('applies planned-hours changes, done/reopen and archiving', () => {
    const events: AppEvent[] = [...createProject('computer', 'Roman', '')];
    let state = buildState(events);
    const project = state.projects[0];
    events.push(...createMilestone('computer', project.project_id, 'Draft', 100, 1));
    state = buildState(events);

    events.push(...updateMilestone('phone', state.milestones[0], 'planned_hours', '150'));
    events.push(...updateMilestone('phone', state.milestones[0], 'status', 'done'));
    events.push(...updateProject('phone', project, 'status', 'archived'));
    state = buildState(events);
    expect(state.milestones[0]).toMatchObject({ planned_hours: 150, status: 'done' });
    expect(state.milestones[0].done_at).not.toBe('');
    expect(state.projects[0].status).toBe('archived');

    events.push(...updateMilestone('phone', state.milestones[0], 'status', 'open'));
    expect(buildState(events).milestones[0]).toMatchObject({ status: 'open', done_at: '' });
  });

  it('gives the same result no matter in which order events arrive (phone + computer)', () => {
    const events: AppEvent[] = [...createProject('computer', 'A', '')];
    const project = buildState(events).projects[0];
    events.push(...updateProject('phone', project, 'name', 'B'));
    const shuffled = [...events].reverse();
    expect(buildState(shuffled).projects[0].name).toBe('B');
  });

  it('adds up time per project and per milestone', () => {
    const add = (project_id: string, milestone_id: string, minutes: number) =>
      createTimeEntry('phone', { project_id, milestone_id, start: '2026-01-01', end: '', duration_minutes: minutes, note: '' });
    const state = buildState([...add('p1', 'm1', 30), ...add('p1', 'm1', 45), ...add('p1', '', 15), ...add('p2', 'm2', 60)]);
    expect(state.minutesByProject.get('p1')).toBe(90);
    expect(state.minutesByProject.get('p2')).toBe(60);
    expect(state.minutesByMilestone.get('m1')).toBe(75);
  });

  it('lists entries newest first', () => {
    const at = (start: string) =>
      createTimeEntry('phone', { project_id: 'p', milestone_id: '', start, end: '', duration_minutes: 10, note: start });
    const state = buildState([...at('2026-01-02T08:00'), ...at('2026-03-01'), ...at('2026-01-02T18:00')]);
    expect(state.entries.map((v) => v.entry.note)).toEqual(['2026-03-01', '2026-01-02T18:00', '2026-01-02T08:00']);
  });
});
