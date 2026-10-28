// The shapes of the data the app stores.
//
// Everything the user does is saved as an EVENT. Events are only ever added, never changed or
// deleted. The current state (project names, totals, ...) is calculated by replaying all events.
// Empty values are stored as '' (not null) so they look clean in Excel later.

/** A row for the Excel sheet "Entries": a block of logged time, or a correction of one. */
export interface TimeEntryEvent {
  kind: 'entry';
  event_id: string;
  device: string; // 'phone' or 'computer'
  created_at: string; // when the event was created (ISO, UTC)
  project_id: string;
  milestone_id: string; // '' = no milestone
  start: string; // 'YYYY-MM-DDTHH:mm' (local time), or 'YYYY-MM-DD' if only a duration was given, '' for corrections
  end: string; // 'YYYY-MM-DDTHH:mm' or ''
  duration_minutes: number; // for corrections: the CHANGE in minutes (can be negative)
  note: string; // for corrections: the reason (required)
  entry_type: 'normal' | 'correction';
  corrects_event_id: string; // for corrections: event_id of the corrected entry
}

export type ChangeAction = 'create_project' | 'update_project' | 'create_milestone' | 'update_milestone';

/** A row for the Excel sheet "ChangeLog": one change to one field of a project or milestone. */
export interface ChangeEvent {
  kind: 'change';
  event_id: string;
  device: string;
  created_at: string;
  action: ChangeAction;
  record_id: string; // project_id or milestone_id
  field: string;
  old_value: string;
  new_value: string;
}

export type AppEvent = TimeEntryEvent | ChangeEvent;

// ----- Current state, calculated from the events (never stored) -----

export interface Project {
  project_id: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
}

export interface Milestone {
  milestone_id: string;
  project_id: string;
  name: string;
  planned_hours: number;
  order: number;
  status: 'open' | 'done';
  done_at: string;
}

/** A normal time entry together with the corrections that were made to it. */
export interface EntryView {
  entry: TimeEntryEvent;
  corrections: TimeEntryEvent[];
  effective_minutes: number; // original duration + all corrections
}

export interface AppState {
  projects: Project[];
  milestones: Milestone[]; // sorted by project, then order
  entries: EntryView[]; // newest first
  minutesByProject: Map<string, number>;
  minutesByMilestone: Map<string, number>;
}
