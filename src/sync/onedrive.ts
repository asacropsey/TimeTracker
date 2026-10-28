// The real Excel file in OneDrive: OneDrive/Apps/Time Tracker/timetracker.xlsx
// (the app may only access its own folder – Files.ReadWrite.AppFolder).

import { GraphError, graphFetch } from '../graph';
import { FileChangedError, FileLockedError, type FileStore } from './engine';

const APP_FOLDER = '/me/drive/special/approot';
const FILE = `${APP_FOLDER}:/timetracker.xlsx`;
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export class OneDriveFile implements FileStore {
  private backupsFolderReady = false;

  async download() {
    const info = await graphFetch(FILE);
    if (info.status === 404) return null; // no file yet: the first sync creates it
    if (!info.ok) throw await GraphError.from(info, 'looking up the Excel file');
    const meta = (await info.json()) as { eTag: string; '@microsoft.graph.downloadUrl'?: string };
    return { bytes: await this.downloadContent(meta['@microsoft.graph.downloadUrl']), etag: meta.eTag };
  }

  private async downloadContent(downloadUrl?: string): Promise<Uint8Array> {
    // 1st choice: Microsoft's ready-made download link (needs no sign-in pass; it is new every
    // time, so it can never return an old copy).
    if (downloadUrl) {
      try {
        const content = await fetch(downloadUrl);
        if (content.ok) return new Uint8Array(await content.arrayBuffer());
      } catch {
        // fall through to the 2nd route
      }
    }
    // 2nd route: ask Graph for the file content directly.
    const content = await graphFetch(`${FILE}:/content`, { cache: 'default' });
    if (!content.ok) throw await GraphError.from(content, 'downloading the Excel file');
    return new Uint8Array(await content.arrayBuffer());
  }

  async upload(bytes: Uint8Array, etag: string | null) {
    // With an etag: "only if the file is still exactly the version we downloaded" (If-Match).
    // Without: "only if no file exists yet" (so two devices can't both create it).
    const url = etag ? `${FILE}:/content` : `${FILE}:/content?@microsoft.graph.conflictBehavior=fail`;
    const headers: Record<string, string> = { 'Content-Type': XLSX_TYPE };
    if (etag) headers['If-Match'] = etag;
    const response = await graphFetch(url, { method: 'PUT', headers, body: bytes as BodyInit });
    if (response.status === 412 || response.status === 409) throw new FileChangedError();
    if (response.status === 423) throw new FileLockedError();
    if (!response.ok) throw await GraphError.from(response, 'uploading the Excel file');
  }

  async saveBackup(name: string, bytes: Uint8Array) {
    await this.ensureBackupsFolder();
    const response = await graphFetch(`${APP_FOLDER}:/backups/${encodeURIComponent(name)}:/content`, {
      method: 'PUT',
      headers: { 'Content-Type': XLSX_TYPE },
      body: bytes as BodyInit,
    });
    if (!response.ok) throw await GraphError.from(response, 'saving a backup copy');
  }

  async listBackups() {
    const response = await graphFetch(`${APP_FOLDER}:/backups:/children?$select=id,name`);
    if (response.status === 404) return [];
    if (!response.ok) throw await GraphError.from(response, 'listing the backup copies');
    return ((await response.json()) as { value: { id: string; name: string }[] }).value;
  }

  /** Only ever used on old copies inside backups/ – never on timetracker.xlsx itself. */
  async deleteBackup(id: string) {
    const response = await graphFetch(`/me/drive/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) throw await GraphError.from(response, 'removing an old backup copy');
  }

  private async ensureBackupsFolder() {
    if (this.backupsFolderReady) return;
    const exists = await graphFetch(`${APP_FOLDER}:/backups`);
    if (exists.status === 404) {
      // Creating a folder needs the app folder's real ID (its nickname "special/approot" is
      // refused by Microsoft for this, with "invalidRequest").
      const appFolder = await graphFetch(`${APP_FOLDER}?$select=id`);
      if (!appFolder.ok) throw await GraphError.from(appFolder, 'looking up the app folder');
      const { id } = (await appFolder.json()) as { id: string };
      const created = await graphFetch(`/me/drive/items/${encodeURIComponent(id)}/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'backups', folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
      });
      // 409 = exists already. Any other refusal: carry on – uploading the backup into
      // "backups/…" creates the folder by itself; if that fails too, its error is shown.
      if (!created.ok && created.status !== 409 && created.status !== 400) {
        throw await GraphError.from(created, 'creating the backups folder');
      }
    } else if (!exists.ok) {
      throw await GraphError.from(exists, 'looking up the backups folder');
    }
    this.backupsFolderReady = true;
  }
}
