// The sync rules (SPEC.md "Sync"). Works the same with the real OneDrive and with the pretend
// OneDrive used by the automated tests, because both are passed in from outside.
//
// One sync:
//  1. download timetracker.xlsx (or start a new one if it doesn't exist yet)
//  2. check every existing row is unchanged (fingerprint chain) – if not: STOP, upload nothing
//  3. skip events that are already in the file (safe to repeat)
//  4. append the rest with seq + fingerprints, rebuild Projects/Milestones
//  5. back up the previous version, then upload "only if nobody changed the file meanwhile"
//     (if somebody did: start again from 1)
//  6. mark this device's events as synced and bring the other device's events onto this device

import { buildState } from '../state';
import type { AppEvent, ChangeEvent, TimeEntryEvent } from '../types';
import { rowHash } from './hash';
import {
  appendLogRows,
  columnsOf,
  loadWorkbook,
  LOG_SHEETS,
  newWorkbook,
  protectLogSheets,
  readLog,
  workbookBytes,
  writeOverviewSheets,
  type LogSheet,
  type Row,
} from './workbook';

// ----- What the engine needs from outside -----

/** The Excel file in OneDrive (or the pretend one in the tests). */
export interface FileStore {
  download(): Promise<{ bytes: Uint8Array; etag: string } | null>;
  /** Uploads only if the file still has this etag (null = only if the file doesn't exist yet). */
  upload(bytes: Uint8Array, etag: string | null): Promise<void>;
  saveBackup(name: string, bytes: Uint8Array): Promise<void>;
  listBackups(): Promise<{ id: string; name: string }[]>;
  deleteBackup(id: string): Promise<void>;
}
/** The file was changed by the other device after we downloaded it. */
export class FileChangedError extends Error {}
/** The file is locked, usually because it is open in desktop Excel. */
export class FileLockedError extends Error {}

/** The database on this device. */
export interface LocalStore {
  pendingEvents(): Promise<AppEvent[]>;
  markSynced(eventIds: string[]): Promise<void>;
  importSyncedEvents(events: AppEvent[]): Promise<void>;
  getLastSeen(): Promise<LastSeen | undefined>;
  setLastSeen(lastSeen: LastSeen): Promise<void>;
}

/** What this device saw at the end of its last sync – used to notice rows removed at the end. */
export type LastSeen = Record<LogSheet, { count: number; hash: string }>;

export interface Problem {
  sheet: string;
  row: number; // Excel row number (row 1 = headings); 0 = the whole sheet/file
  message: string;
}

export type SyncResult =
  | { status: 'ok'; uploaded: number; received: number }
  | { status: 'tampered'; problems: Problem[] }
  | { status: 'locked' }
  | { status: 'busy' };

export const BACKUPS_TO_KEEP = 30;
const MAX_ATTEMPTS = 6;

// ----- Checking the file ("Verify data") -----

export interface CheckedFile {
  problems: Problem[];
  rows: Record<LogSheet, Row[]>;
}

export async function verifyWorkbook(wb: Awaited<ReturnType<typeof loadWorkbook>>, lastSeen?: LastSeen): Promise<CheckedFile> {
  const problems: Problem[] = [];
  const rows = { Entries: [] as Row[], ChangeLog: [] as Row[] };

  for (const sheet of LOG_SHEETS) {
    const log = readLog(wb, sheet);
    if (!log) {
      problems.push({ sheet, row: 0, message: `The sheet "${sheet}" is missing.` });
      continue;
    }
    const columns = columnsOf(sheet);
    if (log.header.join('|') !== columns.join('|')) {
      problems.push({ sheet, row: 1, message: 'The column headings were changed.' });
    }
    let prevHash = '';
    let prevSeq = 0;
    for (let i = 0; i < log.rows.length; i++) {
      const r = log.rows[i];
      const row = log.rowNumbers[i];
      if (r.seq !== String(prevSeq + 1)) {
        problems.push({ sheet, row, message: `Row number (seq) is "${r.seq}", expected ${prevSeq + 1}: a row was removed, inserted or renumbered.` });
      }
      if (r.prev_hash !== prevHash) {
        problems.push({ sheet, row, message: 'The link to the row above is broken: the row above was changed or removed.' });
      }
      if ((await rowHash(columns.slice(0, -1).map((c) => r[c]))) !== r.row_hash) {
        problems.push({ sheet, row, message: 'The content of this row was changed.' });
      }
      prevHash = r.row_hash;
      prevSeq = Number(r.seq) || prevSeq + 1;
    }
    const seen = lastSeen?.[sheet];
    if (seen && seen.count > 0) {
      if (log.rows.length < seen.count) {
        problems.push({ sheet, row: 0, message: `Rows were removed: this device last saw ${seen.count} rows, now there are ${log.rows.length}.` });
      } else if (log.rows[seen.count - 1].row_hash !== seen.hash) {
        problems.push({ sheet, row: log.rowNumbers[seen.count - 1], message: 'This row differs from what this device saw at its last sync.' });
      }
    }
    rows[sheet] = log.rows;
  }
  return { problems, rows };
}

// ----- Turning events into rows and back -----

const sheetOf = (e: AppEvent): LogSheet => (e.kind === 'entry' ? 'Entries' : 'ChangeLog');

function eventToRow(e: AppEvent, syncedAt: string): Row {
  if (e.kind === 'entry') {
    return {
      event_id: e.event_id, device: e.device, created_at: e.created_at, project_id: e.project_id,
      milestone_id: e.milestone_id, start: e.start, end: e.end, duration_minutes: String(e.duration_minutes),
      note: e.note, entry_type: e.entry_type, corrects_event_id: e.corrects_event_id, synced_at: syncedAt,
    };
  }
  return {
    event_id: e.event_id, device: e.device, created_at: e.created_at, action: e.action,
    record_id: e.record_id, field: e.field, old_value: e.old_value, new_value: e.new_value,
  };
}

export function rowToEvent(sheet: LogSheet, r: Row): AppEvent {
  if (sheet === 'Entries') {
    const e: TimeEntryEvent = {
      kind: 'entry', event_id: r.event_id, device: r.device, created_at: r.created_at, project_id: r.project_id,
      milestone_id: r.milestone_id, start: r.start, end: r.end, duration_minutes: Number(r.duration_minutes) || 0,
      note: r.note, entry_type: r.entry_type === 'correction' ? 'correction' : 'normal', corrects_event_id: r.corrects_event_id,
    };
    return e;
  }
  const e: ChangeEvent = {
    kind: 'change', event_id: r.event_id, device: r.device, created_at: r.created_at,
    action: r.action as ChangeEvent['action'], record_id: r.record_id, field: r.field,
    old_value: r.old_value, new_value: r.new_value,
  };
  return e;
}

/** Gives new rows their seq and fingerprints, continuing the chain of the rows already there. */
async function chainRows(existing: Row[], events: AppEvent[], sheet: LogSheet, syncedAt: string): Promise<Row[]> {
  const columns = columnsOf(sheet);
  let seq = existing.length;
  let prevHash = existing.at(-1)?.row_hash ?? '';
  const added: Row[] = [];
  for (const e of events) {
    const r: Row = { ...eventToRow(e, syncedAt), seq: String(++seq), prev_hash: prevHash };
    r.row_hash = await rowHash(columns.slice(0, -1).map((c) => r[c] ?? ''));
    prevHash = r.row_hash;
    added.push(r);
  }
  return added;
}

const byCreation = (a: AppEvent, b: AppEvent) =>
  a.created_at === b.created_at ? (a.event_id < b.event_id ? -1 : 1) : a.created_at < b.created_at ? -1 : 1;

function lastSeenOf(rows: Record<LogSheet, Row[]>): LastSeen {
  return {
    Entries: { count: rows.Entries.length, hash: rows.Entries.at(-1)?.row_hash ?? '' },
    ChangeLog: { count: rows.ChangeLog.length, hash: rows.ChangeLog.at(-1)?.row_hash ?? '' },
  };
}

// ----- One complete sync -----

export async function runSync(
  store: FileStore,
  local: LocalStore,
  opts: { now?: () => Date; wait?: (ms: number) => Promise<void> } = {},
): Promise<SyncResult> {
  const now = opts.now ?? (() => new Date());
  const wait = opts.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  for (let attempt = 1; ; attempt++) {
    // 1. Download
    const file = await store.download();
    const lastSeen = await local.getLastSeen();
    if (!file && lastSeen && (lastSeen.Entries.count > 0 || lastSeen.ChangeLog.count > 0)) {
      return {
        status: 'tampered',
        problems: [{ sheet: 'timetracker.xlsx', row: 0, message: 'The Excel file is missing, but this device has synced with it before.' }],
      };
    }
    const wb = file ? await loadWorkbook(file.bytes) : newWorkbook();

    // 2. Check every existing row
    const checked = await verifyWorkbook(wb, file ? lastSeen : undefined);
    if (checked.problems.length > 0) return { status: 'tampered', problems: checked.problems };
    const fileEvents = LOG_SHEETS.flatMap((s) => checked.rows[s].map((r) => rowToEvent(s, r)));

    // 3. Skip what is already in the file
    const inFile = new Set(fileEvents.map((e) => e.event_id));
    const pending = await local.pendingEvents();
    const toAdd = pending.filter((e) => !inFile.has(e.event_id)).sort(byCreation);

    const finalRows = { ...checked.rows };
    if (toAdd.length > 0 || !file) {
      // 4. Append + rebuild the overview sheets
      const syncedAt = now().toISOString();
      for (const sheet of LOG_SHEETS) {
        const added = await chainRows(checked.rows[sheet], toAdd.filter((e) => sheetOf(e) === sheet), sheet, syncedAt);
        appendLogRows(wb, sheet, added);
        finalRows[sheet] = [...checked.rows[sheet], ...added];
      }
      writeOverviewSheets(wb, buildState([...fileEvents, ...toAdd]));
      await protectLogSheets(wb);
      const bytes = await workbookBytes(wb);

      // 5. Back up the previous version, then upload only if unchanged meanwhile
      if (file) await saveBackup(store, file.bytes, now());
      try {
        await store.upload(bytes, file?.etag ?? null);
      } catch (err) {
        if (err instanceof FileLockedError) return { status: 'locked' };
        if (err instanceof FileChangedError) {
          if (attempt >= MAX_ATTEMPTS) return { status: 'busy' };
          await wait(400 * attempt + Math.random() * 400); // the other device is syncing: try again shortly
          continue;
        }
        throw err;
      }
    }

    // 6. Done: mark as synced, bring in the other device's events
    await local.markSynced(pending.map((e) => e.event_id));
    await local.importSyncedEvents(fileEvents);
    await local.setLastSeen(lastSeenOf(finalRows));
    return { status: 'ok', uploaded: toAdd.length, received: fileEvents.filter((e) => !pending.some((p) => p.event_id === e.event_id)).length };
  }
}

/** Keeps a copy of the previous file in backups/ and deletes the oldest copies beyond 30. */
async function saveBackup(store: FileStore, bytes: Uint8Array, when: Date) {
  const stamp = when.toISOString().replace(/[:.]/g, '-'); // OneDrive does not allow ":" in names
  await store.saveBackup(`timetracker-${stamp}.xlsx`, bytes);
  const backups = (await store.listBackups()).sort((a, b) => a.name.localeCompare(b.name));
  for (const old of backups.slice(0, Math.max(0, backups.length - BACKUPS_TO_KEEP))) {
    await store.deleteBackup(old.id);
  }
}

/** "Verify data": downloads the file and checks the whole chain without changing anything. */
export async function verifyFile(store: FileStore, lastSeen?: LastSeen) {
  const file = await store.download();
  if (!file) return { exists: false, problems: [] as Problem[], counts: { Entries: 0, ChangeLog: 0 } };
  const checked = await verifyWorkbook(await loadWorkbook(file.bytes), lastSeen);
  return {
    exists: true,
    problems: checked.problems,
    counts: { Entries: checked.rows.Entries.length, ChangeLog: checked.rows.ChangeLog.length },
  };
}
