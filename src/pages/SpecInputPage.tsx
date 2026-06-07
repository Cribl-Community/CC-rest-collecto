import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWizard } from '../context/WizardContext';
import { parseSpec } from '../utils/parseSpec';
import type { ParsedSpec } from '../context/WizardContext';

type LoadSource = { kind: 'file'; name: string; size: number } | { kind: 'url'; url: string };

export function SpecInputPage() {
  const { rawSpec, setRawSpec, setParsedSpec, setPreserveConfig } = useWizard();
  const [searchParams] = useSearchParams();
  const preserve = searchParams.get('preserve') === 'true';

  // paste text (small specs)
  const [pasteText, setPasteText] = useState(rawSpec);
  const [pasteError, setPasteError] = useState<string | null>(null);

  // url fetch
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  // file / url loaded state (avoids putting huge text in textarea)
  const [loadedSource, setLoadedSource] = useState<LoadSource | null>(null);
  const [loadedError, setLoadedError] = useState<string | null>(null);

  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  function applyParsed(parsed: ParsedSpec) {
    if (parsed.operations.length === 0) {
      throw new Error('No API operations found in this spec. Make sure it contains paths.');
    }
    setParsedSpec(parsed);
    if (preserve) setPreserveConfig(true);
    navigate('/endpoint');
  }

  // ── File ──────────────────────────────────────────────────────────────────

  function handleFile(file: File) {
    if (!file) return;
    setLoadedError(null);
    setLoadedSource(null);
    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result as string ?? '';
      try {
        const parsed = parseSpec(content);
        // Don't store huge text in state — just store metadata + parsed result
        setRawSpec(''); // clear any previous paste
        applyParsed(parsed);
      } catch (err) {
        setLoadedSource({ kind: 'file', name: file.name, size: file.size });
        setLoadedError((err as Error).message);
      }
    };
    reader.onerror = () => setLoadedError('Failed to read file.');
    reader.readAsText(file);
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  // ── URL fetch ─────────────────────────────────────────────────────────────

  async function handleFetchUrl() {
    const trimmed = url.trim();
    if (!trimmed) { setUrlError('Please enter a URL.'); return; }
    setUrlError(null);
    setLoadedError(null);
    setLoadedSource(null);
    setFetching(true);
    try {
      // In dev mode (no Cribl platform proxy) route through the Vite dev server
      // to avoid CORS issues. In production Cribl auto-proxies external fetch() calls.
      const fetchUrl = import.meta.env.DEV
        ? `/spec-proxy?url=${encodeURIComponent(trimmed)}`
        : trimmed;

      const resp = await fetch(fetchUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const text = await resp.text();
      const parsed = parseSpec(text);
      setRawSpec('');
      setLoadedSource({ kind: 'url', url: trimmed });
      applyParsed(parsed);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setUrlError(`Could not fetch URL. Try downloading the file and uploading it instead.`);
      } else {
        setUrlError(msg);
      }
    } finally {
      setFetching(false);
    }
  }

  // ── Paste parse ────────────────────────────────────────────────────────────

  function handleParsePaste() {
    const spec = pasteText.trim();
    if (!spec) { setPasteError('Please paste a spec first.'); return; }
    try {
      const parsed = parseSpec(spec);
      setRawSpec(spec);
      applyParsed(parsed);
    } catch (err) {
      setPasteError((err as Error).message);
    }
  }

  const EXAMPLE_URLS = [
    { label: 'Petstore (OpenAPI 3)', url: 'https://petstore3.swagger.io/api/v3/openapi.json' },
    { label: 'OpenAI', url: 'https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml' },
    { label: 'GitHub REST API (~12 MB)', url: 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Import OpenAPI Spec</h2>
        <p className="page-subtitle">
          Load an OpenAPI 2.x or 3.x spec (JSON or YAML) by URL, file, or paste.
        </p>
      </div>

      {/* ── URL fetch ── */}
      <div className="import-section">
        <h3 className="import-section-label">From URL</h3>
        <div className="url-fetch-row">
          <input
            type="url"
            className={`form-control url-input${urlError ? ' form-control--error' : ''}`}
            placeholder="https://api.example.com/openapi.json"
            value={url}
            onChange={e => { setUrl(e.target.value); setUrlError(null); }}
            onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
            aria-label="OpenAPI spec URL"
            disabled={fetching}
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleFetchUrl}
            disabled={fetching || !url.trim()}
          >
            {fetching ? (
              <><span className="spinner" aria-hidden="true" /> Fetching…</>
            ) : 'Fetch'}
          </button>
        </div>
        {urlError && <p className="page-error">{urlError}</p>}
        <div className="example-urls">
          {EXAMPLE_URLS.map(ex => (
            <button
              key={ex.url}
              type="button"
              className="example-url-btn"
              onClick={() => setUrl(ex.url)}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <div className="spec-divider"><span>or upload a file</span></div>

      {/* ── Drop zone ── */}
      <div
        className={`drop-zone${dragging ? ' drop-zone--active' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
        aria-label="Drop zone for OpenAPI spec file"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".json,.yaml,.yml"
          onChange={handleFileInput}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
        <svg className="drop-zone-icon" width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path d="M20 8v16M14 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 28h24v4H8z" fill="currentColor" opacity=".15"/>
          <path d="M8 28h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <p className="drop-zone-text">
          <strong>Drop a .json or .yaml file here</strong>
          <span> or click to browse</span>
        </p>
      </div>
      {loadedError && <p className="page-error">{loadedError}</p>}
      {loadedSource && !loadedError && (
        <div className="loaded-banner">
          {loadedSource.kind === 'file' ? (
            <>
              <span className="loaded-icon">📄</span>
              <strong>{loadedSource.name}</strong>
              <span className="loaded-meta">({(loadedSource.size / 1024).toFixed(0)} KB)</span>
            </>
          ) : (
            <>
              <span className="loaded-icon">🔗</span>
              <code>{loadedSource.url}</code>
            </>
          )}
        </div>
      )}

      <div className="spec-divider"><span>or paste below</span></div>

      {/* ── Paste ── */}
      <div className="import-section">
        <textarea
          className={`spec-textarea form-control${pasteError ? ' form-control--error' : ''}`}
          value={pasteText}
          onChange={e => { setPasteText(e.target.value); setPasteError(null); }}
          placeholder={'{\n  "openapi": "3.0.0",\n  "info": { "title": "My API", "version": "1.0.0" },\n  "paths": { ... }\n}'}
          spellCheck={false}
          aria-label="OpenAPI spec text"
        />
        {pasteError && <p className="page-error">{pasteError}</p>}
        <div className="page-actions" style={{ paddingTop: '0.5rem', borderTop: 'none' }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleParsePaste}
            disabled={!pasteText.trim()}
          >
            Parse &amp; Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
