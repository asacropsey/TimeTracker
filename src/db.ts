// The on-device database (IndexedDB, built into every browser).
//
// IMPORTANT – append-only: this file deliberately offers NO way to change or delete an event.
// Events are only written with add(), which fails if an event with the same event_id already
// exists, so an existing event can never be overwritten. The single exception is startFresh()
// (erasing test data before the very first sync) – see there.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { PlainError } from './errors';
import type { AppEvent } from './types';

interface TimeTrackerDB extends DBSchema {
  /** Every event ever made. Add-only. */
  events: { key: string; value: AppEvent };
  /** IDs of events not yet copied to Excel (used from Phase 4 on). */
  outbox: { key: string; value: { event_id: string } };
  /** Small device settings, e.g. the last used project. */
  settings: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<TimeTrackerDB>> | null = null;

function db() {
  dbPromise ??= openDB<TimeTrackerDB>('timetracker', 1, {
    upgrade(database) {
      database.createObjectStore('events', { keyPath: 'event_id' });
      database.createObjectStore('outbox', { keyPath: 'event_id' });
      database.createObjectStore('settings');
    },
  });
  return dbPromise;
}

/** Saves new events. All-or-nothing: if one fails (e.g. duplicate ID), none are saved. */
export async function appendEvents(events: AppEvent[]): Promise<void> {
  const tx = (await db()).transaction(['events', 'outbox'], 'readwrite');
  const requests: Promise<unknown>[] = [];
  for (const e of events) {
    requests.push(tx.objectStore('events').add({ ...e }));
    requests.push(tx.objectStore('outbox').add({ event_id: e.event_id }));
  }
  await Promise.all([...requests, tx.done]);
}

export async function getAllEvents(): Promise<AppEvent[]> {
  return (await db()).getAll('events');
}

/** Number of events waiting to be synced to Excel. */
export async function countPending(): Promise<number> {
  return (await db()).count('outbox');
}

/** The events waiting to be synced to Excel. */
export async function getPendingEvents(): Promise<AppEvent[]> {
  const database = await db();
  const ids = await database.getAllKeys('outbox');
  const events = await Promise.all(ids.map((id) => database.get('events', id)));
  return events.filter((e): e is AppEvent => e !== undefined);
}

/** After a successful sync: takes events off the waiting list. The events themselves stay untouched. */
export async function markSynced(eventIds: string[]): Promise<void> {
  const tx = (await db()).transaction('outbox', 'readwrite');
  await Promise.all([...eventIds.map((id) => tx.store.delete(id)), tx.done]);
}

/**
 * Brings events from the Excel file (e.g. made on the other device) onto this device.
 * Only adds events this device doesn't have yet – never overwrites one.
 */
export async function importSyncedEvents(events: AppEvent[]): Promise<void> {
  const tx = (await db()).transaction('events', 'readwrite');
  const known = new Set(await tx.store.getAllKeys());
  await Promise.all([...events.filter((e) => !known.has(e.event_id)).map((e) => tx.store.add({ ...e })), tx.done]);
}

/**
 * "Start fresh": the ONE exception to append-only, agreed with the owner for Phase 4.
 * Erases test data on this device – but only BEFORE syncing was ever switched on here,
 * so it can never touch anything that is (or will be) in the Excel file.
 */
export async function startFresh(): Promise<void> {
  if (await getSetting('syncEnabled')) throw new PlainError('Syncing is already switched on – nothing can be erased.');
  const tx = (await db()).transaction(['events', 'outbox', 'settings'], 'readwrite');
  await Promise.all([
    tx.objectStore('events').clear(),
    tx.objectStore('outbox').clear(),
    tx.objectStore('settings').put(true, 'syncEnabled'), // switching on in the same step: can't run twice
    tx.done,
  ]);
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db()).get('settings', key) as Promise<T | undefined>;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).put('settings', value, key);
}

/** Asks the browser not to delete our data when the device runs low on space. */
export async function requestPersistentStorage(): Promise<boolean> {
  return navigator.storage?.persist ? navigator.storage.persist() : false;
}

/** Only for automated tests: forget the open connection so each test can start fresh. */
export function closeDbForTests(): void {
  dbPromise?.then((d) => d.close());
  dbPromise = null;
}
