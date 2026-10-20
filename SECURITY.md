# Security & Privacy Policy

## Local Execution Architecture

**DevDesk** is engineered for developers working with sensitive payloads (JWT segments, configuration files, API responses, and query strings):

- **Zero External Network Calls:** Every transformation—JSON formatting, Base64 encoding, URL parsing, UUID generation, timestamp conversion, and LCS text diffing—runs synchronously in your browser's JavaScript engine.
- **Cryptographic Randomness:** UUID v4 generation uses the browser's native `crypto.randomUUID()` / `crypto.getRandomValues()` Web Crypto API.

## Reporting a Vulnerability

If you discover a security issue in DevDesk, please open an issue or security advisory on `https://github.com/iamnarace/devdesk`.
