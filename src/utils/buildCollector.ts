import type { CollectorConfig, ScheduleConfig, ParsedOperation } from '../context/WizardContext';

function buildCollectUrl(operation: ParsedOperation, config: CollectorConfig): string {
  if (config.collectUrl) return config.collectUrl;
  const base = (operation.servers[0] || '').replace(/\/$/, '');
  const path = operation.path;
  // Convert OpenAPI path params like {id} to JS expression syntax: `${id}`
  const exprPath = path.replace(/\{([^}]+)\}/g, (_: string, name: string) => `\${${name}}`);
  if (exprPath.includes('${')) {
    return `\`${base}${exprPath}\``;
  }
  return `'${base}${path}'`;
}

function mapMethod(method: string): CollectorConfig['collectMethod'] {
  const m = method.toLowerCase();
  if (m === 'get') return 'get';
  if (m === 'post') return 'post';
  return 'other';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCollectorJson(
  operation: ParsedOperation,
  config: CollectorConfig,
  schedule: ScheduleConfig,
): Record<string, unknown> {
  const collectUrl = buildCollectUrl(operation, config);

  const headers = config.requestHeaders.filter(h => h.name.trim());
  const params = config.requestParams.filter(p => p.name.trim());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conf: Record<string, any> = {
    collectUrl,
    collectMethod: mapMethod(config.collectMethod || operation.method),
    authentication: config.authentication,
    timeout: config.timeout,
    rejectUnauthorized: config.rejectUnauthorized,
    discovery: { discoverType: 'none' },
  };

  if (config.disableTimeFilter) conf.disableTimeFilter = true;

  if (headers.length > 0) {
    conf.collectRequestHeaders = headers.map(h => ({
      name: h.name,
      value: h.value.startsWith("'") || h.value.startsWith('`') ? h.value : `'${h.value}'`,
    }));
  }

  if (params.length > 0) {
    conf.collectRequestParams = params.map(p => ({
      name: p.name,
      value: p.value.startsWith("'") || p.value.startsWith('`') ? p.value : `'${p.value}'`,
    }));
  }

  if (config.paginationType !== 'none') {
    const p: Record<string, unknown> = { type: config.paginationType };
    switch (config.paginationType) {
      case 'response_body':
      case 'response_header':
        p.attribute = config.paginationAttribute;
        p.maxPages = config.paginationMaxPages;
        break;
      case 'response_header_link':
        p.nextRelationAttribute = config.paginationNextRelation || 'next';
        p.maxPages = config.paginationMaxPages;
        break;
      case 'request_offset':
        p.offsetField = config.paginationOffsetField;
        p.limitField = config.paginationLimitField;
        p.limit = config.paginationLimit;
        p.maxPages = config.paginationMaxPages;
        p.zeroIndexed = config.paginationZeroIndexed;
        break;
      case 'request_page':
        p.pageField = config.paginationPageField;
        p.sizeField = config.paginationSizeField;
        p.size = config.paginationSize;
        p.maxPages = config.paginationMaxPages;
        p.zeroIndexed = config.paginationZeroIndexed;
        break;
    }
    conf.pagination = p;
  }

  if (config.authentication === 'basic' || config.authentication === 'basicSecret') {
    conf.username = config.username || '';
    if (config.authentication === 'basic') conf.password = config.password || '';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runConf: Record<string, any> = {
    mode: 'run',
    logLevel: schedule.logLevel,
  };

  if (!config.disableTimeFilter) {
    runConf.timeRangeType = schedule.timeRangeType;
    if (schedule.timeRangeType === 'relative') {
      runConf.earliest = schedule.earliest;
      runConf.latest = schedule.latest;
    }
  }

  const job: Record<string, unknown> = {
    id: config.id || 'my-rest-collector',
    type: 'collection',
    ttl: '4h',
    removeFields: [],
    resumeOnBoot: false,
    schedule: {
      enabled: schedule.enabled,
      cronSchedule: schedule.cronSchedule,
      tz: schedule.tz,
      run: runConf,
      skipOnOverrun: true,
      maxConcurrentRuns: 1,
    },
    collector: {
      destructive: false,
      conf,
      type: 'rest',
    },
    input: {
      type: 'collection',
      sendToRoutes: config.sendToRoutes,
      ...(config.pipeline ? { pipeline: config.pipeline } : {}),
      ...(config.output && !config.sendToRoutes ? { output: config.output } : {}),
    },
  };

  if (config.description) {
    job.description = config.description;
  }

  return job;
}
