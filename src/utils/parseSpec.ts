import yaml from 'js-yaml';
import type { ParsedSpec, ParsedOperation, ParsedParameter } from '../context/WizardContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

function extractServersV3(spec: AnyObj): string[] {
  if (Array.isArray(spec.servers) && spec.servers.length > 0) {
    return spec.servers.map((s: AnyObj) => s.url as string).filter(Boolean);
  }
  return [''];
}

function extractServersV2(spec: AnyObj): string[] {
  const scheme = (Array.isArray(spec.schemes) ? spec.schemes[0] : 'https') || 'https';
  const host = spec.host || '';
  const basePath = spec.basePath || '';
  if (host) return [`${scheme}://${host}${basePath}`];
  return [basePath || ''];
}

function resolveRef(spec: AnyObj, ref: string): AnyObj {
  const parts = ref.replace(/^#\//, '').split('/');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = spec;
  for (const part of parts) {
    if (cur == null) return {};
    cur = cur[decodeURIComponent(part.replace(/~1/g, '/').replace(/~0/g, '~'))];
  }
  return cur || {};
}

function normalizeParam(spec: AnyObj, raw: AnyObj): ParsedParameter {
  const p: AnyObj = raw.$ref ? resolveRef(spec, raw.$ref as string) : raw;
  // OpenAPI 3: enums live in p.schema.enum; OpenAPI 2: top-level p.enum
  const enumValues: string[] | undefined =
    (Array.isArray(p.schema?.enum) ? p.schema.enum : undefined) ??
    (Array.isArray(p.enum) ? p.enum : undefined);
  return {
    name: p.name || '',
    in: p.in || 'query',
    required: !!p.required,
    description: p.description,
    schema: p.schema || (p.type ? { type: p.type, example: p.example } : undefined),
    example: p.example ?? p.schema?.example,
    enum: enumValues,
  };
}

function parseV3(spec: AnyObj): ParsedSpec {
  const servers = extractServersV3(spec);
  const operations: ParsedOperation[] = [];

  const paths: AnyObj = spec.paths || {};
  for (const [path, pathItem] of Object.entries(paths)) {
    const pi = pathItem as AnyObj;
    const pathParams: AnyObj[] = Array.isArray(pi.parameters) ? pi.parameters : [];
    const pathServers = extractServersV3(pi);

    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    for (const method of methods) {
      const op: AnyObj = pi[method];
      if (!op) continue;

      const opParams: AnyObj[] = Array.isArray(op.parameters) ? op.parameters : [];
      const allRaw = [...pathParams, ...opParams];
      const seen = new Set<string>();
      const params: ParsedParameter[] = [];
      for (const raw of allRaw) {
        const normalized = normalizeParam(spec, raw);
        const key = `${normalized.in}:${normalized.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          params.push(normalized);
        }
      }

      const opServers = op.servers ? extractServersV3(op) : pathServers.length ? pathServers : servers;

      operations.push({
        method: method.toUpperCase(),
        path,
        operationId: op.operationId,
        summary: op.summary,
        description: op.description,
        tags: Array.isArray(op.tags) ? op.tags : [],
        parameters: params,
        servers: opServers,
      });
    }
  }

  return {
    title: spec.info?.title || 'Untitled API',
    version: spec.info?.version || '',
    description: spec.info?.description,
    servers,
    operations,
  };
}

function parseV2(spec: AnyObj): ParsedSpec {
  const servers = extractServersV2(spec);
  const operations: ParsedOperation[] = [];

  const paths: AnyObj = spec.paths || {};
  for (const [path, pathItem] of Object.entries(paths)) {
    const pi = pathItem as AnyObj;
    const pathParams: AnyObj[] = Array.isArray(pi.parameters) ? pi.parameters : [];

    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    for (const method of methods) {
      const op: AnyObj = pi[method];
      if (!op) continue;

      const opParams: AnyObj[] = Array.isArray(op.parameters) ? op.parameters : [];
      const allRaw = [...pathParams, ...opParams];
      const seen = new Set<string>();
      const params: ParsedParameter[] = [];
      for (const raw of allRaw) {
        const normalized = normalizeParam(spec, raw);
        const key = `${normalized.in}:${normalized.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          params.push(normalized);
        }
      }

      operations.push({
        method: method.toUpperCase(),
        path,
        operationId: op.operationId,
        summary: op.summary,
        description: op.description,
        tags: Array.isArray(op.tags) ? op.tags : [],
        parameters: params,
        servers,
      });
    }
  }

  return {
    title: spec.info?.title || 'Untitled API',
    version: spec.info?.version || '',
    description: spec.info?.description,
    servers,
    operations,
  };
}

export function parseSpec(input: string): ParsedSpec {
  let raw: AnyObj;

  const trimmed = input.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    raw = JSON.parse(input);
  } else {
    raw = yaml.load(input) as AnyObj;
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Could not parse spec: not a valid JSON or YAML object.');
  }

  if (raw.openapi && String(raw.openapi).startsWith('3')) {
    return parseV3(raw);
  }

  if (raw.swagger && String(raw.swagger).startsWith('2')) {
    return parseV2(raw);
  }

  // Best-effort: try v3 path if paths exist
  if (raw.paths) {
    return raw.info ? parseV3(raw) : parseV2(raw);
  }

  throw new Error('Unsupported spec format. Please provide an OpenAPI 2.x or 3.x document.');
}
