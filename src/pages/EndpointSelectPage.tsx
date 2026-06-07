import { useNavigate } from 'react-router-dom';
import { useWizard } from '../context/WizardContext';
import { EndpointTable } from '../components/EndpointTable';
import type { ParsedOperation } from '../context/WizardContext';

export function EndpointSelectPage() {
  const { parsedSpec, selectedOperation, setSelectedOperation, setCollectorConfig, collectorConfig } = useWizard();
  const navigate = useNavigate();

  if (!parsedSpec) {
    navigate('/spec');
    return null;
  }

  function handleSelect(op: ParsedOperation) {
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

    const requestHeaders = op.parameters
      .filter(p => p.in === 'header')
      .map(p => ({ name: p.name, value: p.example ? `'${p.example}'` : '', enum: p.enum }));

    const requestParams = op.parameters
      .filter(p => p.in === 'query')
      .map(p => ({ name: p.name, value: p.example ? `'${p.example}'` : '', enum: p.enum }));

    // Sanitize id from operationId or path
    const rawId = op.operationId || op.path.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '');

    setCollectorConfig({
      ...collectorConfig,
      id: rawId,
      description: op.summary || op.description || '',
      collectUrl,
      collectMethod: collectMethod as 'get' | 'post' | 'other',
      requestHeaders,
      requestParams,
    });
  }

  function handleContinue() {
    if (selectedOperation) navigate('/configure');
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

      <EndpointTable
        operations={parsedSpec.operations}
        selected={selectedOperation}
        onSelect={handleSelect}
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
