// Decides WHEN to sync and keeps track of how the last sync went (for the header and Account tab).
// Syncs on app start, after every new entry, when the internet comes back, when the app is
// reopened, and on "Sync now". Problems are retried every minute; entries are never lost.

import { currentAccount, SignInRequiredError } from '../auth';
import { getPendingEvents, getSetting, importSyncedEvents, markSynced, setSetting } from '../db';
import type { LastSeen, LocalStore, SyncResult } from './engine';

export const sync = {
  enabled: false, // switched on by the owner's choice on the Account tab (or automatically on a new device)
  running: false,
  result: null as SyncResult | null, // how the last sync ended
  error: '', // plain-language problem of the last sync ('' = none)
  signInNeeded: false,
  lastSyncedAt: '',
};

let onChange = () => {};
/** The app redraws (and reloads data the sync may have brought in) whenever the sync status changes. */
export function onSyncChange(callback: () => void) {
  onChange = callback;
}

const local: LocalStore = {
  pendingEvents: getPendingEvents,
  markSynced,
  importSyncedEvents,
  getLastSeen: () => getSetting<LastSeen>('lastSeen'),
  setLastSeen: (lastSeen) => setSetting('lastSeen', lastSeen),
};

// The Excel code is large, so it is only loaded when it is first needed.
const loadSyncCode = () => Promise.all([import('./engine'), import('./onedrive')]);

export async function loadSyncSettings() {
  sync.enabled = (await getSetting<boolean>('syncEnabled')) ?? false;
  sync.lastSyncedAt = (await getSetting<string>('lastSyncedAt')) ?? '';
}

export async function enableSync() {
  await setSetting('syncEnabled', true);
  sync.enabled = true;
  await requestSync();
}

let runAgain = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

export async function requestSync(): Promise<void> {
  if (!sync.enabled || !currentAccount() || !navigator.onLine) return onChange();
  if (sync.running) {
    runAgain = true; // something new happened during this sync: sync once more afterwards
    return;
  }
  clearTimeout(retryTimer);
  sync.running = true;
  onChange();
  try {
    const [{ runSync }, { OneDriveFile }] = await loadSyncCode();
    sync.result = await runSync(new OneDriveFile(), local);
    sync.error = '';
    sync.signInNeeded = false;
    if (sync.result.status === 'ok') {
      sync.lastSyncedAt = new Date().toISOString();
      await setSetting('lastSyncedAt', sync.lastSyncedAt);
    }
  } catch (err) {
    sync.result = null;
    sync.signInNeeded = err instanceof SignInRequiredError;
    sync.error = err instanceof Error ? err.message : String(err);
  } finally {
    sync.running = false;
  }
  onChange();

  if (runAgain) {
    runAgain = false;
    await requestSync();
  } else if ((sync.error && !sync.signInNeeded) || sync.result?.status === 'locked' || sync.result?.status === 'busy') {
    retryTimer = setTimeout(requestSync, 60_000);
  }
}

/** "Verify data": checks the whole Excel file without changing anything. */
export async function verifyNow() {
  const [{ verifyFile }, { OneDriveFile }] = await loadSyncCode();
  return verifyFile(new OneDriveFile(), await getSetting<LastSeen>('lastSeen'));
}

/** The one-line status shown under the app title. */
export function statusText(pending: number): string {
  const waiting = pending === 1 ? '1 entry waiting to sync' : `${pending} entries waiting to sync`;
  if (!navigator.onLine) return pending ? `Offline – ${waiting}` : 'Offline – everything is saved';
  if (!currentAccount()) return pending ? `Not signed in – ${waiting}` : 'Not signed in';
  if (!sync.enabled) return 'Syncing not started yet – see Account';
  if (sync.signInNeeded) return `Please sign in again on the Account tab${pending ? ` – ${waiting}` : ''}`;
  if (sync.running) return 'Syncing…';
  if (sync.result?.status === 'tampered') return 'Sync stopped: the Excel file was changed. See Account.';
  if (sync.result?.status === 'locked') {
    return 'Please close timetracker.xlsx in Excel – your entries are safe and will sync automatically.';
  }
  if (sync.result?.status === 'busy') return `The other device is syncing – trying again shortly. ${pending ? waiting : ''}`.trim();
  if (sync.error) return `${sync.error} ${pending ? `${waiting}, retrying every minute.` : ''}`.trim();
  return pending === 0 ? 'All synced' : waiting;
}
