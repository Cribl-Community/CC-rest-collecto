import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizard } from '../context/WizardContext';
import { JsonPreview } from '../components/JsonPreview';
import { buildCollectorJson } from '../utils/buildCollector';

declare const CRIBL_API_URL: string | undefined;

interface ConfigGroup {
  id: string;
  name?: string;
}

export function ReviewPage() {
  const { selectedOperation, collectorConfig, scheduleConfig } = useWizard();
  const navigate = useNavigate();

  const [jsonText, setJsonText] = useState('');
  const [parsedJson, setParsedJson] = useState<object | null>(null);
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [pushStatus, setPushStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pushMessage, setPushMessage] = useState('');
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const hasCriblApi = typeof CRIBL_API_URL !== 'undefined';

  useEffect(() => {
    if (!selectedOperation) return;
    const json = buildCollectorJson(selectedOperation, collectorConfig, scheduleConfig);
    const text = JSON.stringify(json, null, 2);
    setJsonText(text);
    setParsedJson(json);
  }, [selectedOperation, collectorConfig, scheduleConfig]);

  useEffect(() => {
    if (!hasCriblApi) return;
    setGroupsLoading(true);
    fetch(`${CRIBL_API_URL}/master/groups`)
      .then(r => r.json())
      .then(data => {
        const items: ConfigGroup[] = data?.items ?? [];
        setGroups(items);
        if (items.length > 0) setSelectedGroup(items[0].id);
      })
      .catch(() => setGroupsError('Could not load config groups.'))
      .finally(() => setGroupsLoading(false));
  }, [hasCriblApi]);

  if (!selectedOperation) {
    navigate('/spec');
    return null;
  }

  function handleJsonChange(text: string, parsed: object | null) {
    setJsonText(text);
    setParsedJson(parsed);
    setPushStatus('idle');
  }

  function handleCopy() {
    navigator.clipboard.writeText(jsonText).then(() => {
      setCopyLabel('Copied ✓');
      setTimeout(() => setCopyLabel('Copy'), 2000);
    });
  }

  function handleDownload() {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${collectorConfig.id || 'rest-collector'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handlePush() {
    if (!parsedJson || !selectedGroup) return;
    setPushStatus('loading');
    setPushMessage('');
    try {
      const resp = await fetch(`${CRIBL_API_URL}/m/${selectedGroup}/lib/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedJson),
      });
      const data = await resp.json();
      if (!resp.ok) {
        const msg = data?.message || data?.error || resp.statusText;
        throw new Error(msg);
      }
      const createdId = data?.items?.[0]?.id || (data as { id?: string }).id || collectorConfig.id;
      setPushStatus('success');
      setPushMessage(`Collector "${createdId}" created in group "${selectedGroup}".`);
    } catch (e) {
      setPushStatus('error');
      setPushMessage((e as Error).message);
    }
  }

  const jsonInvalid = parsedJson === null;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Review &amp; Export</h2>
        <p className="page-subtitle">
          Review and optionally edit the generated config below, then download or push directly to Cribl.
        </p>
      </div>

      <div className="review-summary">
        <div className="summary-chip">
          <span className={`method-badge method--${selectedOperation.method.toLowerCase()}`}>
            {selectedOperation.method}
          </span>
          <code>{selectedOperation.path}</code>
        </div>
        <div className="summary-chip">
          <span className="summary-label">ID</span>
          <code>{collectorConfig.id}</code>
        </div>
        <div className="summary-chip">
          <span className="summary-label">Auth</span>
          <span>{collectorConfig.authentication}</span>
        </div>
        <div className="summary-chip">
          <span className="summary-label">Schedule</span>
          <code>{scheduleConfig.cronSchedule}</code>
          <span className="summary-tz">{scheduleConfig.tz}</span>
        </div>
      </div>

      <JsonPreview value={jsonText} onChange={handleJsonChange} />

      <div className="export-section">
        <div className="export-actions">
          <button type="button" className="btn btn--ghost" onClick={handleCopy} disabled={jsonInvalid}>
            {copyLabel}
          </button>
          <button type="button" className="btn btn--secondary" onClick={handleDownload} disabled={jsonInvalid}>
            ↓ Download JSON
          </button>
        </div>

        {hasCriblApi && (
          <div className="push-section">
            <div className="push-controls">
              {groupsLoading && <span className="push-hint">Loading groups…</span>}
              {groupsError && <span className="push-hint push-hint--error">{groupsError}</span>}
              {!groupsLoading && !groupsError && groups.length > 0 && (
                <select
                  className="form-control push-group-select"
                  value={selectedGroup}
                  onChange={e => { setSelectedGroup(e.target.value); setPushStatus('idle'); }}
                  aria-label="Target config group"
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name || g.id}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className={`btn btn--primary push-btn push-btn--${pushStatus}`}
                onClick={handlePush}
                disabled={jsonInvalid || pushStatus === 'loading' || !selectedGroup || groupsLoading}
              >
                {pushStatus === 'loading' ? 'Pushing…' : pushStatus === 'success' ? 'Pushed ✓' : '↑ Push to Cribl'}
              </button>
            </div>
            {pushStatus === 'success' && (
              <p className="push-result push-result--success">{pushMessage}</p>
            )}
            {pushStatus === 'error' && (
              <p className="push-result push-result--error">Error: {pushMessage}</p>
            )}
          </div>
        )}
      </div>

      {!hasCriblApi && (
        <div className="import-hint">
          <strong>To import:</strong> In Cribl, go to <em>Data → Collectors → Import</em> and upload the downloaded JSON file.
        </div>
      )}

      <div className="page-actions">
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/schedule')}>
          ← Back
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            navigate('/spec');
          }}
        >
          Start Over
        </button>
      </div>
    </div>
  );
}
