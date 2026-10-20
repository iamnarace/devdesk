import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  processJsonInput,
  encodeBase64Utf8,
  decodeBase64Utf8,
  encodeUrlString,
  decodeUrlString,
  parseQueryParams,
  generateUuidBatch,
  inspectTimestampInput,
  computeLineDiff,
  MAX_DIFF_LINES,
  MAX_DIFF_CHARS,
} from '../utils/devTools';
import App from '../App';

describe('DevDesk Developer Utilities Suite', () => {
  it('validates, formats, minifies, and sorts JSON payloads accurately', () => {
    const raw = '{"z":1,"a":{"d":4,"c":3}}';
    const sorted = processJsonInput(raw, { indent: 'minify', sortKeys: true });
    expect(sorted.valid).toBe(true);
    expect(sorted.output).toBe('{"a":{"c":3,"d":4},"z":1}');
    expect(sorted.stats?.keysCount).toBe(4);

    const invalid = processJsonInput('{bad json', { indent: 2, sortKeys: false });
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toBeTruthy();
  });

  it('encodes and decodes UTF-8 and URL-safe Base64 without data loss', () => {
    const text = 'DevDesk ✓ Rocket — payload?a=1&b=2';
    const encoded = encodeBase64Utf8(text, false);
    expect(decodeBase64Utf8(encoded)).toBe(text);

    const urlSafe = encodeBase64Utf8(text, true);
    expect(urlSafe).not.toContain('+');
    expect(urlSafe).not.toContain('/');
    expect(decodeBase64Utf8(urlSafe)).toBe(text);
  });

  it('encodes/decodes URLs and extracts query parameters cleanly across fragments, repeated keys, and encoded values', () => {
    const encoded = encodeUrlString('filter=status:active&sort=desc');
    expect(decodeUrlString(encoded)).toBe('filter=status:active&sort=desc');

    // Standard URL with query string
    const params = parseQueryParams('https://example.com/api?env=prod&limit=50');
    expect(params).toEqual([
      { key: 'env', value: 'prod' },
      { key: 'limit', value: '50' },
    ]);

    // Regression: URL with #fragment must not include fragment in final query value
    const withFragment = parseQueryParams(
      'https://example.com/path?foo=bar&baz=1#section-2'
    );
    expect(withFragment).toEqual([
      { key: 'foo', value: 'bar' },
      { key: 'baz', value: '1' },
    ]);

    // URLs without query strings (with and without fragments)
    expect(parseQueryParams('https://example.com/api/v1/users')).toEqual([]);
    expect(parseQueryParams('https://example.com/api/v1/users#overview?fake=1')).toEqual([]);
    expect(parseQueryParams('/local/path/only')).toEqual([]);

    // Repeated parameters & percent/+ encoded values with fragment
    const complexParams = parseQueryParams(
      'https://example.com/search?tag=alpha&tag=beta&q=rust+wasm&filter=a%26b%3Dc#results?ignored=1'
    );
    expect(complexParams).toEqual([
      { key: 'tag', value: 'alpha' },
      { key: 'tag', value: 'beta' },
      { key: 'q', value: 'rust wasm' },
      { key: 'filter', value: 'a&b=c' },
    ]);

    // Raw query string with empty parameter value and trailing fragment
    expect(parseQueryParams('?empty=&key=val#anchor')).toEqual([
      { key: 'empty', value: '' },
      { key: 'key', value: 'val' },
    ]);
  });

  it('generates valid RFC 4122 v4 UUID batches with custom formatting', () => {
    const standard = generateUuidBatch({
      count: 5,
      uppercase: false,
      hyphens: true,
      braces: false,
    });
    expect(standard).toHaveLength(5);
    expect(standard[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );

    const compactUpper = generateUuidBatch({
      count: 2,
      uppercase: true,
      hyphens: false,
      braces: true,
    });
    expect(compactUpper[0]).toMatch(/^\{[0-9A-F]{32}\}$/);
  });

  it('converts Unix timestamps in seconds and milliseconds and ISO strings', () => {
    const resSec = inspectTimestampInput('1700000000', 1700003600000);
    expect(resSec.valid).toBe(true);
    expect(resSec.epochSeconds).toBe(1700000000);
    expect(resSec.isoUtc).toBe('2023-11-14T22:13:20.000Z');
    expect(resSec.relativeDescription).toBe('1 hour ago');
  });

  it('computes accurate LCS line-by-line diffs and guards against pathological input sizes', () => {
    const oldTxt = 'alpha\nbeta\ngamma';
    const newTxt = 'alpha\nbeta-updated\ngamma\ndelta';
    const diff = computeLineDiff(oldTxt, newTxt);
    expect(diff.unchanged).toBe(2);
    expect(diff.removed).toBe(1);
    expect(diff.added).toBe(2);
    expect(diff.truncated).toBe(false);
    expect(diff.limitWarning).toBeUndefined();

    // Exact boundary tests for MAX_DIFF_LINES (1500) and MAX_DIFF_CHARS (150,000)
    const exactLimitLines = Array.from({ length: MAX_DIFF_LINES }, (_, i) => `row-${i}`).join('\n');
    const exactDiff = computeLineDiff(exactLimitLines, exactLimitLines);
    expect(exactDiff.truncated).toBe(false);
    expect(exactDiff.limitWarning).toBeUndefined();
    expect(exactDiff.unchanged).toBe(MAX_DIFF_LINES);

    const oneOverLimitLines = Array.from({ length: MAX_DIFF_LINES + 1 }, (_, i) => `row-${i}`).join('\n');
    const overLineDiff = computeLineDiff(oneOverLimitLines, exactLimitLines);
    expect(overLineDiff.truncated).toBe(true);
    expect(overLineDiff.limitWarning).toMatch(/1,500 lines/i);

    const exactChars = 'a'.repeat(MAX_DIFF_CHARS);
    expect(computeLineDiff(exactChars, exactChars).truncated).toBe(false);

    const oneOverChars = 'a'.repeat(MAX_DIFF_CHARS + 1);
    const overCharDiff = computeLineDiff(oneOverChars, exactChars);
    expect(overCharDiff.truncated).toBe(true);
    expect(overCharDiff.limitWarning).toMatch(/150 KB/i);

    // Pathological line count (> 1500 lines) is safely bounded and surfaces a clear warning
    const hugeOld = Array.from({ length: 2200 }, (_, i) => `line-${i}`).join('\n');
    const hugeNew = Array.from({ length: 2200 }, (_, i) =>
      i === 500 ? 'line-500-modified' : `line-${i}`
    ).join('\n');
    const bounded = computeLineDiff(hugeOld, hugeNew);
    expect(bounded.truncated).toBe(true);
    expect(bounded.limitWarning).toMatch(/exceeds the safe synchronous diff limit/i);
    expect(bounded.removed).toBe(1);
    expect(bounded.added).toBe(1);
  });

  it('renders the DevDesk UI and navigates across all 6 developer tools', () => {
    render(<App />);
    expect(screen.getByText('DevDesk')).toBeInTheDocument();
    expect(
      screen.getByText(/JSON Formatter, Validator & Key Sorter/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Text & Config Diff/i }));
    expect(
      screen.getByText(/Line-by-Line Text & Config Comparator/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /UUID v4 Generator/i }));
    expect(screen.getByText(/Bulk RFC 4122 UUID v4 Generator/i)).toBeInTheDocument();
  });
});
