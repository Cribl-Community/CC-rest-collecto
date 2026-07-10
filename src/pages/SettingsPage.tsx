import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ANTHROPIC_MODELS, DEFAULT_MODEL, getStoredModel, hasApiKey,
  BEDROCK_MODELS, DEFAULT_BEDROCK_MODEL, BEDROCK_REGIONS,
  getStoredProvider, saveProvider, getStoredBedrockCreds, saveBedrockCreds, clearBedrockCreds, hasBedrockCreds,
  type AIProvider,
} from '../utils/settings';

declare const CRIBL_API_URL: string;

const KV_KEY_PATH = 'anthropicApiKey';
const KV_MODEL_PATH = 'anthropicModel';

function kvUrl(path: string) {
  return `${CRIBL_API_URL}/kvstore/${path}`;
}

export function SettingsPage() {
  const navigate = useNavigate();

  // Provider
  const [provider, setProvider] = useState<AIProvider>('anthropic');

  // Anthropic
  const [keyInput, setKeyInput] = useState('');
  const [anthropicModel, setAnthropicModel] = useState(DEFAULT_MODEL);
  const [keyConfigured, setKeyConfigured] = useState<boolean | null>(null);

  // Bedrock
  const [bedrockRegion, setBedrockRegion] = useState('us-east-1');
  const [bedrockAccessKeyId, setBedrockAccessKeyId] = useState('');
  const [bedrockSecretAccessKey, setBedrockSecretAccessKey] = useState('');
  const [bedrockConfigured, setBedrockConfigured] = useState<boolean | null>(null);
  const [bedrockModel, setBedrockModel] = useState(DEFAULT_BEDROCK_MODEL);

  // Shared
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    async function load() {
      const [p, configured, storedModel, credsOk, creds] = await Promise.all([
        getStoredProvider(),
        hasApiKey(),
        getStoredModel(),
        hasBedrockCreds(),
        getStoredBedrockCreds(),
      ]);
      setProvider(p);
      setKeyConfigured(configured);
      setAnthropicModel(storedModel);
      setBedrockConfigured(credsOk);
      setBedrockRegion(creds.region);
    }
    load();
  }, []);

  async function handleProviderChange(p: AIProvider) {
    setProvider(p);
    setSaveStatus('idle');
    await saveProvider(p);
  }

  // ── Anthropic handlers ────────────────────────────────────────────────────

  async function handleSaveAnthropicKey() {
    if (!keyInput.trim()) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const [keyRes, sentinelRes, modelRes] = await Promise.all([
        fetch(kvUrl(KV_KEY_PATH) + '?encrypted=true', {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: keyInput.trim(),
        }),
        fetch(kvUrl('anthropicApiKeySet'), {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: 'true',
        }),
        fetch(kvUrl(KV_MODEL_PATH), {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: anthropicModel,
        }),
      ]);
      if (!keyRes.ok || !sentinelRes.ok || !modelRes.ok) throw new Error('Failed to save settings.');
      setKeyConfigured(true);
      setKeyInput('');
      setSaveStatus('success');
      setSaveMessage('Anthropic settings saved.');
    } catch (e) {
      setSaveStatus('error');
      setSaveMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAnthropicModel() {
    setSaving(true);
    try {
      await fetch(kvUrl(KV_MODEL_PATH), {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: anthropicModel,
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

  async function handleClearAnthropicKey() {
    setSaving(true);
    try {
      await Promise.all([
        fetch(kvUrl(KV_KEY_PATH), { method: 'DELETE' }),
        fetch(kvUrl('anthropicApiKeySet'), { method: 'DELETE' }),
      ]);
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

  // ── Bedrock handlers ──────────────────────────────────────────────────────

  async function handleSaveBedrockCreds() {
    if (!bedrockAccessKeyId.trim() || !bedrockSecretAccessKey.trim()) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      await saveBedrockCreds(bedrockRegion, bedrockAccessKeyId.trim(), bedrockSecretAccessKey.trim());
      setBedrockConfigured(true);
      setBedrockAccessKeyId('');
      setBedrockSecretAccessKey('');
      setSaveStatus('success');
      setSaveMessage('Bedrock credentials saved.');
    } catch (e) {
      setSaveStatus('error');
      setSaveMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBedrockModel() {
    setSaving(true);
    try {
      await fetch(kvUrl(KV_MODEL_PATH), {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: bedrockModel,
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

  async function handleClearBedrockCreds() {
    setSaving(true);
    try {
      await clearBedrockCreds();
      setBedrockConfigured(false);
      setSaveStatus('success');
      setSaveMessage('Bedrock credentials removed.');
    } catch {
      setSaveStatus('error');
      setSaveMessage('Failed to remove credentials.');
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
        <p className="page-subtitle">Configure your AI provider credentials for the AI Collector Builder.</p>
      </div>

      {/* Provider toggle */}
      <div className="form-section">
        <h3 className="form-section-title">AI Provider</h3>
        <div className="provider-toggle">
          <button
            type="button"
            className={`provider-toggle-btn${provider === 'anthropic' ? ' provider-toggle-btn--active' : ''}`}
            onClick={() => handleProviderChange('anthropic')}
          >
            Anthropic
          </button>
          <button
            type="button"
            className={`provider-toggle-btn${provider === 'bedrock' ? ' provider-toggle-btn--active' : ''}`}
            onClick={() => handleProviderChange('bedrock')}
          >
            AWS Bedrock
          </button>
        </div>
      </div>

      {/* ── Anthropic section ──────────────────────────────────────────────── */}
      {provider === 'anthropic' && (
        <>
          <div className="form-section">
            <h3 className="form-section-title">Anthropic API Key</h3>
            <div className="key-status-row">
              <span className={`key-status-badge ${keyConfigured ? 'key-status-badge--set' : 'key-status-badge--unset'}`}>
                {keyConfigured === null ? 'Checking…' : keyConfigured ? 'API key configured ✓' : 'No API key set'}
              </span>
              {keyConfigured && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleClearAnthropicKey} disabled={saving}>
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
                  onClick={handleSaveAnthropicKey}
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
                  value={anthropicModel}
                  onChange={e => { setAnthropicModel(e.target.value); setSaveStatus('idle'); }}
                >
                  {ANTHROPIC_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleSaveAnthropicModel}
                  disabled={saving}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Bedrock section ────────────────────────────────────────────────── */}
      {provider === 'bedrock' && (
        <>
          <div className="form-section">
            <h3 className="form-section-title">AWS Credentials</h3>
            <div className="key-status-row">
              <span className={`key-status-badge ${bedrockConfigured ? 'key-status-badge--set' : 'key-status-badge--unset'}`}>
                {bedrockConfigured === null ? 'Checking…' : bedrockConfigured ? 'Credentials configured ✓' : 'No credentials set'}
              </span>
              {bedrockConfigured && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleClearBedrockCreds} disabled={saving}>
                  Remove credentials
                </button>
              )}
            </div>

            <div className="form-field">
              <label className="form-label">AWS Region</label>
              <select
                className="form-control"
                value={bedrockRegion}
                onChange={e => { setBedrockRegion(e.target.value); setSaveStatus('idle'); }}
              >
                {BEDROCK_REGIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label">{bedrockConfigured ? 'Replace Access Key ID' : 'Access Key ID'}</label>
              <input
                type="text"
                className="form-control"
                placeholder="AKIA…"
                value={bedrockAccessKeyId}
                onChange={e => { setBedrockAccessKeyId(e.target.value); setSaveStatus('idle'); }}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="form-field">
              <label className="form-label">{bedrockConfigured ? 'Replace Secret Access Key' : 'Secret Access Key'}</label>
              <div className="url-fetch-row">
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={bedrockSecretAccessKey}
                  onChange={e => { setBedrockSecretAccessKey(e.target.value); setSaveStatus('idle'); }}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleSaveBedrockCreds}
                  disabled={saving || !bedrockAccessKeyId.trim() || !bedrockSecretAccessKey.trim()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              <p className="form-hint">
                IAM user requires the <code>bedrock:InvokeModelWithResponseStream</code> permission.
                Credentials are stored in the Cribl KV store and never sent directly in browser requests.
              </p>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Model</h3>
            <div className="form-field">
              <label className="form-label">Bedrock Model</label>
              <div className="url-fetch-row">
                <select
                  className="form-control"
                  value={bedrockModel}
                  onChange={e => { setBedrockModel(e.target.value); setSaveStatus('idle'); }}
                >
                  {BEDROCK_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleSaveBedrockModel}
                  disabled={saving}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {saveStatus === 'success' && (
        <p className="push-result push-result--success">{saveMessage}</p>
      )}
      {saveStatus === 'error' && (
        <p className="push-result push-result--error">{saveMessage}</p>
      )}
    </div>
  );
}
