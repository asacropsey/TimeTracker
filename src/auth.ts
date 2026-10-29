// Microsoft sign-in, using Microsoft's official library (MSAL).
// Sign-in happens on Microsoft's own page; the app never sees your password.
// The app keeps working without sign-in (and offline): entries are always saved on the device first.

import { InteractionRequiredAuthError, PublicClientApplication, type AccountInfo } from '@azure/msal-browser';
import { AUTHORITY, MICROSOFT_CLIENT_ID, SCOPES } from './config';
import { PlainError } from './errors';

let msal: PublicClientApplication | null = null;

/** True once the client ID from the app registration has been filled in (src/config.ts). */
export function isSignInConfigured(): boolean {
  return MICROSOFT_CLIENT_ID !== '';
}

/** The address Microsoft sends you back to after signing in (must match the app registration). */
function appAddress(): string {
  return location.origin + import.meta.env.BASE_URL;
}

/** Starts the sign-in library and finishes a sign-in if we just came back from Microsoft. */
export async function initAuth(): Promise<AccountInfo | null> {
  if (!isSignInConfigured()) return null;
  msal = new PublicClientApplication({
    auth: { clientId: MICROSOFT_CLIENT_ID, authority: AUTHORITY, redirectUri: appAddress(), postLogoutRedirectUri: appAddress() },
    // Remember the sign-in after the app is closed (stored only on this device).
    cache: { cacheLocation: 'localStorage' },
  });
  await msal.initialize();
  const result = await msal.handleRedirectPromise();
  if (result?.account) msal.setActiveAccount(result.account);
  else if (!msal.getActiveAccount()) msal.setActiveAccount(msal.getAllAccounts()[0] ?? null);
  return msal.getActiveAccount();
}

export function currentAccount(): AccountInfo | null {
  return msal?.getActiveAccount() ?? null;
}

/** Goes to Microsoft's sign-in page; comes back to the app afterwards. */
export async function signIn(): Promise<void> {
  if (!msal) throw new PlainError('Microsoft sign-in is not set up yet.');
  await msal.loginRedirect({ scopes: SCOPES, prompt: 'select_account' });
}

/** Forgets the sign-in on this device. Entries saved on the device are NOT touched. */
export async function signOut(): Promise<void> {
  const account = currentAccount();
  if (msal && account) await msal.clearCache({ account });
  msal?.setActiveAccount(null);
}

/** Thrown when Microsoft wants you to sign in again (e.g. after some time). */
export class SignInRequiredError extends PlainError {
  constructor() {
    super('Please sign in again.');
  }
}

/** Gets a short-lived pass ("access token") for OneDrive, renewing it quietly when possible. */
export async function getAccessToken(): Promise<string> {
  const account = currentAccount();
  if (!msal || !account) throw new SignInRequiredError();
  try {
    return (await msal.acquireTokenSilent({ scopes: SCOPES, account })).accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) throw new SignInRequiredError();
    throw err;
  }
}
