// Tests for the Microsoft sign-in settings and plain-language error messages.

import { describe, expect, it } from 'vitest';
import { AUTHORITY, SCOPES } from '../src/config';
import { describeGraphError } from '../src/graph';

describe('sign-in settings', () => {
  it('only allow personal Microsoft accounts', () => {
    expect(AUTHORITY).toBe('https://login.microsoftonline.com/consumers');
  });

  it('only ask for the app folder – never the whole OneDrive (owner decision, Phase 3)', () => {
    expect(SCOPES).toContain('Files.ReadWrite.AppFolder');
    for (const broad of ['Files.ReadWrite', 'Files.ReadWrite.All', 'Files.Read', 'Files.Read.All', 'Sites.ReadWrite.All']) {
      expect(SCOPES).not.toContain(broad);
    }
  });
});

describe('error messages from Microsoft', () => {
  it('are in plain language', () => {
    expect(describeGraphError(401)).toBe('Please sign in again.');
    expect(describeGraphError(423)).toContain('open in Excel');
    expect(describeGraphError(503)).toContain('try again');
    expect(describeGraphError(418)).toContain('code 418');
  });
});
