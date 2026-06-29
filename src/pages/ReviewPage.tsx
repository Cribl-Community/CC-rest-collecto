import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizard } from '../context/WizardContext';
import { JsonPreview } from '../components/JsonPreview';
import { buildCollectorJson } from '../utils/buildCollector';
import { saveProject, deriveProjectName } from '../utils/projectStorage';

declare const CRIBL_API_URL: string | undefined;

interface ConfigGroup {
  id: string;
  name?: string;
}

export function ReviewPage() {
  const {
    selectedOperation, collectorConfig, scheduleConfig, parsedSpec,
    chatMessages, currentProjectId, setCurrentProjectId,
  } = useWizard();
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pushId, setPushId] = useState('');
  const hasCriblApi = typeof CRIBL_API_URL !== 'undefined';

  // Synthesize a minimal operation for AI Builder configs that have no spec operation
  const effectiveOperation = selectedOperation ?? {
    method: collectorConfig.collectMethod.toUpperCase(),
    path: collectorConfig.collectUrl,
    operationId: collectorConfig.id,
    summary: collectorConfig.description || undefined,
    tags: [],
    parameters: [],
    servers: [],
  };

  useEffect(() => {
    if (!collectorConfig.collectUrl && !selectedOperation) return;
    const json = buildCollectorJson(effectiveOperation, collectorConfig, scheduleConfig);
    const text = JSON.stringify(json, null, 2);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJsonText(text);
    setParsedJson(json);
    setPushId(id => id || collectorConfig.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOperation, collectorConfig, scheduleConfig]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPushId(collectorConfig.id);
  }, [collectorConfig.id]);

  useEffect(() => {
    if (!hasCriblApi) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  if (!selectedOperation && !collectorConfig.collectUrl) {
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

    const effectiveId = pushId.trim() || collectorConfig.id;
    // Inject the (possibly renamed) id into the payload
    const payload = { ...(parsedJson as Record<string, unknown>), id: effectiveId };


    async function doPush(method: 'POST' | 'PATCH', url: string) {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const bodyText = await r.text();
      let d: Record<string, unknown> = {};
      try { d = JSON.parse(bodyText); } catch { /* non-JSON body */ }


      return { ok: r.ok, status: r.status, data: d };
    }

    try {
      const base = `${CRIBL_API_URL}/m/${selectedGroup}/lib/jobs`;
      let { ok, data } = await doPush('POST', base);

      // On conflict, retry as an update
      if (!ok) {
        const errMsg = (data?.message as string) || (data?.error as string) || '';
        const isConflict = errMsg.toLowerCase().includes('already exist') || errMsg.toLowerCase().includes('conflict');


        if (isConflict) {
          ({ ok, data } = await doPush('PATCH', `${base}/${encodeURIComponent(effectiveId)}`));
          if (ok) {
            const items = data?.items as Array<{ id?: string }> | undefined;
            const updatedId = items?.[0]?.id || (data?.id as string) || effectiveId;
            setPushStatus('success');
            setPushMessage(`Collector "${updatedId}" updated in group "${selectedGroup}".`);
            return;
          }
        }
        const msg = (data?.message as string) || (data?.error as string) || `HTTP ${data}`;
        throw new Error(msg);
      }

      const items = data?.items as Array<{ id?: string }> | undefined;
      const createdId = items?.[0]?.id || (data?.id as string) || effectiveId;

      setPushStatus('success');
      setPushMessage(`Collector "${createdId}" created in group "${selectedGroup}".`);
    } catch (e) {
      setPushStatus('error');
      setPushMessage((e as Error).message);
    }
  }

  async function handleSaveProject() {
    setSaveStatus('saving');
    try {
      const name = deriveProjectName(collectorConfig.id, parsedSpec?.title ?? '');
      const saved = await saveProject({
        id: currentProjectId ?? undefined,
        createdAt: undefined,
        name,
        updatedAt: new Date().toISOString(),
        parsedSpec: parsedSpec ?? { title: name, version: '', servers: [], operations: [] },
        selectedOperation: selectedOperation ?? null,
        collectorConfig,
        scheduleConfig,
        chatMessages,
      });
      setCurrentProjectId(saved.id);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
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
          <span className={`method-badge method--${effectiveOperation.method.toLowerCase()}`}>
            {effectiveOperation.method}
          </span>
          <code>{effectiveOperation.path}</code>
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
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleSaveProject}
            disabled={saveStatus === 'saving'}
            title={currentProjectId ? 'Update saved project' : 'Save as project'}
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : saveStatus === 'error' ? 'Save Error' : currentProjectId ? 'Update Project' : 'Save Project'}
          </button>
        </div>

        {hasCriblApi && (
          <div className="push-section">
            <div className="push-id-row">
              <label className="push-id-label" htmlFor="push-collector-id">Collector ID</label>
              <input
                id="push-collector-id"
                type="text"
                className="form-control push-id-input"
                value={pushId}
                onChange={e => { setPushId(e.target.value); setPushStatus('idle'); }}
                placeholder={collectorConfig.id}
                aria-label="Collector ID to push as"
              />
              {pushId !== collectorConfig.id && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm push-id-reset"
                  onClick={() => { setPushId(collectorConfig.id); setPushStatus('idle'); }}
                  title="Reset to original ID"
                >
                  Reset
                </button>
              )}
            </div>
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
                disabled={jsonInvalid || pushStatus === 'loading' || pushStatus === 'success' || !selectedGroup || groupsLoading || !pushId.trim()}
              >
                {pushStatus === 'loading' ? 'Pushing…'
                  : pushStatus === 'success' ? 'Pushed ✓'
                  : pushStatus === 'error' ? 'Push Failed — Retry ↑'
                  : '↑ Push to Cribl'}
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
