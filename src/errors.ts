// Error messages in plain language.
// The app's own errors (PlainError) are already written for people. Anything unexpected
// (from the browser, Microsoft's library, …) is wrapped in a plain sentence; the technical
// detail is kept at the end in brackets, so a screenshot still says what went wrong.

/** An error whose message is already plain language and can be shown as it is. */
export class PlainError extends Error {}

export function plainError(err: unknown, doing: string): string {
  if (err instanceof PlainError) return err.message;
  const name = err instanceof Error ? err.name : '';
  const detail = err instanceof Error ? err.message : String(err);

  if (name === 'QuotaExceededError') {
    return `The storage on this device is full, so nothing could be saved while ${doing}. Please free up some space.`;
  }
  if (detail.includes('interaction_in_progress')) {
    return 'A sign-in is already in progress. Please wait a moment, or close and reopen the app.';
  }
  if (detail.includes('user_cancelled')) return 'Sign-in was cancelled.';
  if (name === 'TypeError' && /fetch|network/i.test(detail)) {
    return `No connection while ${doing}. Your entries are safe on this device and will sync later.`;
  }
  return (
    `Something unexpected went wrong while ${doing}. Your entries are safe on this device. ` +
    `Please try again; if it keeps happening, close and reopen the app. (Technical detail: ${detail})`
  );
}
