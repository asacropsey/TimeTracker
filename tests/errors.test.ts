// Tests that every error shown to the user is in plain language.

import { describe, expect, it } from 'vitest';
import { SignInRequiredError } from '../src/auth';
import { plainError, PlainError } from '../src/errors';
import { GraphError, OfflineError } from '../src/graph';

describe('plain-language errors', () => {
  it("the app's own messages are shown as they are", () => {
    expect(plainError(new SignInRequiredError(), 'syncing')).toBe('Please sign in again.');
    expect(plainError(new OfflineError(), 'syncing')).toBe('No connection to Microsoft right now.');
    expect(plainError(new GraphError(423, 'uploading the Excel file'), 'syncing')).toBe(
      'Problem while uploading the Excel file: The file is locked – it may be open in Excel.',
    );
    expect(plainError(new PlainError('Nothing to do.'), 'x')).toBe('Nothing to do.');
  });

  it('unexpected errors get a plain sentence, with the technical detail at the end', () => {
    const msg = plainError(new RangeError('Invalid array length'), 'syncing');
    expect(msg).toMatch(/^Something unexpected went wrong while syncing\. Your entries are safe on this device\./);
    expect(msg).toContain('(Technical detail: Invalid array length)');
  });

  it('known browser and sign-in problems are explained', () => {
    const full = new Error('quota');
    full.name = 'QuotaExceededError';
    expect(plainError(full, 'saving')).toContain('storage on this device is full');
    expect(plainError(new Error('interaction_in_progress: ...'), 'signing in')).toContain('already in progress');
    expect(plainError(new TypeError('Failed to fetch'), 'syncing')).toContain('No connection while syncing');
  });
});
