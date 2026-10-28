// Screen "Record time": the timer (Begin / Rest) and, folded below it, adding time by hand.

import { createTimeEntry } from '../events';
import { elapsedMs, finishTimer, formatClock, isLongRunning, type RunningTimer } from '../timer';
import { localDate, localDateTime, validateManualEntry } from '../validation';
import { confirmWarnings, formatMinutes, formatWhen, h, messages, milestoneName, projectName, type AppContext } from './dom';
import { banner, divider, flame } from './ornaments';

// Kept between screen refreshes.
let mode: 'times' | 'duration' = 'times';
let flash = '';
let manualOpen = false;
let choosingStopTime = false;

export function logView(ctx: AppContext): HTMLElement {
  const { state } = ctx;
  if (!state.projects.some((p) => p.status === 'active') && !ctx.timer) return welcome(ctx);

  const message = flash ? h('p', { class: 'msg success' }, flash) : null;
  flash = '';
  const recent = state.entries.slice(0, 3);

  return h(
    'div',
    {},
    banner('Record time'),
    message,
    ctx.timer ? runningCard(ctx, ctx.timer) : beginCard(ctx),
    state.projects.some((p) => p.status === 'active') && manualCard(ctx),
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
            h('span', { class: 'muted num' }, formatWhen(v.entry)),
          ),
        ),
      ),
  );
}

/** Project + milestone dropdowns, preselected with the last used ones. */
function projectPicker(ctx: AppContext) {
  const { state } = ctx;
  const projects = state.projects.filter((p) => p.status === 'active');
  const projectSelect = h(
    'select',
    { value: projects.some((p) => p.project_id === ctx.lastProjectId) ? ctx.lastProjectId : projects[0]?.project_id },
    ...projects.map((p) => h('option', { value: p.project_id }, p.name)),
  );
  const milestoneSelect = h('select', {});
  const fillMilestones = () => {
    const options = state.milestones.filter((m) => m.project_id === projectSelect.value);
    milestoneSelect.replaceChildren(
      h('option', { value: '' }, '— no milestone —'),
      ...options.map((m) => h('option', { value: m.milestone_id }, m.status === 'done' ? `${m.name} (done)` : m.name)),
    );
    milestoneSelect.value = options.some((m) => m.milestone_id === ctx.lastMilestoneId) ? ctx.lastMilestoneId : '';
  };
  projectSelect.addEventListener('change', fillMilestones);
  fillMilestones();
  const fields = [h('label', {}, 'Project', projectSelect), h('label', {}, 'Milestone', milestoneSelect)];
  return { fields, projectSelect, milestoneSelect };
}

// ----- Timer -----

function beginCard(ctx: AppContext): HTMLElement {
  const picker = projectPicker(ctx);
  const begin = () => {
    ctx.rememberSelection(picker.projectSelect.value, picker.milestoneSelect.value);
    choosingStopTime = false;
    return ctx.setTimer({
      started_at: new Date().toISOString(),
      project_id: picker.projectSelect.value,
      milestone_id: picker.milestoneSelect.value,
      note: '',
      long_warning_dismissed: false,
    });
  };
  return h(
    'section',
    { class: 'card timer' },
    ...picker.fields,
    h('button', { class: 'primary big begin', onclick: begin }, flame(), 'Begin'),
  );
}

function runningCard(ctx: AppContext, timer: RunningTimer): HTMLElement {
  const { state } = ctx;
  const feedback = h('div', {});
  const note = h('textarea', { rows: 2, placeholder: 'Optional', value: timer.note });
  // Keep the note with the timer, so it survives closing the app too.
  note.addEventListener('change', () => ctx.setTimerQuietly({ ...timer, note: note.value }));

  /** Ends the timer at `end` and saves it as an entry. */
  async function stop(end: Date) {
    const result = finishTimer(timer, end);
    if (result.errors.length) return feedback.replaceChildren(messages(result.errors));
    if (result.tooShort) {
      if (confirm('Less than a minute – too short to record.\n\nStop the timer without saving?')) await ctx.setTimer(null);
      return;
    }
    if (!confirmWarnings(result.warnings)) return;
    choosingStopTime = false;
    const saved = await ctx.save(
      createTimeEntry(ctx.device, {
        project_id: timer.project_id,
        milestone_id: timer.milestone_id,
        start: result.start,
        end: result.end,
        duration_minutes: result.duration_minutes,
        note: note.value,
      }),
    );
    // Only clear the timer once the entry is safely saved – if saving failed, nothing is lost.
    if (!saved) return;
    flash = `Recorded ${formatMinutes(result.duration_minutes)} on ${projectName(state, timer.project_id)}.`;
    await ctx.setTimer(null);
  }

  const begun = new Date(timer.started_at);
  const long = isLongRunning(timer) && !timer.long_warning_dismissed;
  const stopAt = h('input', {
    type: 'datetime-local',
    value: localDateTime(new Date()),
    min: localDateTime(begun),
    max: localDateTime(new Date()),
  });
  const chooser = h(
    'div',
    { class: 'stop-chooser' },
    h('label', {}, 'When did you actually stop?', stopAt),
    h('button', { class: 'primary', onclick: () => stop(new Date(stopAt.value)) }, 'Record until then'),
  );
  chooser.hidden = !choosingStopTime;

  return h(
    'section',
    { class: 'card timer running' },
    h('div', { class: 'timer-flame' }, flame('icon burning')),
    h('div', { class: 'clock num', 'data-clock': '' }, formatClock(elapsedMs(timer))),
    h(
      'p',
      { class: 'center' },
      projectName(state, timer.project_id),
      timer.milestone_id ? ` › ${milestoneName(state, timer.milestone_id)}` : '',
    ),
    h('p', { class: 'center small muted num' }, `Began ${begun.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`),
    long &&
      h(
        'div',
        { class: 'msg warning' },
        h('p', { class: 'first' }, `The timer has been running for ${formatMinutes(elapsedMs(timer) / 60000)}. Did you forget to stop it?`),
        h(
          'div',
          { class: 'actions' },
          h('button', { onclick: () => stop(new Date()) }, 'Stop now'),
          h('button', { onclick: () => ((choosingStopTime = true), (chooser.hidden = false)) }, 'Stop at a time I choose'),
          h('button', { onclick: () => ctx.setTimer({ ...timer, long_warning_dismissed: true }) }, 'Keep running'),
        ),
      ),
    chooser,
    h('label', {}, 'Note', note),
    feedback,
    h('button', { class: 'primary big', onclick: () => stop(new Date()) }, 'Rest'),
    !long &&
      h(
        'button',
        { class: 'link', onclick: () => ((choosingStopTime = !choosingStopTime), (chooser.hidden = !choosingStopTime)) },
        'Forgot to stop? Choose the end time',
      ),
  );
}

// ----- Adding time by hand -----

function manualCard(ctx: AppContext): HTMLElement {
  const { state } = ctx;
  const picker = projectPicker(ctx);
  const today = localDate();
  const dateInput = h('input', { type: 'date', value: today, max: today });
  const startInput = h('input', { type: 'time' });
  const endInput = h('input', { type: 'time' });
  const hoursInput = h('input', { type: 'number', min: '0', step: '1', inputMode: 'numeric', placeholder: '0' });
  const minutesInput = h('input', { type: 'number', min: '0', max: '59', step: '5', inputMode: 'numeric', placeholder: '0' });
  const noteInput = h('textarea', { rows: 2, placeholder: 'Optional' });
  const feedback = h('div', {});

  const timesFields = h('div', { class: 'row' }, h('label', {}, 'Start', startInput), h('label', {}, 'End', endInput));
  const durationFields = h('div', { class: 'row' }, h('label', {}, 'Hours', hoursInput), h('label', {}, 'Minutes', minutesInput));
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
    if (check.errors.length) return feedback.replaceChildren(messages(check.errors));
    if (!confirmWarnings(check.warnings)) return;

    const project_id = picker.projectSelect.value;
    const milestone_id = picker.milestoneSelect.value;
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

  const panel: HTMLDetailsElement = h(
    'details',
    { class: 'card', open: manualOpen, ontoggle: () => (manualOpen = panel.open) },
    h('summary', {}, 'Add time by hand'),
    ...picker.fields,
    h('div', { class: 'segmented' }, timesButton, durationButton),
    h('label', {}, 'Date', dateInput),
    timesFields,
    durationFields,
    h('label', {}, 'Note', noteInput),
    feedback,
    h('button', { class: 'primary big', onclick: save }, 'Record'),
  );
  return panel;
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
