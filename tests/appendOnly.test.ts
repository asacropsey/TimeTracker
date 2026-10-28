// Tests for the most important rule: events are only ever ADDED, never changed or deleted.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../src/db';
import { appendEvents, closeDbForTests, countPending, getAllEvents } from '../src/db';
import { createCorrection, createProject, createTimeEntry, updateProject } from '../src/events';
import { buildState } from '../src/state';

beforeEach(() => {
  closeDbForTests();
  globalThis.indexedDB = new IDBFactory(); // a fresh, empty test database for every test
});

function entry(minutes: number, projectId = 'p1') {
  return createTimeEntry('computer', {
    project_id: projectId,
    milestone_id: '',
    start: '2026-01-05',
    end: '',
    duration_minutes: minutes,
    note: '',
  });
}

describe('event store is append-only', () => {
  it('offers no function to change or delete events (only the guarded "startFresh")', () => {
    const names = Object.keys(db);
    for (const forbidden of ['update', 'delete', 'remove', 'put', 'clear', 'edit', 'erase', 'wipe']) {
      expect(names.filter((n) => n.toLowerCase().includes(forbidden))).toEqual([]);
    }
    expect(names.sort()).toEqual([
      'appendEvents', 'closeDbForTests', 'countPending', 'getAllEvents', 'getPendingEvents', 'getSetting',
      'importSyncedEvents', 'markSynced', 'requestPersistentStorage', 'setSetting', 'startFresh',
    ]); // a new function here must be reviewed against the append-only rule
  });

  it('refuses to save an event whose ID already exists, and keeps the original', async () => {
    const [original] = entry(60);
    await appendEvents([original]);
    const tampered = { ...original, duration_minutes: 999 };
    await expect(appendEvents([tampered])).rejects.toThrow();
    const stored = await getAllEvents();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ duration_minutes: 60 });
  });

  it('saves all-or-nothing: if one event in a batch fails, none are saved', async () => {
    const [first] = entry(60);
    await appendEvents([first]);
    const [fresh] = entry(30);
    await expect(appendEvents([fresh, first])).rejects.toThrow();
    expect(await getAllEvents()).toHaveLength(1);
    expect(await countPending()).toBe(1);
  });

  it('marks every new event as waiting to sync', async () => {
    await appendEvents([...entry(10), ...entry(20)]);
    expect(await countPending()).toBe(2);
  });
});

describe('syncing on the device', () => {
  it('marking as synced only removes events from the waiting list, never the events', async () => {
    const events = [...entry(10), ...entry(20)];
    await db.appendEvents(events);
    await db.markSynced([events[0].event_id]);
    expect(await getAllEvents()).toHaveLength(2);
    expect((await db.getPendingEvents()).map((e) => e.event_id)).toEqual([events[1].event_id]);
  });

  it('events from the other device are added, but never overwrite an existing one', async () => {
    const [mine] = entry(60);
    await appendEvents([mine]);
    const [theirs] = entry(45);
    await db.importSyncedEvents([{ ...mine, duration_minutes: 999 }, theirs]);
    const stored = await getAllEvents();
    expect(stored).toHaveLength(2);
    expect(stored.find((e) => e.event_id === mine.event_id)).toMatchObject({ duration_minutes: 60 });
    expect(await countPending()).toBe(1); // received events are not "waiting to sync"
  });

  it('"Start fresh" erases test data before the first sync – and switches syncing on', async () => {
    await appendEvents(entry(60));
    await db.startFresh();
    expect(await getAllEvents()).toEqual([]);
    expect(await db.getSetting('syncEnabled')).toBe(true);
  });

  it('"Start fresh" refuses once syncing has been switched on', async () => {
    await appendEvents(entry(60));
    await db.setSetting('syncEnabled', true);
    await expect(db.startFresh()).rejects.toThrow();
    expect(await getAllEvents()).toHaveLength(1);
  });
});

describe('corrections', () => {
  it('add a new entry and leave the original untouched', async () => {
    const original = entry(90);
    await appendEvents(original);
    const view = buildState(await getAllEvents()).entries[0];

    await appendEvents(createCorrection('phone', view, 60, 'Took a break'));
    const events = await getAllEvents();

    expect(events).toHaveLength(2);
    expect(events.find((e) => e.event_id === original[0].event_id)).toEqual(original[0]);
    const correction = events.find((e) => e.kind === 'entry' && e.entry_type === 'correction');
    expect(correction).toMatchObject({ duration_minutes: -30, corrects_event_id: original[0].event_id, note: 'Took a break' });
  });

  it('are included in totals, and a second correction builds on the first', () => {
    const original = entry(90);
    let state = buildState(original);
    const first = createCorrection('phone', state.entries[0], 60, 'break');
    state = buildState([...original, ...first]);
    expect(state.entries[0].effective_minutes).toBe(60);
    expect(state.minutesByProject.get('p1')).toBe(60);

    const second = createCorrection('computer', state.entries[0], 120, 'forgot the evening');
    state = buildState([...original, ...first, ...second]);
    expect(second[0].duration_minutes).toBe(60);
    expect(state.entries[0].effective_minutes).toBe(120);
    expect(state.entries[0].corrections).toHaveLength(2);
    expect(state.minutesByProject.get('p1')).toBe(120);
  });
});

describe('project changes are events too', () => {
  it('renaming keeps the old name in the change history', () => {
    const created = createProject('computer', 'Roman', '');
    const project = buildState(created).projects[0];
    const renamed = updateProject('computer', project, 'name', 'Novel');
    expect(renamed[0]).toMatchObject({ old_value: 'Roman', new_value: 'Novel' });
    const state = buildState([...created, ...renamed]);
    expect(state.projects[0].name).toBe('Novel');
  });
});
