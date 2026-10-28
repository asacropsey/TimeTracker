// Talking to Microsoft Graph (the door to OneDrive). Phase 3 only READS: who you are and the app folder.

import { getAccessToken, SignInRequiredError } from './auth';

const GRAPH = 'https://graph.microsoft.com/v1.0';

/** Turns a Microsoft error code into a plain-language message. */
export function describeGraphError(status: number): string {
  if (status === 401) return 'Please sign in again.';
  if (status === 403) return 'Microsoft did not allow access to the app folder in OneDrive.';
  if (status === 404) return 'OneDrive could not be found for this account.';
  if (status === 423) return 'The file is locked – it may be open in Excel.';
  if (status === 429 || status === 503) return 'Microsoft is busy right now. Please try again in a minute.';
  if (status >= 500) return 'Microsoft had a temporary problem. Please try again later.';
  return `Unexpected answer from Microsoft (code ${status}).`;
}

export class GraphError extends Error {
  constructor(public status: number) {
    super(describeGraphError(status));
  }
}

async function graphGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  let response: Response;
  try {
    response = await fetch(GRAPH + path, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error('No connection to Microsoft right now.');
  }
  if (response.status === 401) throw new SignInRequiredError();
  if (!response.ok) throw new GraphError(response.status);
  return response.json() as Promise<T>;
}

export interface ConnectionInfo {
  name: string;
  folderName: string;
}

/**
 * Checks that sign-in and OneDrive access work.
 * Opening the app folder makes Microsoft create "OneDrive/Apps/Time Tracker" if it doesn't exist yet.
 */
export async function checkConnection(): Promise<ConnectionInfo> {
  const me = await graphGet<{ displayName?: string }>('/me');
  const folder = await graphGet<{ name: string }>('/me/drive/special/approot');
  return { name: me.displayName ?? '', folderName: folder.name };
}
