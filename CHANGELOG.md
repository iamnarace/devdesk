# Changelog

## [1.0.1] - 2026-10-20

### Changed
- **URL Fragment & Query Parsing:** Fixed `parseQueryParams` so `#fragment` anchors (including fragments containing `?`) are stripped before query parameter extraction.
- **Bounded LCS Line Diff Engine:** Added `MAX_DIFF_LINES = 1500` and `MAX_DIFF_CHARS = 150_000` input bounds in `computeLineDiff` with a visible UI truncation warning banner to guard against $O(N \times M)$ memory/CPU spikes.
- **Build & Test Tooling:** Upgraded Vite to v6 and Vitest to v4 with exact diff boundary and URL fragment regression tests.

## [1.0.0] - 2026-10-20

### Added
- **JSON Studio:** Real-time JSON validation, 2/4/tab indentation, minification, recursive alphabetical key sorting, and structural stats (key count, depth, byte size).
- **Text & Config Diff:** Line-by-line Longest Common Subsequence (LCS) comparator with whitespace-ignore mode.
- **UTF-8 Base64 Codec:** Full multi-byte UTF-8 and RFC 4648 URL-safe Base64 encoding and decoding.
- **URL & Query Parser:** URI component encoding/decoding and automatic query string key-value table extraction.
- **Bulk UUID v4 Generator:** Cryptographic RFC 4122 v4 UUID batch generator with hyphen, uppercase, and brace toggles.
- **Epoch & ISO Clock:** Bi-directional Unix epoch (seconds/milliseconds) and ISO-8601 UTC timestamp converter.
