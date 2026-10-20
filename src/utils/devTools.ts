export interface JsonProcessResult {
  valid: boolean;
  output: string;
  error?: string;
  stats?: {
    keysCount: number;
    depth: number;
    byteSize: number;
  };
}

function sortJsonKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortJsonKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function measureJsonStats(value: unknown, currentDepth = 1): { keys: number; maxDepth: number } {
  if (Array.isArray(value)) {
    let keys = 0;
    let maxDepth = currentDepth;
    for (const item of value) {
      const sub = measureJsonStats(item, currentDepth + 1);
      keys += sub.keys;
      if (sub.maxDepth > maxDepth) maxDepth = sub.maxDepth;
    }
    return { keys, maxDepth };
  }
  if (value !== null && typeof value === 'object') {
    const objKeys = Object.keys(value as Record<string, unknown>);
    let keys = objKeys.length;
    let maxDepth = currentDepth;
    for (const k of objKeys) {
      const sub = measureJsonStats((value as Record<string, unknown>)[k], currentDepth + 1);
      keys += sub.keys;
      if (sub.maxDepth > maxDepth) maxDepth = sub.maxDepth;
    }
    return { keys, maxDepth };
  }
  return { keys: 0, maxDepth: currentDepth };
}

/**
 * Formats, validates, minifies, or recursively sorts keys of a JSON string.
 */
export function processJsonInput(
  raw: string,
  options: { indent: number | 'tab' | 'minify'; sortKeys: boolean }
): JsonProcessResult {
  if (!raw.trim()) {
    return { valid: false, output: '', error: 'Input is empty. Paste or load a JSON payload.' };
  }

  try {
    const parsed = JSON.parse(raw);
    const transformed = options.sortKeys ? sortJsonKeysDeep(parsed) : parsed;
    const space =
      options.indent === 'minify' ? undefined : options.indent === 'tab' ? '\t' : options.indent;
    const output = JSON.stringify(transformed, null, space);
    const { keys, maxDepth } = measureJsonStats(transformed);
    const byteSize = new TextEncoder().encode(output).byteLength;

    return {
      valid: true,
      output,
      stats: {
        keysCount: keys,
        depth: maxDepth,
        byteSize,
      },
    };
  } catch (err) {
    return {
      valid: false,
      output: '',
      error: err instanceof Error ? err.message : 'Invalid JSON syntax.',
    };
  }
}

/**
 * UTF-8 safe Base64 encoding and decoding (Standard or URL-safe RFC 4648).
 */
export function encodeBase64Utf8(input: string, urlSafe = false): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  if (!urlSafe) return b64;
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBase64Utf8(input: string): string {
  const cleaned = input.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padMod = cleaned.length % 4;
  const padded = padMod === 0 ? cleaned : cleaned + '='.repeat(4 - padMod);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * URL Encoding & Query String Parsing
 */
export function encodeUrlString(input: string): string {
  return encodeURIComponent(input);
}

export function decodeUrlString(input: string): string {
  return decodeURIComponent(input.replace(/\+/g, ' '));
}

export function parseQueryParams(urlOrQuery: string): Array<{ key: string; value: string }> {
  const trimmed = urlOrQuery.trim();
  if (!trimmed) return [];
  const queryStart = trimmed.indexOf('?');
  const rawQuery = queryStart >= 0 ? trimmed.slice(queryStart + 1) : trimmed;
  const params = new URLSearchParams(rawQuery);
  const entries: Array<{ key: string; value: string }> = [];
  params.forEach((value, key) => {
    entries.push({ key, value });
  });
  return entries;
}

/**
 * Cryptographically strong RFC 4122 v4 UUID generation with format options.
 */
export interface UuidFormatOptions {
  count: number;
  uppercase: boolean;
  hyphens: boolean;
  braces: boolean;
}

function generateSingleRawUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generateUuidBatch(options: UuidFormatOptions): string[] {
  const clampedCount = Math.max(1, Math.min(100, Math.floor(options.count || 1)));
  const results: string[] = [];

  for (let i = 0; i < clampedCount; i++) {
    let id = generateSingleRawUuid();
    if (!options.hyphens) {
      id = id.replace(/-/g, '');
    }
    if (options.uppercase) {
      id = id.toUpperCase();
    }
    if (options.braces) {
      id = `{${id}}`;
    }
    results.push(id);
  }
  return results;
}

/**
 * Unix Timestamp & ISO 8601 Conversion
 */
export interface TimestampBreakdown {
  valid: boolean;
  error?: string;
  epochSeconds: number;
  epochMilliseconds: number;
  isoUtc: string;
  utcHuman: string;
  relativeDescription: string;
  dayOfYear: number;
  isLeapYear: boolean;
}

export function inspectTimestampInput(input: string, referenceNowMs = Date.now()): TimestampBreakdown {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Enter a Unix timestamp (seconds or milliseconds) or an ISO-8601 date string.',
      epochSeconds: 0,
      epochMilliseconds: 0,
      isoUtc: '',
      utcHuman: '',
      relativeDescription: '',
      dayOfYear: 0,
      isLeapYear: false,
    };
  }

  let date: Date;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    // Heuristic: values with <= 10 digits (or < 1e11) are treated as seconds; otherwise milliseconds
    const ms = Math.abs(num) < 1e11 ? Math.round(num * 1000) : Math.round(num);
    date = new Date(ms);
  } else {
    date = new Date(trimmed);
  }

  if (Number.isNaN(date.getTime())) {
    return {
      valid: false,
      error: `Unable to parse "${trimmed}" as a valid Unix timestamp or ISO date.`,
      epochSeconds: 0,
      epochMilliseconds: 0,
      isoUtc: '',
      utcHuman: '',
      relativeDescription: '',
      dayOfYear: 0,
      isLeapYear: false,
    };
  }

  const epochMilliseconds = date.getTime();
  const epochSeconds = Math.floor(epochMilliseconds / 1000);
  const diffSec = Math.round((epochMilliseconds - referenceNowMs) / 1000);

  let relativeDescription = 'just now';
  const absSec = Math.abs(diffSec);
  if (absSec >= 60) {
    const units: Array<[string, number]> = [
      ['year', 31536000],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];
    for (const [label, secs] of units) {
      if (absSec >= secs) {
        const count = Math.round(absSec / secs);
        relativeDescription =
          diffSec > 0
            ? `in ${count} ${label}${count === 1 ? '' : 's'}`
            : `${count} ${label}${count === 1 ? '' : 's'} ago`;
        break;
      }
    }
  } else if (absSec > 0) {
    relativeDescription = diffSec > 0 ? `in ${absSec}s` : `${absSec}s ago`;
  }

  const year = date.getUTCFullYear();
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const startOfYear = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((epochMilliseconds - startOfYear) / 86400000) + 1;

  return {
    valid: true,
    epochSeconds,
    epochMilliseconds,
    isoUtc: date.toISOString(),
    utcHuman: date.toUTCString(),
    relativeDescription,
    dayOfYear,
    isLeapYear,
  };
}

/**
 * Line-by-line Longest Common Subsequence (LCS) Diff Engine
 */
export interface DiffLine {
  type: 'equal' | 'add' | 'remove';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface DiffSummary {
  lines: DiffLine[];
  added: number;
  removed: number;
  unchanged: number;
}

export function computeLineDiff(
  originalText: string,
  modifiedText: string,
  options: { ignoreTrimWhitespace?: boolean } = {}
): DiffSummary {
  const oldLines = originalText.split(/\r?\n/);
  const newLines = modifiedText.split(/\r?\n/);

  const normalize = (s: string) => (options.ignoreTrimWhitespace ? s.trim() : s);

  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (normalize(oldLines[i]) === normalize(newLines[j])) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  while (i < m && j < n) {
    if (normalize(oldLines[i]) === normalize(newLines[j])) {
      lines.push({
        type: 'equal',
        oldLineNumber: i + 1,
        newLineNumber: j + 1,
        content: newLines[j],
      });
      unchanged++;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({
        type: 'remove',
        oldLineNumber: i + 1,
        content: oldLines[i],
      });
      removed++;
      i++;
    } else {
      lines.push({
        type: 'add',
        newLineNumber: j + 1,
        content: newLines[j],
      });
      added++;
      j++;
    }
  }

  while (i < m) {
    lines.push({
      type: 'remove',
      oldLineNumber: i + 1,
      content: oldLines[i],
    });
    removed++;
    i++;
  }

  while (j < n) {
    lines.push({
      type: 'add',
      newLineNumber: j + 1,
      content: newLines[j],
    });
    added++;
    j++;
  }

  return { lines, added, removed, unchanged };
}
