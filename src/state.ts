// Calculates the current state (projects, milestones, totals) by replaying all events in order.

import type { AppEvent, AppState, ChangeEvent, EntryView, Milestone, Project, TimeEntryEvent } from './types';

function byCreation(a: AppEvent, b: AppEvent): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.event_id < b.event_id ? -1 : 1;
}

export function buildState(events: AppEvent[]): AppState {
  const sorted = [...events].sort(byCreation);
  const projects = new Map<string, Project>();
  const milestones = new Map<string, Milestone>();

  for (const e of sorted) {
    if (e.kind === 'change') applyChange(e, projects, milestones);
  }

  // Time entries: group corrections under the entry they correct.
  const timeEvents = sorted.filter((e): e is TimeEntryEvent => e.kind === 'entry');
  const views = new Map<string, EntryView>();
  for (const e of timeEvents) {
    if (e.entry_type === 'normal') views.set(e.event_id, { entry: e, corrections: [], effective_minutes: e.duration_minutes });
  }
  for (const e of timeEvents) {
    if (e.entry_type !== 'correction') continue;
    const view = views.get(e.corrects_event_id);
    if (view) {
      view.corrections.push(e);
      view.effective_minutes += e.duration_minutes;
    }
  }

  // Totals = all normal entries + all corrections.
  const minutesByProject = new Map<string, number>();
  const minutesByMilestone = new Map<string, number>();
  for (const e of timeEvents) {
    minutesByProject.set(e.project_id, (minutesByProject.get(e.project_id) ?? 0) + e.duration_minutes);
    if (e.milestone_id) {
      minutesByMilestone.set(e.milestone_id, (minutesByMilestone.get(e.milestone_id) ?? 0) + e.duration_minutes);
    }
  }

  return {
    projects: [...projects.values()],
    milestones: [...milestones.values()].sort((a, b) =>
      a.project_id === b.project_id ? a.order - b.order : a.project_id < b.project_id ? -1 : 1,
    ),
    entries: [...views.values()].sort((a, b) => sortKey(b.entry).localeCompare(sortKey(a.entry))),
    minutesByProject,
    minutesByMilestone,
  };
}

// Newest work first: by date/time of the work, then by when it was entered.
function sortKey(e: TimeEntryEvent): string {
  return e.start.padEnd(16, ' ') + e.created_at;
}

function applyChange(e: ChangeEvent, projects: Map<string, Project>, milestones: Map<string, Milestone>): void {
  switch (e.action) {
    case 'create_project':
      projects.set(e.record_id, { project_id: e.record_id, name: e.new_value, description: '', status: 'active' });
      break;
    case 'update_project': {
      const p = projects.get(e.record_id);
      if (!p) return;
      if (e.field === 'name' || e.field === 'description') p[e.field] = e.new_value;
      if (e.field === 'status') p.status = e.new_value === 'archived' ? 'archived' : 'active';
      break;
    }
    case 'create_milestone':
      milestones.set(e.record_id, {
        milestone_id: e.record_id,
        project_id: e.new_value,
        name: '',
        planned_hours: 0,
        order: 0,
        status: 'open',
        done_at: '',
      });
      break;
    case 'update_milestone': {
      const m = milestones.get(e.record_id);
      if (!m) return;
      if (e.field === 'name') m.name = e.new_value;
      if (e.field === 'planned_hours') m.planned_hours = Number(e.new_value) || 0;
      if (e.field === 'order') m.order = Number(e.new_value) || 0;
      if (e.field === 'status') {
        m.status = e.new_value === 'done' ? 'done' : 'open';
        m.done_at = m.status === 'done' ? e.created_at : '';
      }
      break;
    }
  }
}
