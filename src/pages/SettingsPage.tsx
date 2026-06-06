import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

declare const CRIBL_API_URL: string;

const KV_KEY_PATH = 'anthropicApiKey';
const KV_MODEL_PATH = 'anthropicModel';

export const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Recommended)' },
  { id: 'claude-opus-4-5', label: 'Claude Opus 4.5 (Most capable)' },
  { id: 'claude-haiku-3-5', label: 'Claude Haiku 3.5 (Fastest)' },
];

export const DEFAULT_MODEL = ANTHROPIC_MODELS[0].id;

function kvUrl(path: string) {
  return `${CRIBL_API_URL}/kvstore/${path}`;
}

export async function getStoredModel(): Promise<string> {
  try {
    const r = await fetch(kvUrl(KV_MODEL_PATH));
    if (!r.ok) return DEFAULT_MODEL;
    const text = (await r.text()).trim();
    // Normalize: handle legacy values that were stored JSON-encoded ("claude-sonnet-4-5")
    try {
      const parsed = JSON.parse(text);
      return typeof parsed === 'string' ? parsed : DEFAULT_MODEL;
    } catch {
      return text || DEFAULT_MODEL;
    }
  } catch {
    return DEFAULT_MODEL;
  }
}

export async function hasApiKey(): Promise<boolean> {
  try {
    const r = await fetch(kvUrl(KV_KEY_PATH));
    return r.ok;
  } catch {
    return false;
  }
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [keyInput, setKeyInput] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [keyConfigured, setKeyConfigured] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    async function load() {
      const [configured, storedModel] = await Promise.all([hasApiKey(), getStoredModel()]);
      setKeyConfigured(configured);
      setModel(storedModel);
    }
    load();
  }, []);

  async function handleSave() {
    if (!keyInput.trim()) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const keyBody = keyInput.trim();
      const [keyRes, modelRes] = await Promise.all([
        fetch(kvUrl(KV_KEY_PATH), {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: keyBody,
        }),
        fetch(kvUrl(KV_MODEL_PATH), {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: model,
        }),
      ]);
      if (!keyRes.ok || !modelRes.ok) throw new Error('Failed to save settings.');
      setKeyConfigured(true);
      setKeyInput('');
      setSaveStatus('success');
      setSaveMessage('Settings saved.');
    } catch (e) {
      setSaveStatus('error');
      setSaveMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveModel() {
    setSaving(true);
    try {
      await fetch(kvUrl(KV_MODEL_PATH), {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: model,
      });
      setSaveStatus('success');
      setSaveMessage('Model preference saved.');
    } catch {
      setSaveStatus('error');
      setSaveMessage('Failed to save model.');
    } finally {
      setSaving(false);
    }
  }

  async function handleClearKey() {
    setSaving(true);
    try {
      await fetch(kvUrl(KV_KEY_PATH), { method: 'DELETE' });
      setKeyConfigured(false);
      setSaveStatus('success');
      setSaveMessage('API key removed.');
    } catch {
      setSaveStatus('error');
      setSaveMessage('Failed to remove key.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page settings-page">
      <div className="page-header">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h2 className="page-title" style={{ marginTop: '0.75rem' }}>Settings</h2>
        <p className="page-subtitle">Configure your Anthropic credentials for the AI Collector Builder.</p>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Anthropic API Key</h3>

        <div className="key-status-row">
          <span className={`key-status-badge ${keyConfigured ? 'key-status-badge--set' : 'key-status-badge--unset'}`}>
            {keyConfigured === null ? 'Checking…' : keyConfigured ? 'API key configured ✓' : 'No API key set'}
          </span>
          {keyConfigured && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleClearKey} disabled={saving}>
              Remove key
            </button>
          )}
        </div>

        <div className="form-field">
          <label className="form-label">{keyConfigured ? 'Replace API Key' : 'API Key'}</label>
          <div className="url-fetch-row">
            <input
              type="password"
              className="form-control"
              placeholder="sk-ant-api03-…"
              value={keyInput}
              onChange={e => { setKeyInput(e.target.value); setSaveStatus('idle'); }}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSave}
              disabled={saving || !keyInput.trim()}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <p className="form-hint">
            Stored securely in the Cribl KV store. The key is injected by the platform proxy — it never appears in browser requests.{' '}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="inline-link">
              Get a key ↗
            </a>
          </p>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Model</h3>
        <div className="form-field">
          <label className="form-label">Claude Model</label>
          <div className="url-fetch-row">
            <select
              className="form-control"
              value={model}
              onChange={e => { setModel(e.target.value); setSaveStatus('idle'); }}
            >
              {ANTHROPIC_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleSaveModel}
              disabled={saving}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {saveStatus === 'success' && (
        <p className="push-result push-result--success">{saveMessage}</p>
      )}
      {saveStatus === 'error' && (
        <p className="push-result push-result--error">{saveMessage}</p>
      )}
    </div>
  );
}
