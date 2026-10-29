// Screen "Progress": this week, hours per week (chart), and per project the time-based and
// milestone-based progress. Setting things up (rename, planned hours, …) is under "Manage".

import { createMilestone, createProject, updateMilestone, updateProject } from '../events';
import { lastWeeks, milestonePercent, minutesPerWeek, OTHER_COLOR, projectColor, summarize, type ProjectSummary } from '../progress';
import type { ChangeEvent, Milestone, Project } from '../types';
import { formatHours, formatMinutes, h, messages, type AppContext } from './dom';
import { banner, shield } from './ornaments';

const CHART_WEEKS = 12;

// Kept between screen refreshes.
let showArchived = false;
const managing = new Set<string>();

export function progressView(ctx: AppContext): HTMLElement {
  const active = ctx.state.projects.filter((p) => p.status === 'active');
  const archived = ctx.state.projects.filter((p) => p.status === 'archived');
  const summaries = active.map((p) => summarize(ctx.state, p));

  return h(
    'div',
    {},
    banner('Progress'),
    active.length > 0 && thisWeekCard(ctx, summaries),
    active.length > 0 && weeklyChartCard(ctx, active),
    ...summaries.map((s) => projectCard(ctx, s)),
    newProjectForm(ctx),
    archived.length > 0 &&
      h(
        'button',
        { class: 'link', onclick: () => ((showArchived = !showArchived), ctx.rerender()) },
        showArchived ? 'Hide archived projects' : `Show archived projects (${archived.length})`,
      ),
    ...(showArchived ? archived.map((p) => projectCard(ctx, summarize(ctx.state, p))) : []),
  );
}

function dashCard(...children: (Node | string | false | null)[]): HTMLElement {
  return h('section', { class: 'card' }, ...children);
}

const swatch = (color: string) => h('span', { class: 'swatch', style: `background:${color}` });

// ----- This week -----

function thisWeekCard(ctx: AppContext, summaries: ProjectSummary[]): HTMLElement {
  const total = summaries.reduce((sum, s) => sum + s.thisWeekMinutes, 0);
  const monday = new Date(`${lastWeeks(1)[0]}T12:00`);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const day = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return dashCard(
    h('h2', { class: 'center' }, 'This week'),
    h('div', { class: 'hero' }, formatMinutes(total)),
    h('p', { class: 'center small muted' }, `${day(monday)} – ${day(sunday)}`),
    h(
      'ul',
      { class: 'week-list' },
      ...summaries.map((s) =>
        h(
          'li',
          {},
          swatch(projectColor(ctx.state, s.project.project_id)),
          h('span', {}, s.project.name),
          h('span', { class: 'num' }, formatMinutes(s.thisWeekMinutes)),
        ),
      ),
    ),
  );
}

// ----- Hours per week (chart + table) -----

function weeklyChartCard(ctx: AppContext, active: Project[]): HTMLElement {
  const weeks = lastWeeks(CHART_WEEKS);
  const perProject = minutesPerWeek(ctx.state, weeks);

  // One series per project (in creation order); a 5th project and beyond share "Other".
  const series: { label: string; color: string; minutes: number[] }[] = [];
  for (const p of active) {
    const color = projectColor(ctx.state, p.project_id);
    const minutes = perProject.get(p.project_id) ?? weeks.map(() => 0);
    const other = series.find((s) => s.color === OTHER_COLOR);
    if (color === OTHER_COLOR && other) other.minutes = other.minutes.map((m, i) => m + minutes[i]);
    else series.push({ label: color === OTHER_COLOR ? 'Other' : p.name, color, minutes: [...minutes] });
  }

  const weekLabel = (w: string) => new Date(`${w}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const canvas = h('canvas', { role: 'img', 'aria-label': 'Hours per week per project, last 12 weeks' });
  // Chart.js is loaded only when needed; the chart is drawn once the canvas is on screen.
  requestAnimationFrame(() => {
    if (!canvas.isConnected) return;
    import('./weeklyChart').then(({ drawWeeklyChart }) =>
      drawWeeklyChart(canvas, weeks.map(weekLabel), series.map((s) => ({ ...s, hours: s.minutes.map((m) => m / 60) }))),
    );
  });

  const totals = weeks.map((_, i) => series.reduce((sum, s) => sum + s.minutes[i], 0));
  const table = h(
    'details',
    { class: 'table-view' },
    h('summary', {}, 'Show as table'),
    h(
      'div',
      { class: 'table-scroll' },
      h(
        'table',
        { class: 'num' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Week of'), ...series.map((s) => h('th', {}, s.label)), h('th', {}, 'Total'))),
        h(
          'tbody',
          {},
          ...weeks
            .map((w, i) =>
              h(
                'tr',
                {},
                h('td', {}, weekLabel(w)),
                ...series.map((s) => h('td', {}, s.minutes[i] ? formatHours(s.minutes[i]) : '–')),
                h('td', {}, totals[i] ? formatHours(totals[i]) : '–'),
              ),
            )
            .reverse(), // newest week first
        ),
      ),
    ),
  );

  return dashCard(
    h('h2', {}, 'Hours per week'),
    h('p', { class: 'small muted' }, `Last ${CHART_WEEKS} weeks, Monday to Sunday`),
    h('ul', { class: 'legend' }, ...series.map((s) => h('li', {}, swatch(s.color), s.label))),
    h('div', { class: 'chart-box' }, canvas),
    table,
  );
}

// ----- One project -----

function bar(percent: number, className: string): HTMLElement {
  return h('div', { class: 'bar' }, h('div', { class: `fill ${className}`, style: `width:${Math.min(percent, 100)}%` }));
}

function projectCard(ctx: AppContext, s: ProjectSummary): HTMLElement {
  const p = s.project;
  const milestones = ctx.state.milestones.filter((m) => m.project_id === p.project_id);
  const isManaging = managing.has(p.project_id);
  const toggleManage = () => {
    if (isManaging) managing.delete(p.project_id);
    else managing.add(p.project_id);
    ctx.rerender();
  };
  const timeOver = (s.timePercent ?? 0) > 100;

  return h(
    'section',
    { class: p.status === 'archived' ? 'card archived' : 'card' },
    h(
      'div',
      { class: 'project-title' },
      shield(p.name.charAt(0).toUpperCase()),
      h('h2', {}, p.name, p.status === 'archived' ? ' (archived)' : ''),
    ),
    p.description && h('p', { class: 'muted' }, p.description),

    h('div', { class: 'stat' }, h('span', {}, 'Time'), h('span', { class: timeOver ? 'num over' : 'num' },
      `${formatHours(s.loggedMinutes)} of ${s.plannedHours} h`, s.timePercent !== null ? ` · ${s.timePercent} %` : '')),
    s.timePercent !== null && bar(s.timePercent, timeOver ? 'over' : ''),
    h('div', { class: 'stat' }, h('span', {}, 'Milestones'), h('span', { class: 'num' },
      s.milestonesTotal ? `${s.milestonesDone} of ${s.milestonesTotal} complete` : 'none yet',
      s.milestonePercent !== null ? ` · ${s.milestonePercent} %` : '')),
    s.milestonePercent !== null && bar(s.milestonePercent, 'gold'),
    s.timePercent !== null && s.milestonePercent !== null &&
      h('p', { class: 'small muted' }, 'Time spent is not the same as real progress – that is why both are shown.'),

    milestones.length > 0 && h('h3', {}, 'Milestones'),
    ...milestones.map((m, i) => milestoneRow(ctx, m, i)),

    // Everything that changes the project sits together here, in one place.
    isManaging &&
      h(
        'div',
        { class: 'manage' },
        projectActions(ctx, p),
        h('h3', {}, 'Manage milestones'),
        milestones.length === 0 && h('p', { class: 'small muted' }, 'No milestones yet – add the first one below.'),
        ...milestones.map((m, i) => milestoneActions(ctx, milestones, m, i)),
        newMilestoneForm(ctx, p, milestones),
      ),
    h('button', { class: 'link', onclick: toggleManage }, isManaging ? 'Done managing' : 'Manage'),
  );
}

function milestoneRow(ctx: AppContext, m: Milestone, index: number): HTMLElement {
  const logged = ctx.state.minutesByMilestone.get(m.milestone_id) ?? 0;
  const percent = milestonePercent(logged, m.planned_hours);
  const over = percent > 100;
  return h(
    'div',
    { class: m.status === 'done' ? 'milestone done' : 'milestone' },
    h(
      'div',
      { class: 'milestone-head' },
      m.status === 'done'
        ? banner(`${index + 1}. ${m.name}`, 'banner small')
        : h('span', { class: 'milestone-name' }, `${index + 1}. ${m.name}`),
      h('span', { class: over ? 'num over' : 'num' }, `${formatHours(logged)} / ${m.planned_hours} h · ${percent} %`),
    ),
    bar(percent, over ? 'over' : ''),
  );
}

// ----- Manage: everything that changes projects and milestones -----

/** Asks for a new text value. Returns null if cancelled or unchanged. */
function ask(question: string, current: string): string | null {
  const answer = prompt(question, current);
  return answer === null || answer.trim() === current ? null : answer.trim();
}

function projectActions(ctx: AppContext, p: Project): HTMLElement {
  const { device } = ctx;
  const rename = () => {
    const v = ask('New project name:', p.name);
    if (v) ctx.save(updateProject(device, p, 'name', v));
  };
  const describe = () => {
    const v = ask('Project description:', p.description);
    if (v !== null) ctx.save(updateProject(device, p, 'description', v));
  };
  const toggleArchive = () => ctx.save(updateProject(device, p, 'status', p.status === 'active' ? 'archived' : 'active'));
  return h(
    'div',
    {},
    h('h3', {}, 'Manage project'),
    h(
      'div',
      { class: 'actions' },
      h('button', { onclick: rename }, 'Rename'),
      h('button', { onclick: describe }, 'Description'),
      h('button', { onclick: toggleArchive }, p.status === 'active' ? 'Archive' : 'Restore'),
    ),
  );
}

function milestoneActions(ctx: AppContext, list: Milestone[], m: Milestone, index: number): HTMLElement {
  const { device } = ctx;
  // Moving = giving every milestone its new position number (only changed ones get an event).
  const move = (delta: number) => {
    const reordered = [...list];
    const [item] = reordered.splice(index, 1);
    reordered.splice(index + delta, 0, item);
    const events: ChangeEvent[] = [];
    reordered.forEach((x, i) => {
      if (x.order !== i + 1) events.push(...updateMilestone(device, x, 'order', String(i + 1)));
    });
    ctx.save(events);
  };
  const rename = () => {
    const v = ask('New milestone name:', m.name);
    if (v) ctx.save(updateMilestone(device, m, 'name', v));
  };
  const changeHours = () => {
    const v = ask('Planned hours:', String(m.planned_hours));
    if (v === null) return;
    const hours = Number(v.replace(',', '.'));
    if (!Number.isFinite(hours) || hours < 0) return alert('Please enter a number of hours, e.g. 120.');
    ctx.save(updateMilestone(device, m, 'planned_hours', String(hours)));
  };
  const toggleDone = () => ctx.save(updateMilestone(device, m, 'status', m.status === 'done' ? 'open' : 'done'));
  return h(
    'div',
    { class: 'manage-milestone' },
    h('div', { class: 'milestone-name' }, `${index + 1}. ${m.name}`, h('span', { class: 'muted num' }, ` · ${m.planned_hours} h planned`)),
    h(
      'div',
      { class: 'actions' },
      h('button', { onclick: () => move(-1), disabled: index === 0, title: 'Move up' }, '↑'),
      h('button', { onclick: () => move(1), disabled: index === list.length - 1, title: 'Move down' }, '↓'),
      h('button', { onclick: rename }, 'Rename'),
      h('button', { onclick: changeHours }, 'Planned hours'),
      h('button', { onclick: toggleDone }, m.status === 'done' ? 'Reopen' : 'Mark complete'),
    ),
  );
}

function newMilestoneForm(ctx: AppContext, p: Project, milestones: Milestone[]): HTMLElement {
  const name = h('input', { type: 'text', placeholder: 'e.g. Steuerrecht' });
  const hours = h('input', { type: 'number', min: '0', step: '1', inputMode: 'decimal', placeholder: 'e.g. 120' });
  const feedback = h('div', {});
  const add = () => {
    const errors: string[] = [];
    if (!name.value.trim()) errors.push('Please enter a milestone name.');
    if (!(hours.valueAsNumber >= 0)) errors.push('Please enter the planned hours (a number, can be 0).');
    if (errors.length) return feedback.replaceChildren(messages(errors));
    const order = Math.max(0, ...milestones.map((m) => m.order)) + 1;
    ctx.save(createMilestone(ctx.device, p.project_id, name.value, hours.valueAsNumber, order));
  };
  return h(
    'details',
    { class: 'add-milestone' },
    h('summary', {}, 'Add milestone'),
    h('label', {}, 'Name', name),
    h('label', {}, 'Planned hours', hours),
    feedback,
    h('button', { class: 'primary', onclick: add }, 'Add milestone'),
  );
}

function newProjectForm(ctx: AppContext): HTMLElement {
  const name = h('input', { type: 'text', placeholder: 'e.g. WP-Examen' });
  const description = h('input', { type: 'text', placeholder: 'Optional' });
  const feedback = h('div', {});
  const add = () => {
    if (!name.value.trim()) return feedback.replaceChildren(messages(['Please enter a project name.']));
    ctx.save(createProject(ctx.device, name.value, description.value));
  };
  return h(
    'details',
    { class: 'card', open: ctx.state.projects.length === 0 },
    h('summary', {}, 'New project'),
    h('label', {}, 'Name', name),
    h('label', {}, 'Description', description),
    feedback,
    h('button', { class: 'primary', onclick: add }, 'Create project'),
  );
}
