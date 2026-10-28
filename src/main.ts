// Starts the app: loads the data, shows the header, the current screen and the bottom tabs.

// Fonts are bundled with the app so they also work offline (Latin letters only, incl. ä ö ü ß).
import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-600.css';
import './style.css';
import { initAuth } from './auth';
import { appendEvents, countPending, getAllEvents, getSetting, requestPersistentStorage, setSetting } from './db';
import { buildState } from './state';
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
  rerender: () => render(),
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
  const view = TABS.find((t) => t.id === tab)!.view(ctx);
  document.querySelector('#app')!.replaceChildren(
    h(
      'header',
      {},
      h(
        'div',
        { class: 'header-inner' },
        flame(),
        h('div', {}, h('h1', {}, 'Time Tracker'), h('p', { class: 'status' }, syncStatus())),
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
  await reload(); // show the app first – it never waits for Microsoft

  // Then sign-in: finishes a sign-in if we just came back from Microsoft's page.
  try {
    await initAuth();
  } catch (err) {
    console.warn('Microsoft sign-in could not start', err);
  }
  render();
}

start();
