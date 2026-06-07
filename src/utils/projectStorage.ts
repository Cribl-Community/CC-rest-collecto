import type { ParsedSpec, ParsedOperation, CollectorConfig, ScheduleConfig } from '../context/WizardContext';

declare const CRIBL_API_URL: string;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: string;
}

export interface Project extends ProjectMeta {
  createdAt: string;
  parsedSpec: ParsedSpec;
  selectedOperation: ParsedOperation | null;
  collectorConfig: CollectorConfig;
  scheduleConfig: ScheduleConfig;
  chatMessages: ChatMessage[];
}

function kvUrl(path: string) {
  return `${CRIBL_API_URL}/kvstore/${path}`;
}

function generateId(): string {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function listProjects(): Promise<ProjectMeta[]> {
  try {
    const r = await fetch(kvUrl('projects/index'));
    if (!r.ok) return [];
    const text = (await r.text()).trim();
    if (!text) return [];
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveIndex(index: ProjectMeta[]): Promise<void> {
  await fetch(kvUrl('projects/index'), {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(index),
  });
}

export async function loadProject(id: string): Promise<Project | null> {
  try {
    const r = await fetch(kvUrl(`projects/${id}`));
    if (!r.ok) return null;
    const text = (await r.text()).trim();
    if (!text) return null;
    return JSON.parse(text) as Project;
  } catch {
    return null;
  }
}

export async function saveProject(project: Omit<Project, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<Project> {
  const now = new Date().toISOString();
  const saved: Project = {
    ...project,
    id: project.id ?? generateId(),
    createdAt: project.createdAt ?? now,
    updatedAt: now,
  } as Project;

  await fetch(kvUrl(`projects/${saved.id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(saved),
  });

  const index = await listProjects();
  const existingIdx = index.findIndex(m => m.id === saved.id);
  const meta: ProjectMeta = { id: saved.id, name: saved.name, updatedAt: saved.updatedAt };
  if (existingIdx >= 0) {
    index[existingIdx] = meta;
  } else {
    index.unshift(meta);
  }
  await saveIndex(index);

  return saved;
}

export async function renameProject(id: string, name: string): Promise<void> {
  const project = await loadProject(id);
  if (!project) return;
  project.name = name;
  project.updatedAt = new Date().toISOString();
  await fetch(kvUrl(`projects/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(project),
  });
  const index = await listProjects();
  const meta = index.find(m => m.id === id);
  if (meta) {
    meta.name = name;
    meta.updatedAt = project.updatedAt;
    await saveIndex(index);
  }
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(kvUrl(`projects/${id}`), { method: 'DELETE' });
  const index = await listProjects();
  await saveIndex(index.filter(m => m.id !== id));
}

export function deriveProjectName(collectorId: string, specTitle: string): string {
  return collectorId && collectorId !== 'my-rest-collector'
    ? collectorId
    : specTitle || 'Untitled Project';
}
