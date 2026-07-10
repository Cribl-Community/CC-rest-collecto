declare const CRIBL_API_URL: string;

// ── KV key paths ──────────────────────────────────────────────────────────────
const KV_MODEL_PATH = 'anthropicModel';
const KV_ANTHROPIC_KEY_SET_PATH = 'anthropicApiKeySet';
const KV_PROVIDER_PATH = 'aiProvider';
const KV_BEDROCK_REGION_PATH = 'bedrockRegion';
const KV_BEDROCK_ACCESS_KEY_PATH = 'bedrockAccessKeyId';
const KV_BEDROCK_SECRET_KEY_PATH = 'bedrockSecretAccessKey';
const KV_BEDROCK_CREDS_SET_PATH = 'bedrockCredsSet';

function kvUrl(path: string) {
  return `${CRIBL_API_URL}/kvstore/${path}`;
}

async function kvGet(path: string): Promise<string> {
  try {
    const r = await fetch(kvUrl(path));
    if (!r.ok) return '';
    return (await r.text()).trim();
  } catch {
    return '';
  }
}

async function kvPut(path: string, value: string): Promise<boolean> {
  try {
    const r = await fetch(kvUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: value,
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function kvPutEncrypted(path: string, value: string): Promise<boolean> {
  try {
    const r = await fetch(kvUrl(path) + '?encrypted=true', {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: value,
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function kvDelete(path: string): Promise<void> {
  try {
    await fetch(kvUrl(path), { method: 'DELETE' });
  } catch {
    // best-effort
  }
}

// ── AI Provider ───────────────────────────────────────────────────────────────
export type AIProvider = 'anthropic' | 'bedrock';

// ── Anthropic ─────────────────────────────────────────────────────────────────
export const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Recommended)' },
  { id: 'claude-opus-4-5', label: 'Claude Opus 4.5 (Most capable)' },
  { id: 'claude-haiku-3-5', label: 'Claude Haiku 3.5 (Fastest)' },
];

export const DEFAULT_MODEL = ANTHROPIC_MODELS[0].id;

export async function getStoredModel(): Promise<string> {
  const text = await kvGet(KV_MODEL_PATH);
  // Normalize: handle legacy values stored JSON-encoded ("claude-sonnet-4-5")
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'string' ? parsed : DEFAULT_MODEL;
  } catch {
    return text || DEFAULT_MODEL;
  }
}

export async function hasApiKey(): Promise<boolean> {
  const text = await kvGet(KV_ANTHROPIC_KEY_SET_PATH);
  return text === 'true';
}

// ── AWS Bedrock ────────────────────────────────────────────────────────────────
export const BEDROCK_MODELS = [
  { id: 'us.anthropic.claude-opus-4-6-v1', label: 'Claude Opus 4.6 (Bedrock)' },
  { id: 'us.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Bedrock)' },
  { id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5 (Bedrock)' },
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (Bedrock)' },
];

export const DEFAULT_BEDROCK_MODEL = 'us.anthropic.claude-sonnet-4-6';

export const BEDROCK_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-northeast-1',
  'ap-southeast-1',
  'ap-southeast-2',
];

export async function getStoredProvider(): Promise<AIProvider> {
  const text = await kvGet(KV_PROVIDER_PATH);
  return text === 'bedrock' ? 'bedrock' : 'anthropic';
}

export async function saveProvider(provider: AIProvider): Promise<void> {
  await kvPut(KV_PROVIDER_PATH, provider);
}

export interface BedrockCreds {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export async function getStoredBedrockCreds(): Promise<BedrockCreds> {
  const [region, accessKeyId, secretAccessKey] = await Promise.all([
    kvGet(KV_BEDROCK_REGION_PATH),
    kvGet(KV_BEDROCK_ACCESS_KEY_PATH),
    kvGet(KV_BEDROCK_SECRET_KEY_PATH),
  ]);
  return {
    region: region || 'us-east-1',
    accessKeyId,
    secretAccessKey,
  };
}

export async function saveBedrockCreds(region: string, accessKeyId: string, secretAccessKey: string): Promise<void> {
  await Promise.all([
    kvPut(KV_BEDROCK_REGION_PATH, region),
    kvPutEncrypted(KV_BEDROCK_ACCESS_KEY_PATH, accessKeyId),
    kvPutEncrypted(KV_BEDROCK_SECRET_KEY_PATH, secretAccessKey),
    kvPut(KV_BEDROCK_CREDS_SET_PATH, 'true'),
  ]);
}

export async function clearBedrockCreds(): Promise<void> {
  await Promise.all([
    kvDelete(KV_BEDROCK_ACCESS_KEY_PATH),
    kvDelete(KV_BEDROCK_SECRET_KEY_PATH),
    kvDelete(KV_BEDROCK_CREDS_SET_PATH),
  ]);
}

export async function hasBedrockCreds(): Promise<boolean> {
  const text = await kvGet(KV_BEDROCK_CREDS_SET_PATH);
  return text === 'true';
}
