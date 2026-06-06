import { useState, useMemo } from 'react';
import type { ParsedOperation } from '../context/WizardContext';

interface EndpointTableProps {
  operations: ParsedOperation[];
  selected: ParsedOperation | null;
  onSelect: (op: ParsedOperation) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'method--get',
  POST: 'method--post',
  PUT: 'method--put',
  PATCH: 'method--patch',
  DELETE: 'method--delete',
  HEAD: 'method--head',
  OPTIONS: 'method--options',
};

export function EndpointTable({ operations, selected, onSelect }: EndpointTableProps) {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');

  const allMethods = useMemo(
    () => ['ALL', ...Array.from(new Set(operations.map(o => o.method))).sort()],
    [operations],
  );

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    operations.forEach(o => o.tags.forEach(t => tags.add(t)));
    return ['ALL', ...Array.from(tags).sort()];
  }, [operations]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return operations.filter(op => {
      if (methodFilter !== 'ALL' && op.method !== methodFilter) return false;
      if (tagFilter !== 'ALL' && !op.tags.includes(tagFilter)) return false;
      if (q) {
        return (
          op.path.toLowerCase().includes(q) ||
          (op.summary?.toLowerCase().includes(q) ?? false) ||
          (op.operationId?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [operations, search, methodFilter, tagFilter]);

  return (
    <div className="endpoint-table-wrap">
      <div className="endpoint-filters">
        <input
          type="search"
          placeholder="Search paths, operations…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-control endpoint-search"
          aria-label="Search endpoints"
        />
        <select
          value={methodFilter}
          onChange={e => setMethodFilter(e.target.value)}
          className="form-control endpoint-filter-select"
          aria-label="Filter by method"
        >
          {allMethods.map(m => (
            <option key={m} value={m}>{m === 'ALL' ? 'All Methods' : m}</option>
          ))}
        </select>
        {allTags.length > 1 && (
          <select
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="form-control endpoint-filter-select"
            aria-label="Filter by tag"
          >
            {allTags.map(t => (
              <option key={t} value={t}>{t === 'ALL' ? 'All Tags' : t}</option>
            ))}
          </select>
        )}
        <span className="endpoint-count">{filtered.length} endpoint{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="endpoint-empty">No endpoints match your filters.</div>
      ) : (
        <div className="endpoint-list">
          {filtered.map((op, i) => {
            const isSelected =
              selected?.method === op.method && selected?.path === op.path;
            return (
              <button
                key={`${op.method}-${op.path}-${i}`}
                type="button"
                className={`endpoint-row${isSelected ? ' endpoint-row--selected' : ''}`}
                onClick={() => onSelect(op)}
              >
                <span className={`method-badge ${METHOD_COLORS[op.method] ?? 'method--other'}`}>
                  {op.method}
                </span>
                <span className="endpoint-path">{op.path}</span>
                <span className="endpoint-summary">{op.summary || op.operationId || ''}</span>
                {op.tags.length > 0 && (
                  <span className="endpoint-tags">
                    {op.tags.map(t => (
                      <span key={t} className="endpoint-tag">{t}</span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
