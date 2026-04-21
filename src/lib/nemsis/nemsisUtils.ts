/** Lookup a code from a NEMSIS map. Returns defaultCode if not found. */
export function mapVal(map: Record<string, string | null>, val: unknown, defaultCode = ''): string {
  if (val == null) return defaultCode;
  const v = String(val).trim();
  const result = (map as Record<string, string | null>)[v];
  if (result === undefined) return defaultCode;
  if (result === null) return defaultCode;
  return result;
}

/** Parse a GCS component value to a numeric string. */
export function gcsNum(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  const parts = s.split('-');
  const n = parseInt(parts[0].trim(), 10);
  if (!isNaN(n)) return String(n);
  return /^\d+$/.test(s) ? s : null;
}
