import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizard } from '../context/WizardContext';
import { EndpointTable } from '../components/EndpointTable';
import type { ParsedOperation } from '../context/WizardContext';

export function EndpointSelectPage() {
  const {
    parsedSpec, selectedOperation, setSelectedOperation,
    setCollectorConfig, collectorConfig, preserveConfig, setPreserveConfig,
  } = useWizard();
  const navigate = useNavigate();
  const [preserveBanner, setPreserveBanner] = useState<'found' | 'not-found' | null>(null);

  useEffect(() => {
    if (!preserveConfig || !parsedSpec) return;
    // Try to auto-select the same operation by operationId
    const savedOpId = selectedOperation?.operationId;
    const savedPath = selectedOperation?.path;
    const savedMethod = selectedOperation?.method;
    const match = parsedSpec.operations.find(op =>
      (savedOpId && op.operationId === savedOpId) ||
      (op.path === savedPath && op.method === savedMethod)
    );
    if (match) {
      handleSelect(match, true);
      setPreserveBanner('found');
    } else {
      setPreserveBanner('not-found');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preserveConfig, parsedSpec]);

  if (!parsedSpec) {
    navigate('/spec');
    return null;
  }

  function handleSelect(op: ParsedOperation, mergeExisting = false) {
    setSelectedOperation(op);

    // Pre-populate collector config from the selected operation
    const base = (op.servers[0] || '').replace(/\/$/, '');
    const path = op.path;
    const exprPath = path.replace(/\{([^}]+)\}/g, (_: string, name: string) => `\${${name}}`);
    const collectUrl = exprPath.includes('${')
      ? `\`${base}${exprPath}\``
      : `'${base}${path}'`;

    const method = op.method.toLowerCase();
    const collectMethod =
      method === 'get' ? 'get' : method === 'post' ? 'post' : 'other';

    // Build fresh param lists from the spec
    const specHeaders = op.parameters
      .filter(p => p.in === 'header')
      .map(p => ({ name: p.name, value: p.example ? `'${p.example}'` : '', enum: p.enum }));

    const specParams = op.parameters
      .filter(p => p.in === 'query')
      .map(p => ({ name: p.name, value: p.example ? `'${p.example}'` : '', enum: p.enum }));

    const rawId = op.operationId || op.path.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '');

    if (mergeExisting) {
      // Preserve existing param values where name matches; add new ones blank
      const mergeParams = (specList: typeof specParams, existingList: Array<{ name: string; value: string; enum?: string[] }>) =>
        specList.map(s => {
          const existing = existingList.find(e => e.name === s.name);
          return existing ? { ...s, value: existing.value } : s;
        });

      setCollectorConfig({
        ...collectorConfig,
        collectUrl,
        collectMethod: collectMethod as 'get' | 'post' | 'other',
        requestHeaders: mergeParams(specHeaders, collectorConfig.requestHeaders),
        requestParams: mergeParams(specParams, collectorConfig.requestParams),
      });
    } else {
      setCollectorConfig({
        ...collectorConfig,
        id: rawId,
        description: op.summary || op.description || '',
        collectUrl,
        collectMethod: collectMethod as 'get' | 'post' | 'other',
        requestHeaders: specHeaders,
        requestParams: specParams,
      });
    }
  }

  function handleContinue() {
    if (selectedOperation) {
      setPreserveConfig(false);
      navigate('/configure');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Select an Endpoint</h2>
        <p className="page-subtitle">
          <strong>{parsedSpec.title}</strong>{parsedSpec.version ? ` · v${parsedSpec.version}` : ''} &mdash;&nbsp;
          {parsedSpec.operations.length} operation{parsedSpec.operations.length !== 1 ? 's' : ''} found.
          Choose the endpoint to collect data from.
        </p>
      </div>

      {preserveBanner === 'found' && (
        <div className="preserve-banner preserve-banner--ok">
          Same endpoint found in the updated spec — your existing config has been preserved. Review and adjust any changes below.
        </div>
      )}
      {preserveBanner === 'not-found' && (
        <div className="preserve-banner preserve-banner--warn">
          The previous endpoint was not found in the updated spec. Please select a new endpoint — your other config settings will be kept.
        </div>
      )}

      <EndpointTable
        operations={parsedSpec.operations}
        selected={selectedOperation}
        onSelect={op => handleSelect(op, false)}
      />

      <div className="page-actions">
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/spec')}>
          ← Back
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleContinue}
          disabled={!selectedOperation}
        >
          Configure Collector →
        </button>
      </div>
    </div>
  );
}
