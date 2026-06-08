import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizard } from '../context/WizardContext';
import {
  listProjects,
  loadProject,
  deleteProject,
  renameProject,
  type ProjectMeta,
} from '../utils/projectStorage';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function deriveLoadPath(project: Awaited<ReturnType<typeof loadProject>>): string {
  if (!project) return '/spec';
  // Completed config (wizard or AI builder with loaded config) → review
  if (project.selectedOperation || project.collectorConfig?.collectUrl) return '/review';
  // AI builder session with chat history but no completed config → resume in chat
  if (project.chatMessages?.length > 0) return '/chat';
  // Wizard in progress with a parsed spec → pick an endpoint
  if (project.parsedSpec?.operations?.length > 0) return '/endpoint';
  // Nothing recoverable → restart from spec input
  return '/spec';
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const {
    setParsedSpec, setSelectedOperation, setCollectorConfig, setScheduleConfig,
    setChatMessages, setCurrentProjectId, reset,
  } = useWizard();

  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    listProjects().then(list => {
      setProjects(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setLoading(false);
    });
  }, []);

  async function handleLoad(id: string, destination: 'review' | 'configure' | 'chat' | 'spec-update') {
    setLoadingId(id);
    const project = await loadProject(id);
    if (!project) {
      setLoadingId(null);
      return;
    }

    // Restore full wizard state
    setParsedSpec(project.parsedSpec ?? null);
    setSelectedOperation(project.selectedOperation ?? null);
    setCollectorConfig(project.collectorConfig);
    setScheduleConfig(project.scheduleConfig);
    setChatMessages(project.chatMessages ?? []);
    setCurrentProjectId(id);
    setLoadingId(null);

    if (destination === 'spec-update') {
      navigate('/spec?preserve=true');
    } else if (destination === 'chat') {
      navigate('/chat');
    } else {
      navigate(deriveLoadPath(project));
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    setDeletingId(null);
    setConfirmDeleteId(null);
  }

  function startRename(p: ProjectMeta) {
    setRenamingId(p.id);
    setRenameValue(p.name);
  }

  async function commitRename(id: string) {
    const name = renameValue.trim();
    if (name) {
      await renameProject(id, name);
      setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    }
    setRenamingId(null);
  }

  function handleNew() {
    reset();
    navigate('/spec');
  }

  return (
    <div className="page projects-page">
      <div className="page-header projects-page-header">
        <div>
          <h2 className="page-title">Projects</h2>
          <p className="page-subtitle">Save your collector configurations and return to edit them later.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={handleNew}>
          + New Project
        </button>
      </div>

      {loading && (
        <div className="projects-loading">Loading projects…</div>
      )}

      {!loading && projects.length === 0 && (
        <div className="projects-empty">
          <div className="projects-empty-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="6" y="10" width="36" height="28" rx="3" stroke="#4a5568" strokeWidth="2"/>
              <path d="M6 18h36" stroke="#4a5568" strokeWidth="2"/>
              <path d="M16 10V6M32 10V6" stroke="#4a5568" strokeWidth="2" strokeLinecap="round"/>
              <path d="M16 28h16M16 33h8" stroke="#00C58E" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="projects-empty-title">No saved projects yet</p>
          <p className="projects-empty-hint">Create a collector configuration and save it as a project to return to it later.</p>
          <div className="projects-empty-actions">
            <button type="button" className="btn btn--primary" onClick={handleNew}>
              Start from OpenAPI Spec
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => { reset(); navigate('/chat'); }}>
              Use AI Builder
            </button>
          </div>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="projects-list">
          {projects.map(p => (
            <div key={p.id} className="project-row">
              <div className="project-row-info">
                {renamingId === p.id ? (
                  <input
                    className="form-control project-rename-input"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(p.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(p.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    autoFocus
                    aria-label="Rename project"
                  />
                ) : (
                  <button
                    type="button"
                    className="project-name"
                    onClick={() => startRename(p)}
                    title="Click to rename"
                  >
                    {p.name}
                  </button>
                )}
                <span className="project-updated">{relativeTime(p.updatedAt)}</span>
              </div>

              <div className="project-row-actions">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => handleLoad(p.id, 'review')}
                  disabled={loadingId === p.id}
                >
                  {loadingId === p.id ? 'Loading…' : 'Open'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => handleLoad(p.id, 'spec-update')}
                  disabled={loadingId === p.id}
                  title="Load project and re-parse spec to update config"
                >
                  Update Spec
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => handleLoad(p.id, 'chat')}
                  disabled={loadingId === p.id}
                  title="Open in AI Builder with chat history restored"
                >
                  AI Builder
                </button>
                {confirmDeleteId === p.id ? (
                  <>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                    >
                      {deletingId === p.id ? 'Deleting…' : 'Confirm Delete'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setConfirmDeleteId(p.id)}
                    title="Delete project"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
