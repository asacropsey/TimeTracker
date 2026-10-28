// Tests for syncing with Excel (SPEC.md "Sync" and "Immutability rules").
// Everything runs against a pretend OneDrive (tests/fakes.ts) – never the real file.

import { beforeEach, describe, expect, it } from 'vitest';
import { createCorrection, createMilestone, createProject, createTimeEntry } from '../src/events';
import { BACKUPS_TO_KEEP, runSync, verifyFile } from '../src/sync/engine';
import { loadWorkbook, readLog, workbookBytes } from '../src/sync/workbook';
import { buildState } from '../src/state';
import { FakeDevice, FakeOneDrive } from './fakes';

const noWait = { wait: async () => {} };
let drive: FakeOneDrive;
let phone: FakeDevice;
let computer: FakeDevice;

beforeEach(() => {
  drive = new FakeOneDrive();
  phone = new FakeDevice();
  computer = new FakeDevice();
});

function entry(device: string, minutes: number, projectId = 'p1') {
  return createTimeEntry(device, { project_id: projectId, milestone_id: '', start: '2026-10-27', end: '', duration_minutes: minutes, note: '' });
}

async function fileRows() {
  const wb = await loadWorkbook(drive.bytes!);
  return { entries: readLog(wb, 'Entries')!.rows, changes: readLog(wb, 'ChangeLog')!.rows, wb };
}

/** Changes one cell of the Excel file "by hand", like someone editing it in Excel. */
async function editCell(sheet: string, row: number, col: number, value: string | number) {
  const wb = await loadWorkbook(drive.bytes!);
  wb.getWorksheet(sheet)!.getRow(row).getCell(col).value = value;
  drive.bytes = await workbookBytes(wb);
  drive.etag++;
}

describe('first sync', () => {
  it('creates the file with all sheets, numbered rows and a valid chain', async () => {
    const project = createProject('computer', 'WP-Examen', 'Exam');
    computer.add([...project, ...entry('computer', 90), ...entry('computer', 30)]);

    expect(await runSync(drive, computer, noWait)).toMatchObject({ status: 'ok', uploaded: 4 });
    const { entries, changes, wb } = await fileRows();
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Info', 'Projects', 'Milestones', 'Entries', 'ChangeLog']);
    expect(entries.map((r) => r.seq)).toEqual(['1', '2']);
    expect(changes.map((r) => r.seq)).toEqual(['1', '2']);
    expect(entries[0].prev_hash).toBe('');
    expect(entries[1].prev_hash).toBe(entries[0].row_hash);
    expect(entries[0].synced_at).not.toBe('');
    expect(await computer.pendingEvents()).toEqual([]);
    expect((await verifyFile(drive)).problems).toEqual([]);
  });

  it('creates an empty file when there is nothing to sync yet', async () => {
    expect(await runSync(drive, computer, noWait)).toMatchObject({ status: 'ok', uploaded: 0 });
    expect(drive.bytes).not.toBeNull();
  });

  it('protects Entries and ChangeLog against accidental typing', async () => {
    computer.add(entry('computer', 10));
    await runSync(drive, computer, noWait);
    const { wb } = await fileRows();
    // (ExcelJS reads the protection setting but doesn't list it in its type definitions)
    const protection = (name: string) => (wb.getWorksheet(name) as unknown as { sheetProtection: unknown }).sheetProtection;
    expect(protection('Entries')).toMatchObject({ sheet: true });
    expect(protection('ChangeLog')).toMatchObject({ sheet: true });
  });

  it('fills the Projects and Milestones overview sheets', async () => {
    const project = createProject('computer', 'Roman', '');
    const pid = project[0].kind === 'change' ? project[0].record_id : '';
    computer.add([...project, ...createMilestone('computer', pid, 'Draft', 100, 1)]);
    await runSync(drive, computer, noWait);
    const { wb } = await fileRows();
    expect(wb.getWorksheet('Projects')!.getRow(2).getCell(2).value).toBe('Roman');
    expect(wb.getWorksheet('Milestones')!.getRow(2).getCell(3).value).toBe('Draft');
    expect(wb.getWorksheet('Milestones')!.getRow(2).getCell(4).value).toBe(100);
  });
});

describe('two devices', () => {
  it('end up with the same data, in one continuous chain', async () => {
    computer.add([...createProject('computer', 'WP-Examen', ''), ...entry('computer', 60)]);
    await runSync(drive, computer, noWait);
    phone.add(entry('phone', 45));
    expect(await runSync(drive, phone, noWait)).toMatchObject({ status: 'ok', uploaded: 1 });
    await runSync(drive, computer, noWait);

    expect([...phone.events.keys()].sort()).toEqual([...computer.events.keys()].sort());
    expect(buildState([...phone.events.values()]).minutesByProject.get('p1')).toBe(105);
    const { entries } = await fileRows();
    expect(entries.map((r) => [r.seq, r.device])).toEqual([['1', 'computer'], ['2', 'phone']]);
    expect((await verifyFile(drive)).problems).toEqual([]);
  });

  it('handle syncing at the same moment: one waits and retries, nothing is lost', async () => {
    computer.add(entry('computer', 60));
    phone.add(entry('phone', 45));
    // The computer sneaks in its upload while the phone is between download and upload.
    drive.beforeUpload = async () => {
      await runSync(drive, computer, noWait);
    };
    expect(await runSync(drive, phone, noWait)).toMatchObject({ status: 'ok' });
    const { entries } = await fileRows();
    expect(entries.map((r) => r.device).sort()).toEqual(['computer', 'phone']);
    expect(entries.map((r) => r.seq)).toEqual(['1', '2']);
    expect((await verifyFile(drive)).problems).toEqual([]);
  });

  it('give up politely (and keep everything) if the file keeps changing', async () => {
    computer.add(entry('computer', 60));
    await runSync(drive, computer, noWait); // the file exists
    phone.add(entry('phone', 45));
    let interruptions = 0;
    const interrupt = async () => {
      drive.etag++; // somebody else uploads every single time
      if (++interruptions < 20) drive.beforeUpload = interrupt;
    };
    drive.beforeUpload = interrupt;
    expect(await runSync(drive, phone, noWait)).toEqual({ status: 'busy' });
    expect(await phone.pendingEvents()).toHaveLength(1);
  });
});

describe('safe to repeat', () => {
  it('syncing twice adds nothing twice', async () => {
    computer.add(entry('computer', 60));
    await runSync(drive, computer, noWait);
    const uploads = drive.uploads;
    expect(await runSync(drive, computer, noWait)).toMatchObject({ status: 'ok', uploaded: 0 });
    expect(drive.uploads).toBe(uploads); // nothing new: no upload at all
    expect((await fileRows()).entries).toHaveLength(1);
  });

  it('upload arrived but the phone lost connection: the next sync does not add it again', async () => {
    phone.add(entry('phone', 45));
    drive.loseNextUploadResponse = true;
    await expect(runSync(drive, phone, noWait)).rejects.toThrow();
    expect(await phone.pendingEvents()).toHaveLength(1); // the phone doesn't know it worked

    expect(await runSync(drive, phone, noWait)).toMatchObject({ status: 'ok', uploaded: 0 });
    expect((await fileRows()).entries).toHaveLength(1);
    expect(await phone.pendingEvents()).toEqual([]);
  });
});

describe('offline and locked file', () => {
  it('offline: sync fails, the entry stays waiting, and goes up later', async () => {
    phone.add(entry('phone', 45));
    drive.offline = true;
    await expect(runSync(drive, phone, noWait)).rejects.toThrow();
    expect(await phone.pendingEvents()).toHaveLength(1);
    drive.offline = false;
    expect(await runSync(drive, phone, noWait)).toMatchObject({ status: 'ok', uploaded: 1 });
  });

  it('file open in Excel: reports "locked", keeps the entry, syncs after Excel is closed', async () => {
    computer.add(entry('computer', 60));
    await runSync(drive, computer, noWait);
    phone.add(entry('phone', 45));
    drive.locked = true;
    expect(await runSync(drive, phone, noWait)).toEqual({ status: 'locked' });
    expect(await phone.pendingEvents()).toHaveLength(1);
    drive.locked = false;
    expect(await runSync(drive, phone, noWait)).toMatchObject({ status: 'ok', uploaded: 1 });
  });
});

describe('tampering (owner decision A: stop and warn)', () => {
  beforeEach(async () => {
    computer.add([...entry('computer', 60), ...entry('computer', 30), ...entry('computer', 15)]);
    await runSync(drive, computer, noWait);
  });

  it('an edited duration is found, and nothing is uploaded', async () => {
    await editCell('Entries', 3, 9, 300); // row 3 = second entry, column 9 = duration_minutes
    const uploads = drive.uploads;
    computer.add(entry('computer', 5));
    const result = await runSync(drive, computer, noWait);
    expect(result.status).toBe('tampered');
    expect(result.status === 'tampered' && result.problems).toEqual([
      { sheet: 'Entries', row: 3, message: 'The content of this row was changed.' },
    ]);
    expect(drive.uploads).toBe(uploads);
    expect(await computer.pendingEvents()).toHaveLength(1); // the new entry stays safe on the device
  });

  it('a removed row in the middle is found', async () => {
    const wb = await loadWorkbook(drive.bytes!);
    wb.getWorksheet('Entries')!.spliceRows(3, 1);
    drive.bytes = await workbookBytes(wb);
    const { problems } = await verifyFile(drive);
    expect(problems.map((p) => p.row)).toContain(3);
    expect(problems.some((p) => p.message.includes('removed'))).toBe(true);
  });

  it('a removed last row is found (this device remembers what it saw)', async () => {
    const wb = await loadWorkbook(drive.bytes!);
    wb.getWorksheet('Entries')!.spliceRows(4, 1);
    drive.bytes = await workbookBytes(wb);
    expect((await verifyFile(drive)).problems).toEqual([]); // the chain alone can't see it…
    const result = await runSync(drive, computer, noWait); // …but this device remembers 3 rows
    expect(result.status === 'tampered' && result.problems[0].message).toContain('Rows were removed');
  });

  it('a deleted file is not silently replaced', async () => {
    drive.bytes = null;
    expect((await runSync(drive, computer, noWait)).status).toBe('tampered');
    expect(drive.bytes).toBeNull();
  });

  it('a changed fingerprint (row_hash) is found as well', async () => {
    await editCell('Entries', 2, 15, 'abc');
    expect((await verifyFile(drive)).problems.length).toBeGreaterThan(0);
  });
});

describe('corrections and totals', () => {
  it('a correction made on the phone arrives on the computer and changes the totals', async () => {
    computer.add(entry('computer', 90));
    await runSync(drive, computer, noWait);
    await runSync(drive, phone, noWait); // phone receives the entry
    const view = buildState([...phone.events.values()]).entries[0];
    phone.add(createCorrection('phone', view, 60, 'Took a break'));
    await runSync(drive, phone, noWait);
    await runSync(drive, computer, noWait);

    const state = buildState([...computer.events.values()]);
    expect(state.entries[0].effective_minutes).toBe(60);
    expect(state.minutesByProject.get('p1')).toBe(60);
    const { entries } = await fileRows();
    expect(entries[1]).toMatchObject({ entry_type: 'correction', duration_minutes: '-30', note: 'Took a break' });
  });
});

describe('backups', () => {
  it('a backup of the previous version is saved before every upload, at most 30 kept', async () => {
    let clock = Date.parse('2026-10-28T08:00:00Z');
    const opts = { ...noWait, now: () => new Date((clock += 60_000)) };
    const created: string[] = [];
    const save = drive.saveBackup.bind(drive);
    drive.saveBackup = async (name, bytes) => (created.push(name), save(name, bytes));

    computer.add(entry('computer', 1));
    await runSync(drive, computer, opts);
    expect(created).toHaveLength(0); // first upload: there was nothing to back up yet

    for (let i = 0; i < 35; i++) {
      const before = drive.bytes;
      computer.add(entry('computer', 1));
      await runSync(drive, computer, opts);
      expect(drive.backups.get(created.at(-1)!)).toEqual(before); // the backup is the previous version
    }
    expect(created).toHaveLength(35);
    expect([...drive.backups.keys()].sort()).toEqual(created.slice(-BACKUPS_TO_KEEP)); // the 30 newest are kept
    expect(created.every((n) => /^timetracker-[\dT-]+Z\.xlsx$/.test(n))).toBe(true); // no ":" (OneDrive forbids it)
  });
});
