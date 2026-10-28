// Starts the app: loads the data, shows the header, the current screen and the bottom tabs.

// Fonts are bundled with the app so they also work offline (Latin letters only, incl. ä ö ü ß).
import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-600.css';
import './style.css';
import { currentAccount, initAuth } from './auth';
import { enableSync, loadSyncSettings, onSyncChange, requestSync, statusText, sync } from './sync/controller';
import { appendEvents, countPending, getAllEvents, getSetting, requestPersistentStorage, setSetting } from './db';
import { buildState } from './state';
import { elapsedMs, formatClock, isLongRunning, loadTimer, saveTimer } from './timer';
import type { AppEvent } from './types';
import { accountView } from './ui/accountView';
import { h, type AppContext } from './ui/dom';
import { historyView } from './ui/historyView';
import { logView } from './ui/logView';
import { flame, seal, shield, star } from './ui/ornaments';
import { projectsView } from './ui/projectsView';

type Tab = 'log' | 'projects' | 'history' | 'account';
const TABS: { id: Tab; label: string; icon: () => Element; view: (ctx: AppContext) => HTMLElement }[] = [
  { id: 'log', label: 'Record', icon: () => flame(), view: logView },
  { id: 'projects', label: 'Projects', icon: () => shield(), view: projectsView },
  { id: 'history', label: 'History', icon: () => star(), view: historyView },
  { id: 'account', label: 'Account', icon: () => seal(), view: accountView },
];

// Which kind of device this is. It is written into every event ("phone" or "computer").
const device = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'phone' : 'computer';

const ctx: AppContext = {
  state: buildState([]),
  device,
  pendingCount: 0,
  reloadData: () => reload(),
  lastProjectId: '',
  lastMilestoneId: '',
  async save(events: AppEvent[]) {
    if (events.length === 0) return true;
    let saved = true;
    try {
      await appendEvents(events);
    } catch (err) {
      alert(`Sorry, this could not be saved on this device.\n\n${err}`);
      saved = false;
    }
    await reload();
    requestSync(); // saved on the device first; copied to Excel in the background
    return saved;
  },
  timer: null,
  async setTimer(timer) {
    await saveTimer(timer);
    ctx.timer = timer;
    render();
  },
  async setTimerQuietly(timer) {
    await saveTimer(timer);
    ctx.timer = timer;
  },
  rememberSelection(projectId, milestoneId) {
    ctx.lastProjectId = projectId;
    ctx.lastMilestoneId = milestoneId;
    setSetting('lastSelection', { projectId, milestoneId });
  },
  goTo(tab) {
    if (location.hash !== `#${tab}`) location.hash = tab; // triggers render via 'hashchange'
    else render();
  },
  rerender: () => render(),
};

function currentTab(): Tab {
  const tab = location.hash.slice(1) as Tab;
  return TABS.some((t) => t.id === tab) ? tab : 'log';
}

/** The line under the title: the running timer (if any) and the sync status. */
function headerStatus(): string {
  const sync = statusText(ctx.pendingCount);
  if (!ctx.timer) return sync;
  const long = isLongRunning(ctx.timer) && !ctx.timer.long_warning_dismissed;
  return `Timer ${formatClock(elapsedMs(ctx.timer))}${long ? ' – still running? See Record' : ''} · ${sync}`;
}

function render() {
  const tab = currentTab();
  const view = TABS.find((t) => t.id === tab)!.view(ctx);
  document.querySelector('#app')!.replaceChildren(
    h(
      'header',
      {},
      h(
        'div',
        { class: 'header-inner' },
        flame(ctx.timer ? 'icon burning' : 'icon'), // the flame glows while the timer runs
        h('div', {}, h('h1', {}, 'Time Tracker'), h('p', { class: 'status' }, headerStatus())),
      ),
    ),
    h('main', {}, view),
    h(
      'nav',
      {},
      h(
        'div',
        { class: 'nav-inner' },
        ...TABS.map((t) => h('a', { href: `#${t.id}`, class: t.id === tab ? 'active' : '' }, t.icon(), t.label)),
      ),
    ),
  );
}

async function loadData() {
  ctx.state = buildState(await getAllEvents());
  ctx.pendingCount = await countPending();
}

async function reload() {
  await loadData();
  render();
}

/**
 * After a sync: load what arrived from the other device, and update the status line.
 * The rest of the screen is only redrawn on the Account tab – never while you might be typing.
 */
async function afterSyncChange() {
  await loadData();
  if (currentTab() === 'account') render();
  else updateLiveText();
}

/** Updates only the ticking clock and the status line – nothing you might be typing in. */
function updateLiveText() {
  const status = document.querySelector('header .status');
  if (status) status.textContent = headerStatus();
  if (ctx.timer) {
    const clock = formatClock(elapsedMs(ctx.timer));
    document.querySelectorAll('[data-clock]').forEach((el) => (el.textContent = clock));
  }
}

async function start() {
  requestPersistentStorage();
  const last = await getSetting<{ projectId: string; milestoneId: string }>('lastSelection');
  ctx.lastProjectId = last?.projectId ?? '';
  ctx.lastMilestoneId = last?.milestoneId ?? '';
  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo(0, 0);
  });
  await loadSyncSettings();
  ctx.timer = await loadTimer();
  onSyncChange(() => void afterSyncChange());
  await reload(); // show the app first – it never waits for Microsoft
  setInterval(() => ctx.timer && updateLiveText(), 1000); // the timer's clock ticks every second

  // Then sign-in: finishes a sign-in if we just came back from Microsoft's page.
  try {
    await initAuth();
  } catch (err) {
    console.warn('Microsoft sign-in could not start', err);
  }
  // A device with nothing on it (e.g. a new phone) can start syncing right away.
  if (currentAccount() && !sync.enabled && ctx.pendingCount === 0) await enableSync();
  render();

  window.addEventListener('online', () => void requestSync());
  window.addEventListener('offline', () => void afterSyncChange());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    // App reopened from the background: show the 8-hour question if it is due, and sync.
    if (ctx.timer && currentTab() === 'log' && isLongRunning(ctx.timer) && !document.querySelector('main :focus')) render();
    void requestSync();
  });
  await requestSync();
}

start();
