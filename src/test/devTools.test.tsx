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

  it('encodes/decodes URLs and extracts query parameters', () => {
    const encoded = encodeUrlString('filter=status:active&sort=desc');
    expect(decodeUrlString(encoded)).toBe('filter=status:active&sort=desc');

    const params = parseQueryParams('https://example.com/api?env=prod&limit=50');
    expect(params).toEqual([
      { key: 'env', value: 'prod' },
      { key: 'limit', value: '50' },
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

  it('computes accurate LCS line-by-line diffs', () => {
    const oldTxt = 'alpha\nbeta\ngamma';
    const newTxt = 'alpha\nbeta-updated\ngamma\ndelta';
    const diff = computeLineDiff(oldTxt, newTxt);
    expect(diff.unchanged).toBe(2);
    expect(diff.removed).toBe(1);
    expect(diff.added).toBe(2);
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
