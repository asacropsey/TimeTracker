// The app's own pop-up boxes (instead of the browser's plain alert / confirm / prompt),
// styled like the rest of the app, with big buttons for one thumb.

import { h } from './dom';

interface DialogOptions {
  title?: string;
  message: string;
  /** Show a text box, prefilled with this value. */
  input?: { value: string; inputMode?: 'text' | 'decimal' };
  ok: string;
  /** Leave out for a box with only one button. */
  cancel?: string;
  /** The OK button does something that can't be undone (shown in ember instead of gold). */
  danger?: boolean;
}

/** Shows a pop-up and waits. Resolves with the typed text (or '' without a text box), or null if cancelled. */
function showDialog(opts: DialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const input = opts.input
      ? h('input', { type: 'text', value: opts.input.value, inputMode: opts.input.inputMode ?? 'text', autocomplete: 'off' })
      : null;
    const okButton = h('button', { type: 'submit', class: opts.danger ? 'primary danger' : 'primary', value: 'ok' }, opts.ok);
    const cancelButton = opts.cancel ? h('button', { type: 'button', class: 'cancel' }, opts.cancel) : null;
    const form = h(
      'form',
      { method: 'dialog' },
      opts.title && h('h2', {}, opts.title),
      ...opts.message.split('\n\n').map((paragraph) => h('p', {}, paragraph)),
      input,
      h('div', { class: 'dialog-buttons' }, cancelButton, okButton),
    );
    const dialog = h('dialog', { class: 'app-dialog' }, form);

    let answered = false;
    const finish = (value: string | null) => {
      if (answered) return;
      answered = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      finish(input ? input.value : '');
    });
    cancelButton?.addEventListener('click', () => finish(null));
    dialog.addEventListener('cancel', (e) => {
      // The phone's back gesture or the Esc key: same as Cancel (or OK, if there is no Cancel).
      e.preventDefault();
      finish(opts.cancel ? null : '');
    });

    document.body.append(dialog);
    dialog.showModal();
    if (input) {
      input.focus();
      input.select();
    } else okButton.focus();
  });
}

/** A message with one OK button. */
export async function tell(message: string, title?: string): Promise<void> {
  await showDialog({ title, message, ok: 'OK' });
}

/** A yes/no question. Resolves true if the user chose `ok`. */
export async function askYesNo(message: string, ok = 'OK', cancel = 'Cancel', danger = false): Promise<boolean> {
  return (await showDialog({ message, ok, cancel, danger })) !== null;
}

/** Asks for a text. Resolves with the trimmed answer, or null if cancelled or unchanged. */
export async function askText(question: string, current: string, inputMode: 'text' | 'decimal' = 'text'): Promise<string | null> {
  const answer = await showDialog({ message: question, input: { value: current, inputMode }, ok: 'Save', cancel: 'Cancel' });
  return answer === null || answer.trim() === current ? null : answer.trim();
}

/** Asks the user to confirm warnings (e.g. "longer than 10 hours"). True if there are none or the user agrees. */
export async function confirmWarnings(warnings: string[]): Promise<boolean> {
  return warnings.length === 0 || askYesNo(`${warnings.join('\n\n')}\n\nSave anyway?`, 'Save anyway', 'Go back');
}
