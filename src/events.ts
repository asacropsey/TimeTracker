// Functions that CREATE new events. They never change existing ones.
// Each function returns a list of events, which the caller then saves with appendEvents().

import type { ChangeAction, ChangeEvent, EntryView, Milestone, Project, TimeEntryEvent } from './types';

// Makes sure events created in the same millisecond still get increasing timestamps,
// so they are always replayed in the order they were made.
let lastTimestamp = 0;
function nextTimestamp(): string {
  lastTimestamp = Math.max(Date.now(), lastTimestamp + 1);
  return new Date(lastTimestamp).toISOString();
}

function base(device: string) {
  return { event_id: crypto.randomUUID(), device, created_at: nextTimestamp() };
}

function change(
  device: string,
  action: ChangeAction,
  record_id: string,
  field: string,
  old_value: string,
  new_value: string,
): ChangeEvent {
  return { kind: 'change', ...base(device), action, record_id, field, old_value, new_value };
}

// ----- Projects -----

export function createProject(device: string, name: string, description: string): ChangeEvent[] {
  const id = crypto.randomUUID();
  const events = [change(device, 'create_project', id, 'name', '', name.trim())];
  if (description.trim()) events.push(change(device, 'update_project', id, 'description', '', description.trim()));
  return events;
}

export function updateProject(
  device: string,
  project: Project,
  field: 'name' | 'description' | 'status',
  value: string,
): ChangeEvent[] {
  return [change(device, 'update_project', project.project_id, field, project[field], value)];
}

// ----- Milestones -----

export function createMilestone(
  device: string,
  projectId: string,
  name: string,
  plannedHours: number,
  order: number,
): ChangeEvent[] {
  const id = crypto.randomUUID();
  return [
    change(device, 'create_milestone', id, 'project_id', '', projectId),
    change(device, 'update_milestone', id, 'name', '', name.trim()),
    change(device, 'update_milestone', id, 'planned_hours', '', String(plannedHours)),
    change(device, 'update_milestone', id, 'order', '', String(order)),
  ];
}

export function updateMilestone(
  device: string,
  milestone: Milestone,
  field: 'name' | 'planned_hours' | 'order' | 'status',
  value: string,
): ChangeEvent[] {
  return [change(device, 'update_milestone', milestone.milestone_id, field, String(milestone[field]), value)];
}

// ----- Time entries -----

export function createTimeEntry(
  device: string,
  fields: { project_id: string; milestone_id: string; start: string; end: string; duration_minutes: number; note: string },
): TimeEntryEvent[] {
  return [{ kind: 'entry', ...base(device), ...fields, note: fields.note.trim(), entry_type: 'normal', corrects_event_id: '' }];
}

/**
 * A correction never changes the original entry. It adds a new entry whose duration is the
 * DIFFERENCE between the corrected duration and the current one (e.g. -30 to remove 30 minutes).
 */
export function createCorrection(
  device: string,
  original: EntryView,
  correctedMinutes: number,
  reason: string,
): TimeEntryEvent[] {
  return [
    {
      kind: 'entry',
      ...base(device),
      project_id: original.entry.project_id,
      milestone_id: original.entry.milestone_id,
      start: '',
      end: '',
      duration_minutes: correctedMinutes - original.effective_minutes,
      note: reason.trim(),
      entry_type: 'correction',
      corrects_event_id: original.entry.event_id,
    },
  ];
}
