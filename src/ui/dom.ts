// Small helpers for building the screens and formatting numbers and dates.

import type { AppEvent, AppState, TimeEntryEvent } from '../types';

/** Everything a screen needs: the current data and a way to save new events. */
export interface AppContext {
  state: AppState;
  device: string;
  /** Number of events on this device not yet in the Excel file. */
  pendingCount: number;
  /** Reloads all data from the device's database and redraws. */
  reloadData(): Promise<void>;
  lastProjectId: string;
  lastMilestoneId: string;
  save(events: AppEvent[]): Promise<void>;
  rememberSelection(projectId: string, milestoneId: string): void;
  goTo(tab: 'log' | 'projects' | 'history' | 'account'): void;
  /** Redraws the current screen (e.g. after an answer from Microsoft arrived). */
  rerender(): void;
}

type Child = Node | string | null | undefined | false;

/** Creates an HTML element, e.g. h('button', { onclick: ... }, 'Save'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  // Properties are set after the children so that e.g. a <select>'s value matches an <option>.
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value as EventListener);
    else if (key === 'class') el.className = String(value);
    else if (key in el) (el as unknown as Record<string, unknown>)[key] = value;
    else el.setAttribute(key, String(value));
  }
  return el;
}

/** 90 -> "1 h 30 min", 45 -> "45 min", -30 -> "−30 min" */
export function formatMinutes(total: number): string {
  const sign = total < 0 ? '−' : '';
  const abs = Math.abs(Math.round(total));
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  if (hours === 0) return `${sign}${minutes} min`;
  return minutes === 0 ? `${sign}${hours} h` : `${sign}${hours} h ${minutes} min`;
}

export function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)} h`;
}

/** 'YYYY-MM-DD' -> "Tue, 27 Oct 2026" */
export function formatDate(date: string): string {
  return new Date(`${date.slice(0, 10)}T12:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** When the work happened, e.g. "Tue, 27 Oct 2026 · 08:00–09:30" */
export function formatWhen(e: TimeEntryEvent): string {
  const date = formatDate(e.start);
  return e.start.length > 10 ? `${date} · ${e.start.slice(11)}–${e.end.slice(11)}` : date;
}

/** Shows errors (red) and warnings (orange) in a box. */
export function messages(errors: string[], warnings: string[] = []): HTMLElement {
  return h(
    'div',
    {},
    ...errors.map((m) => h('p', { class: 'msg error' }, m)),
    ...warnings.map((m) => h('p', { class: 'msg warning' }, m)),
  );
}

/** Asks the user to confirm warnings. Returns true if there are none or the user agrees. */
export function confirmWarnings(warnings: string[]): boolean {
  return warnings.length === 0 || confirm(`${warnings.join('\n')}\n\nSave anyway?`);
}

export function projectName(state: AppState, projectId: string): string {
  return state.projects.find((p) => p.project_id === projectId)?.name ?? '(unknown project)';
}

export function milestoneName(state: AppState, milestoneId: string): string {
  if (!milestoneId) return '';
  return state.milestones.find((m) => m.milestone_id === milestoneId)?.name ?? '(unknown milestone)';
}
