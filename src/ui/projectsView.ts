// Screen "Projects": create/rename/archive projects and manage their milestones.

import { createMilestone, createProject, updateMilestone, updateProject } from '../events';
import type { ChangeEvent, Milestone, Project } from '../types';
import { formatHours, h, messages, type AppContext } from './dom';
import { banner, shield } from './ornaments';

let showArchived = false;

export function projectsView(ctx: AppContext): HTMLElement {
  const active = ctx.state.projects.filter((p) => p.status === 'active');
  const archived = ctx.state.projects.filter((p) => p.status === 'archived');

  return h(
    'div',
    {},
    banner('Projects'),
    newProjectForm(ctx),
    ...active.map((p) => projectCard(ctx, p)),
    archived.length > 0 &&
      h(
        'button',
        { class: 'link', onclick: () => ((showArchived = !showArchived), ctx.goTo('projects')) },
        showArchived ? 'Hide archived projects' : `Show archived projects (${archived.length})`,
      ),
    ...(showArchived ? archived.map((p) => projectCard(ctx, p)) : []),
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

/** Asks for a new text value. Returns null if cancelled or unchanged. */
function ask(question: string, current: string): string | null {
  const answer = prompt(question, current);
  return answer === null || answer.trim() === current ? null : answer.trim();
}

function projectCard(ctx: AppContext, p: Project): HTMLElement {
  const { state, device } = ctx;
  const milestones = state.milestones.filter((m) => m.project_id === p.project_id);
  const logged = state.minutesByProject.get(p.project_id) ?? 0;
  const planned = milestones.reduce((sum, m) => sum + m.planned_hours, 0);
  const done = milestones.filter((m) => m.status === 'done').length;

  const rename = () => {
    const v = ask('New project name:', p.name);
    if (v) ctx.save(updateProject(device, p, 'name', v));
  };
  const describe = () => {
    const v = ask('Project description:', p.description);
    if (v !== null) ctx.save(updateProject(device, p, 'description', v));
  };
  const toggleArchive = () =>
    ctx.save(updateProject(device, p, 'status', p.status === 'active' ? 'archived' : 'active'));

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
    h(
      'p',
      { class: 'num' },
      `Logged ${formatHours(logged)} of ${planned} h planned`,
      milestones.length > 0 ? ` · ${done} of ${milestones.length} milestones complete` : '',
    ),
    h(
      'div',
      { class: 'actions' },
      h('button', { onclick: rename }, 'Rename'),
      h('button', { onclick: describe }, 'Description'),
      h('button', { onclick: toggleArchive }, p.status === 'active' ? 'Archive' : 'Restore'),
    ),
    h('h3', {}, 'Milestones'),
    milestones.length === 0 && h('p', { class: 'muted' }, 'No milestones yet.'),
    ...milestones.map((m, i) => milestoneRow(ctx, milestones, m, i)),
    newMilestoneForm(ctx, p, milestones),
  );
}

function milestoneRow(ctx: AppContext, list: Milestone[], m: Milestone, index: number): HTMLElement {
  const { device } = ctx;
  const logged = ctx.state.minutesByMilestone.get(m.milestone_id) ?? 0;
  const percent = m.planned_hours > 0 ? Math.round((logged / 60 / m.planned_hours) * 100) : 0;
  const over = percent > 100;

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
    { class: m.status === 'done' ? 'milestone done' : 'milestone' },
    h(
      'div',
      { class: 'milestone-head' },
      m.status === 'done'
        ? banner(`${index + 1}. ${m.name}`, 'banner small')
        : h('span', { class: 'milestone-name' }, `${index + 1}. ${m.name}`),
      h('span', { class: over ? 'num over' : 'num' }, `${formatHours(logged)} / ${m.planned_hours} h · ${percent} %`),
    ),
    h('div', { class: 'bar' }, h('div', { class: over ? 'fill over' : 'fill', style: `width:${Math.min(percent, 100)}%` })),
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
