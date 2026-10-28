// Screen "History": read-only list of all entries, with filters and "Correct this entry".

import { createCorrection } from '../events';
import type { EntryView } from '../types';
import { validateCorrection } from '../validation';
import {
  confirmWarnings,
  formatDate,
  formatMinutes,
  formatWhen,
  h,
  messages,
  milestoneName,
  projectName,
  type AppContext,
} from './dom';

// Kept between screen refreshes.
const filter = { project: '', milestone: '', from: '', to: '' };
let correctingId = '';

export function historyView(ctx: AppContext): HTMLElement {
  const { state } = ctx;
  const shown = state.entries.filter((v) => {
    const date = v.entry.start.slice(0, 10);
    return (
      (!filter.project || v.entry.project_id === filter.project) &&
      (!filter.milestone || v.entry.milestone_id === filter.milestone) &&
      (!filter.from || date >= filter.from) &&
      (!filter.to || date <= filter.to)
    );
  });
  const total = shown.reduce((sum, v) => sum + v.effective_minutes, 0);
  const refresh = () => ctx.goTo('history');

  const projectSelect = h(
    'select',
    { value: filter.project, onchange: () => ((filter.project = projectSelect.value), (filter.milestone = ''), refresh()) },
    h('option', { value: '' }, 'All projects'),
    ...state.projects.map((p) => h('option', { value: p.project_id }, p.name)),
  );
  const milestoneSelect = h(
    'select',
    { value: filter.milestone, onchange: () => ((filter.milestone = milestoneSelect.value), refresh()) },
    h('option', { value: '' }, 'All milestones'),
    ...state.milestones
      .filter((m) => !filter.project || m.project_id === filter.project)
      .map((m) => h('option', { value: m.milestone_id }, m.name)),
  );
  const fromInput = h('input', { type: 'date', value: filter.from, onchange: () => ((filter.from = fromInput.value), refresh()) });
  const toInput = h('input', { type: 'date', value: filter.to, onchange: () => ((filter.to = toInput.value), refresh()) });

  return h(
    'div',
    {},
    h(
      'details',
      { class: 'card', open: !!(filter.project || filter.milestone || filter.from || filter.to) },
      h('summary', {}, 'Filter'),
      h('label', {}, 'Project', projectSelect),
      h('label', {}, 'Milestone', milestoneSelect),
      h('div', { class: 'row' }, h('label', {}, 'From', fromInput), h('label', {}, 'To', toInput)),
      h(
        'button',
        { onclick: () => (Object.assign(filter, { project: '', milestone: '', from: '', to: '' }), refresh()) },
        'Clear filter',
      ),
    ),
    h('p', { class: 'summary' }, `${shown.length} ${shown.length === 1 ? 'entry' : 'entries'} · ${formatMinutes(total)}`),
    shown.length === 0 && h('p', { class: 'muted' }, 'No entries yet.'),
    ...shown.map((v) => entryCard(ctx, v)),
  );
}

function entryCard(ctx: AppContext, v: EntryView): HTMLElement {
  const { state } = ctx;
  const e = v.entry;
  const corrected = v.corrections.length > 0;

  return h(
    'section',
    { class: 'card entry' },
    h(
      'div',
      { class: 'entry-head' },
      h('strong', {}, formatMinutes(v.effective_minutes)),
      corrected && h('span', { class: 'muted strike' }, formatMinutes(e.duration_minutes)),
      h('span', { class: 'badge' }, e.device),
    ),
    h('div', {}, projectName(state, e.project_id), e.milestone_id ? ` › ${milestoneName(state, e.milestone_id)}` : ''),
    h('div', { class: 'muted' }, formatWhen(e)),
    e.note && h('div', { class: 'note' }, e.note),
    ...v.corrections.map((c) =>
      h(
        'div',
        { class: 'correction' },
        h('strong', {}, `Correction ${c.duration_minutes > 0 ? '+' : ''}${formatMinutes(c.duration_minutes)}`),
        ` · ${formatDate(c.created_at.slice(0, 10))} · ${c.device}`,
        h('br', {}),
        `Reason: ${c.note}`,
      ),
    ),
    correctingId === e.event_id
      ? correctionForm(ctx, v)
      : h('button', { class: 'link', onclick: () => ((correctingId = e.event_id), ctx.goTo('history')) }, 'Correct this entry'),
  );
}

function correctionForm(ctx: AppContext, v: EntryView): HTMLElement {
  const current = v.effective_minutes;
  const hours = h('input', { type: 'number', min: '0', step: '1', inputMode: 'numeric', value: String(Math.floor(current / 60)) });
  const minutes = h('input', { type: 'number', min: '0', max: '59', step: '5', inputMode: 'numeric', value: String(current % 60) });
  const reason = h('input', { type: 'text', placeholder: 'e.g. forgot to subtract lunch break' });
  const feedback = h('div', {});

  const save = async () => {
    const corrected = Math.round((hours.valueAsNumber || 0) * 60 + (minutes.valueAsNumber || 0));
    const check = validateCorrection(current, corrected, reason.value);
    if (check.errors.length) return feedback.replaceChildren(messages(check.errors));
    if (!confirmWarnings(check.warnings)) return;
    correctingId = '';
    await ctx.save(createCorrection(ctx.device, v, corrected, reason.value));
  };

  return h(
    'div',
    { class: 'correct-form' },
    h('p', { class: 'small' }, 'The original entry is kept. A correction is added next to it.'),
    h('div', { class: 'row' }, h('label', {}, 'Correct hours', hours), h('label', {}, 'Minutes', minutes)),
    h('label', {}, 'Reason (required)', reason),
    h(
      'p',
      { class: 'small muted' },
      'Logged to the wrong project? Correct this entry to 0 and add a new entry for the right project.',
    ),
    feedback,
    h(
      'div',
      { class: 'actions' },
      h('button', { class: 'primary', onclick: save }, 'Save correction'),
      h('button', { onclick: () => ((correctingId = ''), ctx.goTo('history')) }, 'Cancel'),
    ),
  );
}
