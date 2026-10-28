// Screen "Log time": add a time entry by hand.

import { createTimeEntry } from '../events';
import { localDate, validateManualEntry } from '../validation';
import { confirmWarnings, formatMinutes, formatWhen, h, messages, milestoneName, projectName, type AppContext } from './dom';
import { banner, divider } from './ornaments';

// Kept between screen refreshes.
let mode: 'times' | 'duration' = 'times';
let flash = '';

export function logView(ctx: AppContext): HTMLElement {
  const { state } = ctx;
  const projects = state.projects.filter((p) => p.status === 'active');

  if (projects.length === 0) return welcome(ctx);

  const projectSelect = h(
    'select',
    { value: projects.some((p) => p.project_id === ctx.lastProjectId) ? ctx.lastProjectId : projects[0].project_id },
    ...projects.map((p) => h('option', { value: p.project_id }, p.name)),
  );
  const milestoneSelect = h('select', {});
  function fillMilestones() {
    const options = state.milestones.filter((m) => m.project_id === projectSelect.value);
    milestoneSelect.replaceChildren(
      h('option', { value: '' }, '— no milestone —'),
      ...options.map((m) => h('option', { value: m.milestone_id }, m.status === 'done' ? `${m.name} (done)` : m.name)),
    );
    milestoneSelect.value = options.some((m) => m.milestone_id === ctx.lastMilestoneId) ? ctx.lastMilestoneId : '';
  }
  projectSelect.addEventListener('change', fillMilestones);
  fillMilestones();

  const today = localDate();
  const dateInput = h('input', { type: 'date', value: today, max: today });
  const startInput = h('input', { type: 'time' });
  const endInput = h('input', { type: 'time' });
  const hoursInput = h('input', { type: 'number', min: '0', step: '1', inputMode: 'numeric', placeholder: '0' });
  const minutesInput = h('input', { type: 'number', min: '0', max: '59', step: '5', inputMode: 'numeric', placeholder: '0' });
  const noteInput = h('textarea', { rows: 2, placeholder: 'Optional' });
  const feedback = h('div', {}, flash ? h('p', { class: 'msg success' }, flash) : null);
  flash = '';

  const timesFields = h(
    'div',
    { class: 'row' },
    h('label', {}, 'Start', startInput),
    h('label', {}, 'End', endInput),
  );
  const durationFields = h(
    'div',
    { class: 'row' },
    h('label', {}, 'Hours', hoursInput),
    h('label', {}, 'Minutes', minutesInput),
  );
  const timesButton = h('button', { type: 'button', onclick: () => setMode('times') }, 'Start & end');
  const durationButton = h('button', { type: 'button', onclick: () => setMode('duration') }, 'Duration');
  function setMode(m: typeof mode) {
    mode = m;
    timesFields.hidden = m !== 'times';
    durationFields.hidden = m !== 'duration';
    timesButton.classList.toggle('active', m === 'times');
    durationButton.classList.toggle('active', m === 'duration');
  }
  setMode(mode);

  async function save() {
    const check = validateManualEntry({
      mode,
      date: dateInput.value,
      startTime: startInput.value,
      endTime: endInput.value,
      hours: hoursInput.valueAsNumber,
      minutes: minutesInput.valueAsNumber,
    });
    if (check.errors.length) {
      feedback.replaceChildren(messages(check.errors));
      return;
    }
    if (!confirmWarnings(check.warnings)) return;

    const project_id = projectSelect.value;
    const milestone_id = milestoneSelect.value;
    ctx.rememberSelection(project_id, milestone_id);
    flash = `Saved ${formatMinutes(check.duration_minutes)} on ${projectName(state, project_id)}.`;
    await ctx.save(
      createTimeEntry(ctx.device, {
        project_id,
        milestone_id,
        start: check.start,
        end: check.end,
        duration_minutes: check.duration_minutes,
        note: noteInput.value,
      }),
    );
  }

  const recent = state.entries.slice(0, 3);
  return h(
    'div',
    {},
    banner('Record time'),
    h(
      'section',
      { class: 'card' },
      h('label', {}, 'Project', projectSelect),
      h('label', {}, 'Milestone', milestoneSelect),
      h('div', { class: 'segmented' }, timesButton, durationButton),
      h('label', {}, 'Date', dateInput),
      timesFields,
      durationFields,
      h('label', {}, 'Note', noteInput),
      feedback,
      h('button', { class: 'primary big', onclick: save }, 'Record'),
    ),
    recent.length > 0 &&
      h(
        'section',
        { class: 'card' },
        h('h3', { class: 'first' }, 'Latest entries'),
        ...recent.map((v) =>
          h(
            'p',
            { class: 'small' },
            h('strong', { class: 'num' }, formatMinutes(v.effective_minutes)),
            ` · ${projectName(state, v.entry.project_id)}`,
            v.entry.milestone_id ? ` › ${milestoneName(state, v.entry.milestone_id)}` : '',
            h('br', {}),
            h('span', { class: 'muted' }, formatWhen(v.entry)),
          ),
        ),
      ),
  );
}

/** First screen when there are no projects yet: the crest, the motto and one clear next step. */
function welcome(ctx: AppContext): HTMLElement {
  const base = import.meta.env.BASE_URL;
  return h(
    'section',
    { class: 'welcome' },
    h(
      'picture',
      {},
      h('source', { media: '(min-width: 720px)', srcset: `${base}crest-wide.webp` }),
      h('img', { src: `${base}crest.webp`, alt: 'Coat of arms with flame, fox and shield' }),
    ),
    h('p', { class: 'motto' }, 'SOLUS NON SOLUM'),
    divider(),
    h('p', {}, 'Begin by creating your first project, for example "WP-Examen".'),
    h('button', { class: 'primary big', onclick: () => ctx.goTo('projects') }, 'Create a project'),
  );
}
