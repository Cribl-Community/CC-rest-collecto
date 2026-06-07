import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizard, type CollectorParam } from '../context/WizardContext';
import { FormField } from '../components/FormField';

function ParamRows({
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  rows: CollectorParam[];
  onChange: (rows: CollectorParam[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  function update(i: number, field: keyof CollectorParam, val: string) {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r));
    onChange(next);
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...rows, { name: '', value: '' }]);
  }

  return (
    <div className="param-rows">
      {rows.map((row, i) => (
        <div key={i} className="param-row">
          <input
            className="form-control param-name"
            placeholder={keyPlaceholder ?? 'Name'}
            value={row.name}
            onChange={e => update(i, 'name', e.target.value)}
            aria-label={`Parameter ${i + 1} name`}
          />
          {row.enum && row.enum.length > 0 ? (
            <select
              className="form-control param-value"
              value={row.value}
              onChange={e => update(i, 'value', e.target.value)}
              aria-label={`Parameter ${i + 1} value`}
            >
              <option value="">— select —</option>
              {row.enum.map(v => (
                <option key={v} value={`'${v}'`}>{v}</option>
              ))}
            </select>
          ) : (
            <input
              className="form-control param-value"
              placeholder={valuePlaceholder ?? "'value'"}
              value={row.value}
              onChange={e => update(i, 'value', e.target.value)}
              aria-label={`Parameter ${i + 1} value`}
            />
          )}
          <button type="button" className="btn btn--icon btn--danger" onClick={() => remove(i)} aria-label="Remove row">
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn--ghost btn--sm" onClick={add}>
        + Add row
      </button>
    </div>
  );
}

export function CollectorConfigPage() {
  const { selectedOperation, collectorConfig, setCollectorConfig } = useWizard();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  if (!selectedOperation) {
    navigate('/endpoint');
    return null;
  }

  const cfg = collectorConfig;

  function update<K extends keyof typeof cfg>(key: K, value: typeof cfg[K]) {
    setCollectorConfig({ ...cfg, [key]: value });
  }

  function validate() {
    if (!cfg.id.trim()) { setError('Collector ID is required.'); return false; }
    if (!/^[a-zA-Z0-9_-]+$/.test(cfg.id)) {
      setError('Collector ID may only contain letters, numbers, hyphens, and underscores.');
      return false;
    }
    if (!cfg.collectUrl.trim()) { setError('Collection URL is required.'); return false; }
    setError(null);
    return true;
  }

  function handleContinue() {
    if (validate()) navigate('/schedule');
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Configure Collector</h2>
        <p className="page-subtitle">
          Pre-filled from{' '}
          <span className={`method-badge method--${selectedOperation.method.toLowerCase()}`}>
            {selectedOperation.method}
          </span>{' '}
          <code>{selectedOperation.path}</code>.
          Adjust as needed.
        </p>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Identity</h3>
        <div className="form-grid form-grid--2">
          <FormField
            label="Collector ID"
            required
            value={cfg.id}
            onChange={e => update('id', e.target.value)}
            placeholder="my-rest-collector"
            hint="Letters, numbers, hyphens, underscores only"
          />
          <FormField
            label="Description"
            value={cfg.description}
            onChange={e => update('description', e.target.value)}
            placeholder="What does this collector do?"
          />
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Collection</h3>
        <FormField
          label="Collection URL"
          required
          value={cfg.collectUrl}
          onChange={e => update('collectUrl', e.target.value)}
          placeholder="'https://api.example.com/data'"
          hint="JS expression. Use single quotes for literals, backticks for template strings."
        />
        <div className="form-grid form-grid--2">
          <FormField
            as="select"
            label="HTTP Method"
            value={cfg.collectMethod}
            onChange={e => update('collectMethod', e.target.value as typeof cfg.collectMethod)}
          >
            <option value="get">GET</option>
            <option value="post">POST</option>
            <option value="post_with_body">POST with body</option>
            <option value="other">Other</option>
          </FormField>
          <FormField
            as="select"
            label="Pagination"
            value={cfg.paginationType}
            onChange={e => update('paginationType', e.target.value as typeof cfg.paginationType)}
          >
            <option value="none">None</option>
            <option value="response_body">Response Body</option>
            <option value="response_header">Response Header</option>
            <option value="response_header_link">Response Header Link</option>
            <option value="request_offset">Request Offset</option>
            <option value="request_page">Request Page</option>
          </FormField>
        </div>

        {cfg.paginationType !== 'none' && (
          <div className="pagination-fields">
            <FormField
              label="Max Pages"
              type="number"
              value={cfg.paginationMaxPages}
              min={1}
              onChange={e => update('paginationMaxPages', Number(e.target.value))}
              hint="Maximum number of pages to retrieve per collection task"
            />

            {(cfg.paginationType === 'response_body' || cfg.paginationType === 'response_header') && (
              <FormField
                label="Attribute"
                value={cfg.paginationAttribute}
                onChange={e => update('paginationAttribute', e.target.value)}
                placeholder="next_cursor"
                hint="Name of the response attribute containing the next page token or URL"
              />
            )}

            {cfg.paginationType === 'response_header_link' && (
              <FormField
                label="Next Relation Attribute"
                value={cfg.paginationNextRelation}
                onChange={e => update('paginationNextRelation', e.target.value)}
                placeholder="next"
                hint='Relation name in the Link header for the next page (usually "next")'
              />
            )}

            {cfg.paginationType === 'request_offset' && (
              <div className="form-grid form-grid--2">
                <FormField
                  label="Offset Field"
                  value={cfg.paginationOffsetField}
                  onChange={e => update('paginationOffsetField', e.target.value)}
                  placeholder="offset"
                  hint="Query param name for the start index"
                />
                <FormField
                  label="Limit Field"
                  value={cfg.paginationLimitField}
                  onChange={e => update('paginationLimitField', e.target.value)}
                  placeholder="limit"
                  hint="Query param name for records per page"
                />
                <FormField
                  label="Limit (records per page)"
                  type="number"
                  value={cfg.paginationLimit}
                  min={1}
                  onChange={e => update('paginationLimit', Number(e.target.value))}
                />
                <div className="form-field">
                  <label className="form-label">Options</label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={cfg.paginationZeroIndexed}
                      onChange={e => update('paginationZeroIndexed', e.target.checked)}
                    />
                    Zero-indexed (first page = 0)
                  </label>
                </div>
              </div>
            )}

            {cfg.paginationType === 'request_page' && (
              <div className="form-grid form-grid--2">
                <FormField
                  label="Page Field"
                  value={cfg.paginationPageField}
                  onChange={e => update('paginationPageField', e.target.value)}
                  placeholder="page"
                  hint="Query param name for the page number"
                />
                <FormField
                  label="Size Field"
                  value={cfg.paginationSizeField}
                  onChange={e => update('paginationSizeField', e.target.value)}
                  placeholder="per_page"
                  hint="Query param name for page size"
                />
                <FormField
                  label="Page Size"
                  type="number"
                  value={cfg.paginationSize}
                  min={1}
                  onChange={e => update('paginationSize', Number(e.target.value))}
                />
                <div className="form-field">
                  <label className="form-label">Options</label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={cfg.paginationZeroIndexed}
                      onChange={e => update('paginationZeroIndexed', e.target.checked)}
                    />
                    Zero-indexed (first page = 0)
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Authentication</h3>
        <FormField
          as="select"
          label="Authentication Type"
          value={cfg.authentication}
          onChange={e => update('authentication', e.target.value as typeof cfg.authentication)}
        >
          <option value="none">None</option>
          <option value="basic">Basic (plaintext)</option>
          <option value="basicSecret">Basic (secret ref)</option>
          <option value="login">Login</option>
          <option value="loginSecret">Login (secret ref)</option>
          <option value="oauth">OAuth</option>
          <option value="oauthSecret">OAuth (secret ref)</option>
        </FormField>
        {(cfg.authentication === 'basic') && (
          <div className="form-grid form-grid--2">
            <FormField
              label="Username"
              value={cfg.username ?? ''}
              onChange={e => update('username', e.target.value)}
            />
            <FormField
              label="Password"
              type="password"
              value={cfg.password ?? ''}
              onChange={e => update('password', e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Request Headers</h3>
        <p className="form-hint">Pre-filled from spec header parameters. Values are JS expressions.</p>
        <ParamRows
          rows={cfg.requestHeaders}
          onChange={rows => update('requestHeaders', rows)}
          keyPlaceholder="Header-Name"
          valuePlaceholder="'value' or kv.mySecret"
        />
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Query Parameters</h3>
        <p className="form-hint">Pre-filled from spec query parameters. Values are JS expressions.</p>
        <ParamRows
          rows={cfg.requestParams}
          onChange={rows => update('requestParams', rows)}
          keyPlaceholder="param"
          valuePlaceholder="'value'"
        />
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Advanced</h3>
        <div className="form-grid form-grid--2">
          <FormField
            label="Timeout (seconds)"
            type="number"
            value={cfg.timeout}
            min={1}
            max={600}
            onChange={e => update('timeout', Number(e.target.value))}
          />
          <div className="form-field">
            <label className="form-label">Options</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={cfg.rejectUnauthorized}
                  onChange={e => update('rejectUnauthorized', e.target.checked)}
                />
                Verify TLS certificates
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={cfg.disableTimeFilter}
                  onChange={e => update('disableTimeFilter', e.target.checked)}
                />
                Disable time filter
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={cfg.sendToRoutes}
                  onChange={e => update('sendToRoutes', e.target.checked)}
                />
                Send to Routes
              </label>
            </div>
          </div>
        </div>
        {!cfg.sendToRoutes && (
          <FormField
            label="Output Destination"
            value={cfg.output ?? ''}
            onChange={e => update('output', e.target.value)}
            placeholder="default"
            hint="Destination ID to send events to"
          />
        )}
      </div>

      {error && <p className="page-error">{error}</p>}

      <div className="page-actions">
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/endpoint')}>
          ← Back
        </button>
        <button type="button" className="btn btn--primary" onClick={handleContinue}>
          Set Schedule →
        </button>
      </div>
    </div>
  );
}
