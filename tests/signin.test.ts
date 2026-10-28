// Tests for the Microsoft sign-in settings and plain-language error messages.

import { describe, expect, it } from 'vitest';
import { AUTHORITY, SCOPES } from '../src/config';
import { describeGraphError, GraphError } from '../src/graph';

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

  it('say which step failed and include Microsoft’s own explanation', async () => {
    const response = new Response(JSON.stringify({ error: { code: 'invalidRequest', message: 'Bad header' } }), { status: 400 });
    const err = await GraphError.from(response, 'downloading the Excel file');
    expect(err.message).toBe(
      'Problem while downloading the Excel file: Unexpected answer from Microsoft (code 400). [invalidRequest: Bad header]',
    );
  });
});
