// Test helpers: a pretend OneDrive and pretend devices. The real timetracker.xlsx is never used.

import { FileChangedError, FileLockedError, type FileStore, type LastSeen, type LocalStore } from '../src/sync/engine';
import type { AppEvent } from '../src/types';

/** An in-memory stand-in for the Excel file in OneDrive, with ways to simulate problems. */
export class FakeOneDrive implements FileStore {
  bytes: Uint8Array | null = null;
  etag = 0;
  locked = false;
  offline = false;
  backups = new Map<string, Uint8Array>();
  uploads = 0;
  /** Runs right before an upload is accepted – used to let "the other device" sneak in. */
  beforeUpload: (() => Promise<void>) | null = null;
  /** Simulates "upload arrived, but the phone lost the connection before hearing back". */
  loseNextUploadResponse = false;

  private checkOnline() {
    if (this.offline) throw new TypeError('Failed to fetch');
  }

  async download() {
    this.checkOnline();
    return this.bytes ? { bytes: this.bytes.slice(), etag: String(this.etag) } : null;
  }

  async upload(bytes: Uint8Array, etag: string | null) {
    this.checkOnline();
    const hook = this.beforeUpload;
    this.beforeUpload = null;
    if (hook) await hook();
    if (this.locked) throw new FileLockedError();
    if (etag === null ? this.bytes !== null : etag !== String(this.etag)) throw new FileChangedError();
    this.bytes = bytes.slice();
    this.etag++;
    this.uploads++;
    if (this.loseNextUploadResponse) {
      this.loseNextUploadResponse = false;
      throw new TypeError('Failed to fetch');
    }
  }

  async saveBackup(name: string, bytes: Uint8Array) {
    this.checkOnline();
    this.backups.set(name, bytes.slice());
  }
  async listBackups() {
    return [...this.backups.keys()].map((name) => ({ id: name, name }));
  }
  async deleteBackup(id: string) {
    this.backups.delete(id);
  }
}

/** A pretend device (phone or computer) with its own local database. */
export class FakeDevice implements LocalStore {
  events = new Map<string, AppEvent>();
  pending = new Set<string>();
  lastSeen: LastSeen | undefined;

  add(events: AppEvent[]) {
    for (const e of events) {
      this.events.set(e.event_id, e);
      this.pending.add(e.event_id);
    }
  }
  async pendingEvents() {
    return [...this.pending].map((id) => this.events.get(id)!);
  }
  async markSynced(ids: string[]) {
    ids.forEach((id) => this.pending.delete(id));
  }
  async importSyncedEvents(events: AppEvent[]) {
    for (const e of events) if (!this.events.has(e.event_id)) this.events.set(e.event_id, e);
  }
  async getLastSeen() {
    return this.lastSeen;
  }
  async setLastSeen(lastSeen: LastSeen) {
    this.lastSeen = lastSeen;
  }
}
