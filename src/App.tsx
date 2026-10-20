import { useState, useEffect, useMemo } from 'react';
import {
  Terminal,
  Braces,
  Binary,
  Link2,
  Fingerprint,
  Clock,
  GitCompare,
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Shield,
  RefreshCw,
} from 'lucide-react';
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
} from './utils/devTools';

type ToolId = 'json' | 'base64' | 'url' | 'uuid' | 'timestamp' | 'diff';

const SAMPLE_JSON = JSON.stringify(
  {
    service: 'devdesk-gateway',
    version: '2.4.0',
    region: 'ap-southeast-2',
    features: {
      zeroTelemetry: true,
      localExecution: true,
      maxConcurrency: 64,
    },
    endpoints: [
      { path: '/v1/health', method: 'GET', rateLimitRpm: 1200 },
      { path: '/v1/transform', method: 'POST', rateLimitRpm: 300 },
    ],
  },
  null,
  2
);

const SAMPLE_DIFF_OLD = `server {
  listen 8080;
  server_name api.internal.local;
  read_timeout 30s;
  gzip off;
  location /healthz {
    return 200 "ok";
  }
}`;

const SAMPLE_DIFF_NEW = `server {
  listen 8443 ssl http2;
  server_name api.internal.local;
  read_timeout 60s;
  gzip on;
  location /healthz {
    return 200 "healthy";
  }
  location /metrics {
    allow 10.0.0.0/8;
  }
}`;

export function App() {
  const [activeTool, setActiveTool] = useState<ToolId>('json');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. JSON State
  const [jsonInput, setJsonInput] = useState<string>(SAMPLE_JSON);
  const [jsonIndent, setJsonIndent] = useState<number | 'tab' | 'minify'>(2);
  const [jsonSortKeys, setJsonSortKeys] = useState<boolean>(false);

  // 2. Base64 State
  const [b64Mode, setB64Mode] = useState<'encode' | 'decode'>('encode');
  const [b64UrlSafe, setB64UrlSafe] = useState<boolean>(false);
  const [b64Input, setB64Input] = useState<string>(
    '{"alg":"HS256","typ":"JWT","sub":"usr_94810","scope":"read:diagnostics"}'
  );

  // 3. URL State
  const [urlMode, setUrlMode] = useState<'decode' | 'encode'>('decode');
  const [urlInput, setUrlInput] = useState<string>(
    'https://api.example.com/v2/search?q=rust+wasm+runtime&limit=25&filter=status%3Aactive&sort=desc'
  );

  // 4. UUID State
  const [uuidCount, setUuidCount] = useState<number>(8);
  const [uuidUppercase, setUuidUppercase] = useState<boolean>(false);
  const [uuidHyphens, setUuidHyphens] = useState<boolean>(true);
  const [uuidBraces, setUuidBraces] = useState<boolean>(false);
  const [uuidList, setUuidList] = useState<string[]>(() =>
    generateUuidBatch({ count: 8, uppercase: false, hyphens: true, braces: false })
  );

  // 5. Timestamp State
  const [tsInput, setTsInput] = useState<string>('1792454400');

  // 6. Diff State
  const [diffOld, setDiffOld] = useState<string>(SAMPLE_DIFF_OLD);
  const [diffNew, setDiffNew] = useState<string>(SAMPLE_DIFF_NEW);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState<boolean>(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tool = params.get('tool') as ToolId | null;
    if (
      tool &&
      ['json', 'base64', 'url', 'uuid', 'timestamp', 'diff'].includes(tool)
    ) {
      setActiveTool(tool);
    }
  }, []);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for headless or restricted clipboard environments
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
  };

  // Derived computations
  const jsonResult = useMemo(
    () => processJsonInput(jsonInput, { indent: jsonIndent, sortKeys: jsonSortKeys }),
    [jsonInput, jsonIndent, jsonSortKeys]
  );

  const b64Result = useMemo(() => {
    if (!b64Input.trim()) return { ok: true, output: '', error: '' };
    try {
      const output =
        b64Mode === 'encode'
          ? encodeBase64Utf8(b64Input, b64UrlSafe)
          : decodeBase64Utf8(b64Input);
      return { ok: true, output, error: '' };
    } catch (err) {
      return {
        ok: false,
        output: '',
        error:
          err instanceof Error
            ? err.message
            : 'Malformed Base64 or invalid UTF-8 byte sequence.',
      };
    }
  }, [b64Input, b64Mode, b64UrlSafe]);

  const urlResult = useMemo(() => {
    if (!urlInput.trim()) return { ok: true, output: '', params: [], error: '' };
    try {
      const output =
        urlMode === 'encode' ? encodeUrlString(urlInput) : decodeUrlString(urlInput);
      const params = parseQueryParams(urlInput);
      return { ok: true, output, params, error: '' };
    } catch (err) {
      return {
        ok: false,
        output: '',
        params: [],
        error: err instanceof Error ? err.message : 'Malformed URI component.',
      };
    }
  }, [urlInput, urlMode]);

  const regenerateUuids = (
    nextCount = uuidCount,
    nextUpper = uuidUppercase,
    nextHyphens = uuidHyphens,
    nextBraces = uuidBraces
  ) => {
    setUuidList(
      generateUuidBatch({
        count: nextCount,
        uppercase: nextUpper,
        hyphens: nextHyphens,
        braces: nextBraces,
      })
    );
  };

  const tsResult = useMemo(() => inspectTimestampInput(tsInput), [tsInput]);

  const diffResult = useMemo(
    () => computeLineDiff(diffOld, diffNew, { ignoreTrimWhitespace: ignoreWhitespace }),
    [diffOld, diffNew, ignoreWhitespace]
  );

  const navItems: Array<{
    id: ToolId;
    label: string;
    shortDesc: string;
    icon: typeof Braces;
  }> = [
    {
      id: 'json',
      label: 'JSON Studio',
      shortDesc: 'Format, validate, sort & minify',
      icon: Braces,
    },
    {
      id: 'diff',
      label: 'Text & Config Diff',
      shortDesc: 'LCS line-by-line comparison',
      icon: GitCompare,
    },
    {
      id: 'base64',
      label: 'Base64 Codec',
      shortDesc: 'UTF-8 & RFC 4648 URL-safe',
      icon: Binary,
    },
    {
      id: 'url',
      label: 'URL & Query Parser',
      shortDesc: 'URI encode/decode & query table',
      icon: Link2,
    },
    {
      id: 'uuid',
      label: 'UUID v4 Generator',
      shortDesc: 'Bulk cryptographic RFC 4122 IDs',
      icon: Fingerprint,
    },
    {
      id: 'timestamp',
      label: 'Epoch & ISO Clock',
      shortDesc: 'Unix sec/ms & UTC converter',
      icon: Clock,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shadow-inner">
              <Terminal className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-lg font-bold tracking-tight text-white">
                  DevDesk
                </h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                  v1.0.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                High-speed, offline-first developer inspection & encoding console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/70">
              <Shield className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              Zero Telemetry • Local Execution
            </span>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar Tool Selector */}
        <aside className="lg:col-span-3 space-y-1.5" aria-label="Developer tools navigation">
          <p className="px-3 text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            Workbenches (6)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTool(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                    active
                      ? 'bg-cyan-950/60 border-cyan-500/60 text-white shadow-sm'
                      : 'bg-slate-900/50 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      active ? 'text-cyan-400' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{item.label}</div>
                    <div className="text-[11px] text-slate-400 truncate hidden sm:block">
                      {item.shortDesc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Active Tool Panel */}
        <main className="lg:col-span-9 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
          {/* 1. JSON STUDIO */}
          {activeTool === 'json' && (
            <section aria-labelledby="json-title" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 id="json-title" className="text-xl font-bold text-white flex items-center gap-2">
                    <Braces className="w-5 h-5 text-cyan-400" />
                    JSON Formatter, Validator & Key Sorter
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Validate syntax in real time, normalize indentation, minify payloads, or sort object keys alphabetically.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setJsonInput(SAMPLE_JSON)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Sample Payload
                  </button>
                  <button
                    type="button"
                    onClick={() => setJsonInput('')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </div>
              </div>

              {/* Controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="json-indent" className="text-xs font-mono text-slate-400">
                    Format Mode:
                  </label>
                  <select
                    id="json-indent"
                    value={String(jsonIndent)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setJsonIndent(
                        val === 'minify' ? 'minify' : val === 'tab' ? 'tab' : Number(val)
                      );
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-100"
                  >
                    <option value="2">2 Spaces</option>
                    <option value="4">4 Spaces</option>
                    <option value="tab">Tab Indented</option>
                    <option value="minify">Minified (Single Line)</option>
                  </select>

                  <label className="inline-flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jsonSortKeys}
                      onChange={(e) => setJsonSortKeys(e.target.checked)}
                      className="rounded accent-cyan-400"
                    />
                    Sort Keys Alphabetically
                  </label>
                </div>

                {jsonResult.valid && jsonResult.stats && (
                  <div className="flex items-center gap-3 text-xs font-mono text-emerald-400">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Valid JSON
                    </span>
                    <span className="text-slate-400">•</span>
                    <span>{jsonResult.stats.keysCount} keys</span>
                    <span className="text-slate-400">•</span>
                    <span>Depth {jsonResult.stats.depth}</span>
                    <span className="text-slate-400">•</span>
                    <span>{jsonResult.stats.byteSize} B</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="json-raw-input"
                    className="block text-xs font-mono uppercase text-slate-400 mb-1.5"
                  >
                    Raw JSON Input
                  </label>
                  <textarea
                    id="json-raw-input"
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    rows={14}
                    spellCheck={false}
                    className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-slate-100 focus:outline-none focus:border-cyan-500"
                    placeholder="Paste JSON here..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="json-formatted-output"
                      className="text-xs font-mono uppercase text-slate-400"
                    >
                      Processed Output
                    </label>
                    <button
                      type="button"
                      disabled={!jsonResult.valid}
                      onClick={() => handleCopy(jsonResult.output, 'json-out')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 disabled:opacity-40 cursor-pointer"
                    >
                      {copiedKey === 'json-out' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Output
                        </>
                      )}
                    </button>
                  </div>

                  {jsonResult.valid ? (
                    <textarea
                      id="json-formatted-output"
                      readOnly
                      value={jsonResult.output}
                      rows={14}
                      spellCheck={false}
                      className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-cyan-200"
                    />
                  ) : (
                    <div
                      role="alert"
                      className="h-[318px] rounded-xl bg-rose-950/30 border border-rose-800/70 p-4 text-rose-200 font-mono text-xs flex flex-col justify-center items-start gap-2"
                    >
                      <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        JSON Parse Error
                      </div>
                      <p className="leading-relaxed break-all">{jsonResult.error}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 2. TEXT & CONFIG DIFF */}
          {activeTool === 'diff' && (
            <section aria-labelledby="diff-title" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 id="diff-title" className="text-xl font-bold text-white flex items-center gap-2">
                    <GitCompare className="w-5 h-5 text-cyan-400" />
                    Line-by-Line Text & Config Comparator
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Compute exact Longest Common Subsequence (LCS) line diffs with addition, deletion, and unchanged counters.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ignoreWhitespace}
                      onChange={(e) => setIgnoreWhitespace(e.target.checked)}
                      className="rounded accent-cyan-400"
                    />
                    Ignore Leading/Trailing Whitespace
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDiffOld(SAMPLE_DIFF_OLD);
                      setDiffNew(SAMPLE_DIFF_NEW);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                  >
                    Reset Sample Diff
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="diff-old" className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                    Original Text (Base)
                  </label>
                  <textarea
                    id="diff-old"
                    rows={7}
                    value={diffOld}
                    onChange={(e) => setDiffOld(e.target.value)}
                    spellCheck={false}
                    className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200"
                  />
                </div>
                <div>
                  <label htmlFor="diff-new" className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                    Modified Text (Target)
                  </label>
                  <textarea
                    id="diff-new"
                    rows={7}
                    value={diffNew}
                    onChange={(e) => setDiffNew(e.target.value)}
                    spellCheck={false}
                    className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200"
                  />
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">UNIFIED DIFF OUTPUT</span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400">+{diffResult.added} added</span>
                    <span className="text-rose-400">-{diffResult.removed} removed</span>
                    <span className="text-slate-400">{diffResult.unchanged} unchanged</span>
                  </div>
                </div>
                <div className="divide-y divide-slate-900 max-h-80 overflow-y-auto font-mono text-xs">
                  {diffResult.lines.map((line, idx) => (
                    <div
                      key={idx}
                      className={`px-4 py-1 flex items-start gap-3 ${
                        line.type === 'add'
                          ? 'bg-emerald-950/40 text-emerald-200'
                          : line.type === 'remove'
                          ? 'bg-rose-950/40 text-rose-200'
                          : 'text-slate-400'
                      }`}
                    >
                      <span className="w-8 text-right text-slate-600 select-none shrink-0">
                        {line.oldLineNumber ?? ''}
                      </span>
                      <span className="w-8 text-right text-slate-600 select-none shrink-0">
                        {line.newLineNumber ?? ''}
                      </span>
                      <span className="w-4 font-bold select-none shrink-0">
                        {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                      </span>
                      <span className="whitespace-pre-wrap break-all">{line.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 3. BASE64 CODEC */}
          {activeTool === 'base64' && (
            <section aria-labelledby="b64-title" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 id="b64-title" className="text-xl font-bold text-white flex items-center gap-2">
                    <Binary className="w-5 h-5 text-cyan-400" />
                    UTF-8 Base64 Encoder & Decoder
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Convert multi-byte UTF-8 strings to and from Base64 or RFC 4648 URL-safe Base64.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setB64Mode('encode')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                      b64Mode === 'encode'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Encode to Base64
                  </button>
                  <button
                    type="button"
                    onClick={() => setB64Mode('decode')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                      b64Mode === 'decode'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Decode from Base64
                  </button>
                </div>
              </div>

              {b64Mode === 'encode' && (
                <label className="inline-flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={b64UrlSafe}
                    onChange={(e) => setB64UrlSafe(e.target.checked)}
                    className="rounded accent-cyan-400"
                  />
                  Use URL-Safe Alphabet (- and _ without = padding)
                </label>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="b64-input" className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                    {b64Mode === 'encode' ? 'Plain UTF-8 Text Input' : 'Base64 String Input'}
                  </label>
                  <textarea
                    id="b64-input"
                    rows={5}
                    value={b64Input}
                    onChange={(e) => setB64Input(e.target.value)}
                    spellCheck={false}
                    className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-slate-100"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="b64-output" className="text-xs font-mono uppercase text-slate-400">
                      Result
                    </label>
                    <button
                      type="button"
                      disabled={!b64Result.ok || !b64Result.output}
                      onClick={() => handleCopy(b64Result.output, 'b64-out')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 disabled:opacity-40 cursor-pointer"
                    >
                      {copiedKey === 'b64-out' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Result
                        </>
                      )}
                    </button>
                  </div>

                  {b64Result.ok ? (
                    <textarea
                      id="b64-output"
                      readOnly
                      rows={5}
                      value={b64Result.output}
                      className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-cyan-200"
                    />
                  ) : (
                    <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800 text-rose-200 text-xs font-mono">
                      {b64Result.error}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 4. URL & QUERY PARSER */}
          {activeTool === 'url' && (
            <section aria-labelledby="url-title" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 id="url-title" className="text-xl font-bold text-white flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-cyan-400" />
                    URL Encoder, Decoder & Query Parameter Inspector
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Encode or decode URI components and automatically extract URL query parameters into a structured table.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUrlMode('decode')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                      urlMode === 'decode'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Decode URI
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrlMode('encode')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                      urlMode === 'encode'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Encode URI
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="url-input" className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                  URL or Query String Input
                </label>
                <textarea
                  id="url-input"
                  rows={3}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  spellCheck={false}
                  className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono uppercase text-slate-400">
                    {urlMode === 'encode' ? 'Encoded Output' : 'Decoded Output'}
                  </span>
                  <button
                    type="button"
                    disabled={!urlResult.ok}
                    onClick={() => handleCopy(urlResult.output, 'url-out')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 cursor-pointer"
                  >
                    {copiedKey === 'url-out' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </>
                    )}
                  </button>
                </div>

                {urlResult.ok ? (
                  <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200 whitespace-pre-wrap break-all">
                    {urlResult.output}
                  </pre>
                ) : (
                  <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800 text-xs font-mono text-rose-200">
                    {urlResult.error}
                  </div>
                )}
              </div>

              {urlResult.params.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
                    PARSED QUERY PARAMETERS ({urlResult.params.length})
                  </div>
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-4">Key</th>
                        <th className="py-2 px-4">Decoded Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {urlResult.params.map((item, i) => (
                        <tr key={`${item.key}-${i}`}>
                          <td className="py-2 px-4 text-cyan-300 font-semibold">{item.key}</td>
                          <td className="py-2 px-4 text-slate-200 break-all">{item.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* 5. UUID GENERATOR */}
          {activeTool === 'uuid' && (
            <section aria-labelledby="uuid-title" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 id="uuid-title" className="text-xl font-bold text-white flex items-center gap-2">
                    <Fingerprint className="w-5 h-5 text-cyan-400" />
                    Bulk RFC 4122 UUID v4 Generator
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generate cryptographically random v4 UUIDs using Web Crypto API with customizable formatting.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => regenerateUuids()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate Batch
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(uuidList.join('\n'), 'uuid-all')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                  >
                    {copiedKey === 'uuid-all' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied All
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy All ({uuidList.length})
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <label htmlFor="uuid-count" className="text-slate-400">
                    Batch Size:
                  </label>
                  <input
                    id="uuid-count"
                    type="number"
                    min={1}
                    max={50}
                    value={uuidCount}
                    onChange={(e) => {
                      const next = Number(e.target.value) || 1;
                      setUuidCount(next);
                      regenerateUuids(next, uuidUppercase, uuidHyphens, uuidBraces);
                    }}
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
                  />
                </div>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uuidHyphens}
                    onChange={(e) => {
                      setUuidHyphens(e.target.checked);
                      regenerateUuids(uuidCount, uuidUppercase, e.target.checked, uuidBraces);
                    }}
                    className="accent-cyan-400"
                  />
                  Hyphens
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uuidUppercase}
                    onChange={(e) => {
                      setUuidUppercase(e.target.checked);
                      regenerateUuids(uuidCount, e.target.checked, uuidHyphens, uuidBraces);
                    }}
                    className="accent-cyan-400"
                  />
                  UPPERCASE
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uuidBraces}
                    onChange={(e) => {
                      setUuidBraces(e.target.checked);
                      regenerateUuids(uuidCount, uuidUppercase, uuidHyphens, e.target.checked);
                    }}
                    className="accent-cyan-400"
                  />
                  {'{Braces}'}
                </label>
              </div>

              <ul className="divide-y divide-slate-800/80 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                {uuidList.map((id, idx) => (
                  <li
                    key={`${id}-${idx}`}
                    className="px-4 py-2.5 flex items-center justify-between font-mono text-xs hover:bg-slate-900/60"
                  >
                    <span className="text-cyan-200 select-all">{id}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(id, `uuid-${idx}`)}
                      className="text-slate-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === `uuid-${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 6. TIMESTAMP CONVERTER */}
          {activeTool === 'timestamp' && (
            <section aria-labelledby="ts-title" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 id="ts-title" className="text-xl font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    Unix Epoch & ISO-8601 Timestamp Converter
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Convert seamlessly between Unix seconds, milliseconds, and UTC / ISO-8601 dates.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setTsInput(String(Math.floor(Date.now() / 1000)))}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 cursor-pointer"
                >
                  Use Current Epoch
                </button>
              </div>

              <div>
                <label htmlFor="ts-input" className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                  Timestamp or ISO Date Input
                </label>
                <input
                  id="ts-input"
                  type="text"
                  value={tsInput}
                  onChange={(e) => setTsInput(e.target.value)}
                  className="w-full font-mono text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100"
                  placeholder="e.g. 1792454400 or 2026-10-20T00:00:00Z"
                />
              </div>

              {tsResult.valid ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 uppercase">Unix Epoch (Seconds)</div>
                    <div className="text-lg font-bold text-cyan-300 mt-1">
                      {tsResult.epochSeconds}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 uppercase">
                      Unix Epoch (Milliseconds)
                    </div>
                    <div className="text-lg font-bold text-cyan-300 mt-1">
                      {tsResult.epochMilliseconds}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 uppercase">ISO-8601 (UTC)</div>
                    <div className="text-sm font-semibold text-slate-100 mt-1">
                      {tsResult.isoUtc}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 uppercase">
                      Calendar Metadata
                    </div>
                    <div className="text-sm text-slate-200 mt-1">
                      Day {tsResult.dayOfYear} of year •{' '}
                      {tsResult.isLeapYear ? 'Leap Year' : 'Standard Year'} (
                      {tsResult.relativeDescription})
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800 text-xs font-mono text-rose-200">
                  {tsResult.error}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-5 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <div>
            DevDesk executes all formatting, diffing, and cryptographic ID generation in local browser memory.
          </div>
          <div>DevDesk v1.0.0 • MIT License</div>
        </div>
      </footer>
    </div>
  );
}

export default App;
