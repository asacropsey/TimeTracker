// Talking to Microsoft Graph (the door to OneDrive).

import { getAccessToken, SignInRequiredError } from './auth';
import { PlainError } from './errors';

export const GRAPH = 'https://graph.microsoft.com/v1.0';

/** Turns a Microsoft error code into a plain-language message. */
export function describeGraphError(status: number): string {
  if (status === 401) return 'Please sign in again.';
  if (status === 403) return 'Microsoft did not allow access to the app folder in OneDrive.';
  if (status === 404) return 'OneDrive could not be found for this account.';
  if (status === 423) return 'The file is locked – it may be open in Excel.';
  if (status === 429 || status === 503) return 'Microsoft is busy right now. Please try again in a minute.';
  if (status === 507) return 'Your OneDrive is full.';
  if (status >= 500) return 'Microsoft had a temporary problem. Please try again later.';
  return `Unexpected answer from Microsoft (code ${status}).`;
}

export class GraphError extends PlainError {
  /**
   * @param step   what the app was doing, e.g. "downloading the Excel file"
   * @param detail Microsoft's own short explanation, if it gave one
   */
  constructor(public status: number, step = '', detail = '') {
    super(
      (step ? `Problem while ${step}: ` : '') +
        describeGraphError(status) +
        (detail && status !== 401 && status !== 423 ? ` [${detail}]` : ''),
    );
  }

  /** Builds the error from a failed response, including Microsoft's explanation. */
  static async from(response: Response, step: string): Promise<GraphError> {
    let detail = '';
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      detail = [body.error?.code, body.error?.message].filter(Boolean).join(': ').slice(0, 200);
    } catch {
      // no readable explanation
    }
    return new GraphError(response.status, step, detail);
  }
}

export class OfflineError extends PlainError {
  constructor() {
    super('No connection to Microsoft right now.');
  }
}

/**
 * Sends a request to Microsoft Graph with the sign-in pass attached.
 * Returns the response for the caller to inspect; only "no connection" and "sign in again" are thrown here.
 */
export async function graphFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  let response: Response;
  try {
    response = await fetch(url.startsWith('http') ? url : GRAPH + url, {
      cache: 'no-store', // always ask OneDrive for the newest version, never a stored copy
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new OfflineError();
  }
  if (response.status === 401) throw new SignInRequiredError();
  return response;
}
