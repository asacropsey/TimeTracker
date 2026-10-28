// Screen "Account": sign in with Microsoft, start syncing, "Sync now" and "Verify data".

import { currentAccount, isSignInConfigured, signIn, signOut } from '../auth';
import { startFresh } from '../db';
import { enableSync, requestSync, statusText, sync, verifyNow } from '../sync/controller';
import type { Problem } from '../sync/engine';
import { h, type AppContext } from './dom';
import { banner, divider, shield } from './ornaments';

// Result of the last "Verify data", kept between screen refreshes.
let verify: { running: boolean; text: string; problems: Problem[] } = { running: false, text: '', problems: [] };

export function accountView(ctx: AppContext): HTMLElement {
  const account = currentAccount();
  let body: (HTMLElement | false)[];
  if (!isSignInConfigured()) body = [h('section', { class: 'card' }, h('p', {}, 'Microsoft sign-in is not set up yet.'))];
  else if (!account) body = [signInScreen()];
  else body = [identityCard(ctx, account.name ?? '', account.username), sync.enabled ? syncCard(ctx) : firstSyncChoice(ctx)];

  return h(
    'div',
    {},
    banner('Account'),
    ...body,
    h('p', { class: 'small muted center' }, `This device is recorded as: ${ctx.device}`),
  );
}

/** Not signed in: the crest, the motto and one button. */
function signInScreen(): HTMLElement {
  const offline = !navigator.onLine;
  const start = () => signIn().catch((err) => alert(`Sign-in could not start.\n\n${err.message ?? err}`));
  return h(
    'section',
    { class: 'welcome' },
    h('img', { class: 'crest-small', src: `${import.meta.env.BASE_URL}crest.webp`, alt: 'Coat of arms with flame, fox and shield' }),
    h('p', { class: 'motto' }, 'SOLUS NON SOLUM'),
    divider(),
    h(
      'p',
      {},
      'Sign in with your personal Microsoft account so your entries can be kept safe in your OneDrive. ',
      'Until then, everything is saved on this device.',
    ),
    h('button', { class: 'primary big', onclick: start, disabled: offline }, 'Sign in with Microsoft'),
    offline && h('p', { class: 'small muted' }, 'You are offline. Connect to the internet to sign in.'),
  );
}

function identityCard(ctx: AppContext, name: string, email: string): HTMLElement {
  const leave = async () => {
    if (!confirm('Sign out on this device?\n\nYour entries stay saved on this device.')) return;
    await signOut();
    ctx.rerender();
  };
  return h(
    'section',
    { class: 'card' },
    h(
      'div',
      { class: 'project-title' },
      shield((name || email).charAt(0).toUpperCase()),
      h('div', {}, h('h2', {}, name || 'Signed in'), h('div', { class: 'small muted' }, email)),
    ),
    h(
      'div',
      { class: 'actions' },
      sync.signInNeeded && h('button', { class: 'primary', onclick: () => signIn() }, 'Sign in again'),
      h('button', { onclick: leave }, 'Sign out'),
    ),
  );
}

/** Before the first sync on this device: keep the existing entries, or start fresh? */
function firstSyncChoice(ctx: AppContext): HTMLElement {
  const count = ctx.pendingCount;
  const keep = () => enableSync();
  const fresh = async () => {
    const ok = confirm(
      `Erase all ${count} saved changes on this device (projects, milestones and entries)?\n\n` +
        'This cannot be undone. Use it only for test data. Afterwards this device starts syncing.',
    );
    if (!ok) return;
    await startFresh();
    await ctx.reloadData();
    await enableSync();
  };
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, 'Before the first sync'),
    h(
      'p',
      {},
      `This device holds ${count} saved ${count === 1 ? 'change' : 'changes'} (projects, milestones and entries). `,
      'When syncing starts, they become a permanent part of your Excel record.',
    ),
    h('p', { class: 'small muted' }, 'If they are only test data, start fresh. This choice is offered once, before the first sync.'),
    h('button', { class: 'primary big', onclick: keep }, 'Keep them and start syncing'),
    h('button', { class: 'big', onclick: fresh }, 'Start fresh (erase test data)'),
  );
}

function syncCard(ctx: AppContext): HTMLElement {
  const runVerify = async () => {
    verify = { running: true, text: 'Checking every row of the Excel file…', problems: [] };
    ctx.rerender();
    try {
      const result = await verifyNow();
      const rows = result.counts.Entries + result.counts.ChangeLog;
      verify = {
        running: false,
        problems: result.problems,
        text: !result.exists
          ? 'There is no Excel file yet. It is created at the first sync.'
          : result.problems.length === 0
            ? `All ${rows} rows are intact (${result.counts.Entries} entries, ${result.counts.ChangeLog} changes).`
            : `${result.problems.length} ${result.problems.length === 1 ? 'problem' : 'problems'} found:`,
      };
    } catch (err) {
      verify = { running: false, problems: [], text: err instanceof Error ? err.message : String(err) };
    }
    ctx.rerender();
  };

  const tampered = sync.result?.status === 'tampered' ? sync.result.problems : [];
  const status = statusText(ctx.pendingCount);
  const good = status === 'All synced';
  const offline = !navigator.onLine;

  return h(
    'section',
    { class: 'card' },
    h('h2', {}, 'Excel sync'),
    h('p', { class: good ? 'msg success' : sync.error || tampered.length ? 'msg error' : 'msg warning' }, status),
    sync.lastSyncedAt && h('p', { class: 'small muted num' }, `Last synced: ${new Date(sync.lastSyncedAt).toLocaleString('en-GB')}`),
    h('p', { class: 'small muted' }, 'File: OneDrive › Apps › Time Tracker › timetracker.xlsx'),
    tampered.length > 0 && problemList(tampered, true),
    h(
      'div',
      { class: 'actions' },
      h('button', { class: 'primary', onclick: () => requestSync(), disabled: sync.running || offline }, 'Sync now'),
      h('button', { onclick: runVerify, disabled: verify.running || offline }, 'Verify data'),
    ),
    verify.text && h('p', { class: verify.problems.length ? 'msg error' : 'msg success' }, verify.text),
    verify.problems.length > 0 && problemList(verify.problems, false),
  );
}

function problemList(problems: Problem[], explain: boolean): HTMLElement {
  return h(
    'div',
    { class: 'problems' },
    explain &&
      h(
        'p',
        { class: 'small' },
        'Syncing has stopped because rows in the Excel file were changed or removed. ',
        'Your new entries are safe on this device. To fix it, restore the previous version in OneDrive ',
        '(right-click timetracker.xlsx › Version history) – or ask for help before continuing.',
      ),
    h(
      'ul',
      {},
      ...problems.slice(0, 50).map((p) => h('li', {}, `${p.sheet}${p.row ? `, row ${p.row}` : ''}: ${p.message}`)),
    ),
    problems.length > 50 && h('p', { class: 'small muted' }, `…and ${problems.length - 50} more.`),
  );
}
