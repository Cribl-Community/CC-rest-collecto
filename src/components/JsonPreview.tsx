import { useState, useMemo } from 'react';

interface JsonPreviewProps {
  value: string;
  onChange: (value: string, parsed: object | null) => void;
}

export function JsonPreview({ value, onChange }: JsonPreviewProps) {
  const error = useMemo<string | null>(() => {
    try { JSON.parse(value); return null; }
    catch (e) { return (e as Error).message; }
  }, [value]);
  const [formatted, setFormatted] = useState(false);

  const handleChange = (text: string) => {
    setFormatted(false);
    try {
      const parsed = JSON.parse(text);
      onChange(text, parsed);
    } catch {
      onChange(text, null);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(value);
      const pretty = JSON.stringify(parsed, null, 2);
      onChange(pretty, parsed);
      setFormatted(true);
    } catch {
      // already showing error
    }
  };

  return (
    <div className="json-preview">
      <div className="json-preview-toolbar">
        <span className="json-preview-label">JSON Config</span>
        <div className="json-preview-actions">
          {error && <span className="json-preview-error-badge">Invalid JSON</span>}
          {!error && <span className="json-preview-valid-badge">Valid</span>}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleFormat}
            disabled={!!error}
            title="Format / pretty-print"
          >
            {formatted ? 'Formatted ✓' : 'Format'}
          </button>
        </div>
      </div>
      <textarea
        className={`json-editor${error ? ' json-editor--error' : ''}`}
        value={value}
        onChange={e => handleChange(e.target.value)}
        spellCheck={false}
        aria-label="JSON configuration"
      />
      {error && (
        <p className="json-preview-error-text">{error}</p>
      )}
    </div>
  );
}
