// The "fingerprint" of each row in Excel (SHA-256 hash).
// Every row's fingerprint includes the fingerprint of the row before it (prev_hash), so the rows form
// a chain: changing or removing any row breaks the chain, and "Verify data" can show where.

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * row_hash = SHA-256 of all the row's values in column order – from seq up to and including
 * prev_hash – written as a JSON list of texts, e.g. ["1","3f2a…","phone",…,"<prev_hash>"].
 */
export function rowHash(values: string[]): Promise<string> {
  return sha256Hex(JSON.stringify(values));
}
