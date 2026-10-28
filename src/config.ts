// Settings for Microsoft sign-in. None of this is secret: the client ID is like the app's name tag.

/** "Application (client) ID" from the app registration (Azure portal → App registrations → Time Tracker). */
export const MICROSOFT_CLIENT_ID = 'b4113e4a-f125-4721-8531-25223330f5e5';

/** "consumers" = personal Microsoft accounts only (never work or school accounts). */
export const AUTHORITY = 'https://login.microsoftonline.com/consumers';

/**
 * What the app asks permission for:
 * - User.Read: your name, to show who is signed in
 * - Files.ReadWrite.AppFolder: ONLY the app's own folder "OneDrive/Apps/Time Tracker" – nothing else
 * (offline_access, which keeps you signed in, is added automatically.)
 */
export const SCOPES = ['User.Read', 'Files.ReadWrite.AppFolder'];
