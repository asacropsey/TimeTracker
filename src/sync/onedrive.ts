// The real Excel file in OneDrive: OneDrive/Apps/Time Tracker/timetracker.xlsx
// (the app may only access its own folder – Files.ReadWrite.AppFolder).

import { GraphError, graphFetch, OfflineError } from '../graph';
import { FileChangedError, FileLockedError, type FileStore } from './engine';

const APP_FOLDER = '/me/drive/special/approot';
const FILE = `${APP_FOLDER}:/timetracker.xlsx`;
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export class OneDriveFile implements FileStore {
  private backupsFolderReady = false;

  async download() {
    const info = await graphFetch(FILE);
    if (info.status === 404) return null; // no file yet: the first sync creates it
    if (!info.ok) throw new GraphError(info.status);
    const meta = (await info.json()) as { eTag: string; '@microsoft.graph.downloadUrl': string };
    // The download link is pre-authorised by Microsoft, so it is fetched without the sign-in pass.
    let content: Response;
    try {
      content = await fetch(meta['@microsoft.graph.downloadUrl'], { cache: 'no-store' });
    } catch {
      throw new OfflineError();
    }
    if (!content.ok) throw new GraphError(content.status);
    return { bytes: new Uint8Array(await content.arrayBuffer()), etag: meta.eTag };
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
    if (!response.ok) throw new GraphError(response.status);
  }

  async saveBackup(name: string, bytes: Uint8Array) {
    await this.ensureBackupsFolder();
    const response = await graphFetch(`${APP_FOLDER}:/backups/${encodeURIComponent(name)}:/content`, {
      method: 'PUT',
      headers: { 'Content-Type': XLSX_TYPE },
      body: bytes as BodyInit,
    });
    if (!response.ok) throw new GraphError(response.status);
  }

  async listBackups() {
    const response = await graphFetch(`${APP_FOLDER}:/backups:/children?$select=id,name&$top=200`);
    if (response.status === 404) return [];
    if (!response.ok) throw new GraphError(response.status);
    return ((await response.json()) as { value: { id: string; name: string }[] }).value;
  }

  /** Only ever used on old copies inside backups/ – never on timetracker.xlsx itself. */
  async deleteBackup(id: string) {
    const response = await graphFetch(`/me/drive/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) throw new GraphError(response.status);
  }

  private async ensureBackupsFolder() {
    if (this.backupsFolderReady) return;
    const response = await graphFetch(`${APP_FOLDER}/children`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'backups', folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
    });
    if (!response.ok && response.status !== 409) throw new GraphError(response.status); // 409 = exists already
    this.backupsFolderReady = true;
  }
}
