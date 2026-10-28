// The on-device database (IndexedDB, built into every browser).
//
// IMPORTANT – append-only: this file deliberately offers NO way to change or delete an event.
// The only way to write an event is appendEvents(), which uses add(). add() fails if an event
// with the same event_id already exists, so an existing event can never be overwritten.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
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
