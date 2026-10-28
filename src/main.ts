// Starts the app: loads the data, shows the header, the current screen and the bottom tabs.

import './style.css';
import { appendEvents, countPending, getAllEvents, getSetting, requestPersistentStorage, setSetting } from './db';
import { buildState } from './state';
import type { AppEvent } from './types';
import { h, type AppContext } from './ui/dom';
import { historyView } from './ui/historyView';
import { logView } from './ui/logView';
import { projectsView } from './ui/projectsView';

type Tab = 'log' | 'projects' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'log', label: 'Log time' },
  { id: 'projects', label: 'Projects' },
  { id: 'history', label: 'History' },
];

// Which kind of device this is. It is written into every event ("phone" or "computer").
const device = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'phone' : 'computer';

let pending = 0;

const ctx: AppContext = {
  state: buildState([]),
  device,
  lastProjectId: '',
  lastMilestoneId: '',
  async save(events: AppEvent[]) {
    if (events.length === 0) return;
    try {
      await appendEvents(events);
    } catch (err) {
      alert(`Sorry, this could not be saved on this device.\n\n${err}`);
    }
    await reload();
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
};

function currentTab(): Tab {
  const tab = location.hash.slice(1) as Tab;
  return TABS.some((t) => t.id === tab) ? tab : 'log';
}

function syncStatus(): string {
  if (!navigator.onLine) return 'Offline – entries are saved on this device';
  // Syncing to Excel arrives in a later phase; until then everything stays on this device.
  return pending === 0 ? 'Nothing saved yet' : `${pending} changes saved on this device only (Excel sync comes later)`;
}

function render() {
  const tab = currentTab();
  const view = tab === 'log' ? logView(ctx) : tab === 'projects' ? projectsView(ctx) : historyView(ctx);
  document.querySelector('#app')!.replaceChildren(
    h('header', {}, h('h1', {}, 'Time Tracker'), h('p', { class: 'status' }, syncStatus())),
    h('main', {}, view),
    h(
      'nav',
      {},
      ...TABS.map((t) => h('a', { href: `#${t.id}`, class: t.id === tab ? 'active' : '' }, t.label)),
    ),
  );
}

async function reload() {
  ctx.state = buildState(await getAllEvents());
  pending = await countPending();
  render();
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
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  await reload();
}

start();
