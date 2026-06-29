declare const CRIBL_API_URL: string;

const KV_MODEL_PATH = 'anthropicModel';
const KV_KEY_PATH = 'anthropicApiKey';

export const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Recommended)' },
  { id: 'claude-opus-4-5', label: 'Claude Opus 4.5 (Most capable)' },
  { id: 'claude-haiku-3-5', label: 'Claude Haiku 3.5 (Fastest)' },
];

export const DEFAULT_MODEL = ANTHROPIC_MODELS[0].id;

function kvUrl(path: string) {
  return `${CRIBL_API_URL}/kvstore/${path}`;
}

export async function getStoredModel(): Promise<string> {
  try {
    const r = await fetch(kvUrl(KV_MODEL_PATH));
    if (!r.ok) return DEFAULT_MODEL;
    const text = (await r.text()).trim();
    try {
      const parsed = JSON.parse(text);
      return typeof parsed === 'string' ? parsed : DEFAULT_MODEL;
    } catch {
      return text || DEFAULT_MODEL;
    }
  } catch {
    return DEFAULT_MODEL;
  }
}

export async function hasApiKey(): Promise<boolean> {
  try {
    const r = await fetch(kvUrl(KV_KEY_PATH));
    return r.ok;
  } catch {
    return false;
  }
}
