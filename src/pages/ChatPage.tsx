import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizard } from '../context/WizardContext';
import {
  getStoredModel, hasApiKey,
  getStoredProvider, getStoredBedrockCreds, hasBedrockCreds, DEFAULT_BEDROCK_MODEL,
  type AIProvider, type BedrockCreds,
} from '../utils/settings';
import { streamBedrock } from '../utils/bedrock';
import type { CollectorConfig, ScheduleConfig } from '../context/WizardContext';
import { saveProject, loadProject, deriveProjectName } from '../utils/projectStorage';
import type { ChatMessage } from '../utils/projectStorage';

type Message = ChatMessage;

const SYSTEM_PROMPT = `You are an expert at building Cribl REST Collector configurations. Your job is to help users create a Cribl SavedJob configuration for a REST Collector based on their description of an API they want to collect data from.

When a user describes what data they want to pull, you should:
1. Identify the correct API endpoint and base URL
2. Determine the HTTP method (usually GET)
3. Identify authentication type and requirements
4. Identify relevant query parameters and request headers
5. Suggest appropriate pagination settings
6. Generate a complete, valid Cribl SavedJob JSON configuration

Always output the final configuration as a fenced JSON code block: \`\`\`json ... \`\`\`

## SavedJob schema for a REST Collector

\`\`\`json
{
  "id": "alphanumeric-hyphens-underscores",
  "type": "collection",
  "description": "optional description",
  "ttl": "4h",
  "removeFields": [],
  "resumeOnBoot": false,
  "schedule": {
    "enabled": true,
    "cronSchedule": "0 */4 * * *",
    "tz": "UTC",
    "run": {
      "mode": "run",
      "timeRangeType": "relative",
      "earliest": -14400,
      "latest": 0,
      "logLevel": "info"
    },
    "skipOnOverrun": true,
    "maxConcurrentRuns": 1
  },
  "collector": {
    "type": "rest",
    "destructive": false,
      "conf": {
      "collectUrl": "'https://api.example.com/endpoint'",
      "collectMethod": "get",
      "authentication": "none",
      "timeout": 30,
      "rejectUnauthorized": true,
      "collectRequestHeaders": [{"name": "Header-Name", "value": "'value'"}],
      "collectRequestParams": [{"name": "param", "value": "'value'"}],
      "pagination": {"type": "none"},
      "discovery": {"discoverType": "none"}
    }
  },
  "input": {
    "type": "collection",
    "sendToRoutes": true
  }
}
\`\`\`

### Discovery — HTTP example (collecting per-repo data across all repos)

\`\`\`json
"discovery": {
  "discoverType": "http",
  "discoverUrl": "'https://api.github.com/user/repos'",
  "discoverMethod": "get",
  "discoverRequestHeaders": [
    {"name": "Authorization", "value": "'Bearer ' + C.Secret('githubToken').value"},
    {"name": "Accept", "value": "'application/vnd.github+json'"}
  ],
  "discoverDataField": "",
  "pagination": {
    "type": "response_header_link",
    "nextRelationAttribute": "next",
    "maxPages": 100
  }
}
\`\`\`

After discovery runs, each item is available as \`__srcId\` in the collection URL expression, e.g.:
\`"collectUrl": "\\\`https://api.github.com/repos/\\\${__srcId}/issues\\\`"\`

### Discovery — list example

\`\`\`json
"discovery": {
  "discoverType": "list",
  "itemList": ["org1", "org2", "org3"]
}
\`\`\`

### Discovery — JSON (hard-coded) example

\`\`\`json
"discovery": {
  "discoverType": "json",
  "manualDiscoverResult": "{\\"items\\": [\\"a\\", \\"b\\"]}",
  "discoverDataField": "items"
}
\`\`\`

## Important rules

- **collectUrl** must be a JavaScript expression. Use single quotes for string literals: \`'https://api.example.com/path'\`
- For URLs with dynamic segments, use template literals: \`\`https://api.example.com/users/\${userId}\`\`
- **Header and param values** must be JS expressions — quoted strings or \`C.Secret("secretName").value\` for Cribl-managed secrets
- For **Bearer token** auth, use \`authentication: "none"\` and add an Authorization header with value \`"'Bearer ' + C.Secret('apiToken').value"\`
- For **API key** in header, add a header with the key name and value \`C.Secret("apiKeyName").value\`
- **Never** use \`kv.*\` for collector credentials — always use \`C.Secret("name").value\`. \`C.Secret()\` returns a secret object; you **must** append \`.value\` to get the string.
- For **basic auth**, use \`authentication: "basic"\` with \`username\` and \`password\` fields in conf
- **Pagination types**: \`none\`, \`response_body\`, \`response_header\`, \`response_header_link\`, \`request_offset\`, \`request_page\`
  - GitHub uses \`response_header_link\` (Link header)
  - Stripe, Twitter use cursor/offset in response body → \`response_body\`
  - Simple offset APIs use \`request_offset\`
- **discovery.discoverType** must always be present. Use \`"none"\` when there is no discovery.
- When discovery is used, the collection URL should reference discovered items using \`__srcId\` (e.g. as a template literal in the collectUrl expression).

## Common APIs quick reference

- **GitHub**: base \`https://api.github.com\`, Bearer token auth, Link header pagination; use discovery for repos/orgs
- **Stripe**: base \`https://api.stripe.com/v1\`, Bearer token (secret key), cursor pagination
- **Slack**: base \`https://slack.com/api\`, Bearer token, cursor pagination in response body
- **PagerDuty**: base \`https://api.pagerduty.com\`, Bearer token auth
- **Datadog**: base \`https://api.datadoghq.com/api/v2\`, API key + app key in headers
- **ServiceNow**: base \`https://<instance>.service-now.com/api\`, basic auth or Bearer

Ask a clarifying question if authentication method, API version, or specific fields are ambiguous. Keep questions concise — ask at most one at a time.`;

function extractJsonBlocks(text: string): string[] {
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  return matches.map(m => m[1].trim()).filter(s => s.startsWith('{'));
}

function parseSavedJob(raw: Record<string, unknown>): { collector: Partial<CollectorConfig>; schedule: Partial<ScheduleConfig> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conf: any = (raw.collector as any)?.conf ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sched: any = raw.schedule ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run: any = sched.run ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input: any = raw.input ?? {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const disc: any = conf.discovery ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const discPag: any = disc.pagination ?? {};

    const collector: Partial<CollectorConfig> = {
      id: typeof raw.id === 'string' ? raw.id : undefined,
      description: typeof raw.description === 'string' ? raw.description : undefined,
      collectUrl: conf.collectUrl,
      collectMethod: conf.collectMethod,
      authentication: conf.authentication ?? 'none',
      username: conf.username,
      password: conf.password,
      requestHeaders: Array.isArray(conf.collectRequestHeaders) ? conf.collectRequestHeaders : [],
      requestParams: Array.isArray(conf.collectRequestParams) ? conf.collectRequestParams : [],
      paginationType: conf.pagination?.type ?? 'none',
      paginationMaxPages: conf.pagination?.maxPages ?? 100,
      paginationAttribute: conf.pagination?.attribute ?? '',
      paginationNextRelation: conf.pagination?.nextRelationAttribute ?? 'next',
      paginationOffsetField: conf.pagination?.offsetField ?? '',
      paginationLimitField: conf.pagination?.limitField ?? '',
      paginationLimit: conf.pagination?.limit ?? 100,
      paginationPageField: conf.pagination?.pageField ?? '',
      paginationSizeField: conf.pagination?.sizeField ?? '',
      paginationSize: conf.pagination?.size ?? 100,
      paginationZeroIndexed: conf.pagination?.zeroIndexed ?? false,
      // Discovery
      discoverType: disc.discoverType ?? 'none',
      discoverUrl: disc.discoverUrl ?? '',
      discoverMethod: disc.discoverMethod ?? 'get',
      discoverRequestHeaders: Array.isArray(disc.discoverRequestHeaders) ? disc.discoverRequestHeaders : [],
      discoverDataField: disc.discoverDataField ?? '',
      discoverPaginationType: discPag.type ?? 'none',
      discoverPaginationMaxPages: discPag.maxPages ?? 100,
      discoverPaginationAttribute: discPag.attribute ?? '',
      discoverPaginationNextRelation: discPag.nextRelationAttribute ?? 'next',
      discoverPaginationOffsetField: discPag.offsetField ?? '',
      discoverPaginationLimitField: discPag.limitField ?? '',
      discoverPaginationLimit: discPag.limit ?? 100,
      discoverPaginationPageField: discPag.pageField ?? '',
      discoverPaginationSizeField: discPag.sizeField ?? '',
      discoverPaginationSize: discPag.size ?? 100,
      discoverPaginationZeroIndexed: discPag.zeroIndexed ?? false,
      manualDiscoverResult: disc.manualDiscoverResult ?? '',
      discoverJsonDataField: disc.discoverDataField ?? '',
      itemList: Array.isArray(disc.itemList) ? disc.itemList.join(', ') : (disc.itemList ?? ''),
      timeout: typeof conf.timeout === 'number' ? conf.timeout : 30,
      rejectUnauthorized: conf.rejectUnauthorized !== false,
      disableTimeFilter: conf.disableTimeFilter === true,
      sendToRoutes: input.sendToRoutes !== false,
      pipeline: input.pipeline,
      output: input.output,
    };

    const schedule: Partial<ScheduleConfig> = {
      enabled: sched.enabled !== false,
      cronSchedule: sched.cronSchedule ?? '0 */4 * * *',
      tz: sched.tz ?? 'UTC',
      timeRangeType: run.timeRangeType ?? 'relative',
      earliest: typeof run.earliest === 'number' ? run.earliest : -14400,
      latest: typeof run.latest === 'number' ? run.latest : 0,
      logLevel: run.logLevel ?? 'info',
    };

    return { collector, schedule };
  } catch {
    return null;
  }
}

function MessageBubble({
  msg,
  onLoad,
}: {
  msg: Message;
  onLoad?: (json: object) => void;
}) {
  const isUser = msg.role === 'user';

  // Split content into text and json blocks for rendering
  const parts: Array<{ type: 'text' | 'json'; content: string; parsed?: object }> = [];
  const remaining = msg.content;
  const blockRe = /```json\s*([\s\S]*?)```/g;
  let lastIdx = 0;
  let match;
  while ((match = blockRe.exec(msg.content)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', content: msg.content.slice(lastIdx, match.index) });
    }
    const jsonStr = match[1].trim();
    let parsed: object | undefined;
    try { parsed = JSON.parse(jsonStr); } catch { /* render as raw */ }
    parts.push({ type: 'json', content: jsonStr, parsed });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < remaining.length) {
    parts.push({ type: 'text', content: remaining.slice(lastIdx) });
  }

  return (
    <div className={`chat-message chat-message--${isUser ? 'user' : 'assistant'}`}>
      <div className="chat-bubble">
        {parts.map((part, i) => {
          if (part.type === 'text') {
            return (
              <p key={i} className="chat-text">
                {part.content}
              </p>
            );
          }
          return (
            <div key={i} className="chat-code-block">
              <div className="chat-code-toolbar">
                <span className="chat-code-lang">json</span>
                {part.parsed && onLoad && (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => onLoad(part.parsed!)}
                  >
                    Load into wizard →
                  </button>
                )}
                {!part.parsed && <span className="json-preview-error-badge">Invalid JSON</span>}
              </div>
              <pre className="chat-code-pre"><code>{part.content}</code></pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChatPage() {
  const {
    setCollectorConfig, setScheduleConfig, setSelectedOperation,
    selectedOperation, collectorConfig, scheduleConfig, parsedSpec,
    chatMessages, setChatMessages,
    chatDraft, setChatDraft,
    currentProjectId, setCurrentProjectId,
  } = useWizard();
  const navigate = useNavigate();
  const messages = chatMessages;
  // Keep a ref to the latest messages so async streaming callbacks never see stale closures
  const messagesRef = useRef<Message[]>(chatMessages);
  useEffect(() => { messagesRef.current = chatMessages; });
  const setMessages = (msgs: Message[] | ((prev: Message[]) => Message[])) => {
    const next = typeof msgs === 'function' ? msgs(messagesRef.current) : msgs;
    messagesRef.current = next;
    setChatMessages(next);
  };
  const input = chatDraft;
  const setInput = setChatDraft;
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyOk, setApiKeyOk] = useState<boolean | null>(null);
  const [model, setModel] = useState('claude-sonnet-4-5');
  const [provider, setProvider] = useState<AIProvider>('anthropic');
  const [bedrockCreds, setBedrockCreds] = useState<BedrockCreds>({ region: 'us-east-1', accessKeyId: '', secretAccessKey: '' });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function init() {
      const [p, ok, m, bedrockOk, creds] = await Promise.all([
        getStoredProvider(),
        hasApiKey(),
        getStoredModel(),
        hasBedrockCreds(),
        getStoredBedrockCreds(),
      ]);
      setProvider(p);
      setBedrockCreds(creds);
      if (p === 'bedrock') {
        setApiKeyOk(bedrockOk);
        setModel(DEFAULT_BEDROCK_MODEL);
      } else {
        setApiKeyOk(ok);
        setModel(m);
      }
    }
    init();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;
    setChatDraft('');
    setError(null);

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // Inject existing config context if a project is loaded
      let systemPrompt = SYSTEM_PROMPT;
      if (collectorConfig.collectUrl) {
        const existing = JSON.stringify({ collectorConfig, scheduleConfig }, null, 2);
        systemPrompt += `\n\n## Current Project Config\n\nThe user has an existing collector configuration loaded. Use it as the starting point for any changes:\n\`\`\`json\n${existing}\n\`\`\``;
      }

      let assistantText = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      if (provider === 'bedrock') {
        // ── Bedrock: AWS EventStream via generator ──────────────────────────
        const gen = streamBedrock(
          newMessages.map(m => ({ role: m.role, content: m.content })),
          model,
          bedrockCreds.region,
          bedrockCreds.accessKeyId,
          bedrockCreds.secretAccessKey,
          systemPrompt,
          ctrl.signal,
        );
        for await (const chunk of gen) {
          if (chunk.type === 'text') {
            assistantText += chunk.text;
            setMessages(prev => {
              const next = [...prev];
              next[next.length - 1] = { role: 'assistant', content: assistantText };
              return next;
            });
          } else if (chunk.type === 'error') {
            throw new Error(chunk.error);
          }
        }
      } else {
        // ── Anthropic: SSE streaming ────────────────────────────────────────
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            stream: true,
            system: systemPrompt,
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          }),
          signal: ctrl.signal,
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          let msg = `API error ${resp.status}`;
          try {
            const parsed = JSON.parse(errBody);
            msg = parsed?.error?.message ?? msg;
          } catch { /* use default */ }
          throw new Error(msg);
        }

        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const evt = JSON.parse(data);
              if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                assistantText += evt.delta.text;
                setMessages(prev => {
                  const next = [...prev];
                  next[next.length - 1] = { role: 'assistant', content: assistantText };
                  return next;
                });
              }
            } catch { /* skip malformed events */ }
          }
        }
      }

      // Auto-save project after each completed response
      autoSaveProject(messagesRef.current);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message);
      setMessages(prev => prev.filter((_, i) => i < prev.length - 1 || prev[prev.length - 1].content !== ''));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  async function autoSaveProject(currentMessages: Message[]) {
    try {
      const name = deriveProjectName(collectorConfig.id, parsedSpec?.title ?? '');
      // If an existing project already has a selectedOperation (e.g. came from wizard),
      // preserve it — don't overwrite with null just because we're on the chat page.
      let preservedOperation = selectedOperation;
      if (currentProjectId && !preservedOperation) {
        const existing = await loadProject(currentProjectId);
        preservedOperation = existing?.selectedOperation ?? null;
      }
      const saved = await saveProject({
        id: currentProjectId ?? undefined,
        createdAt: undefined,
        name,
        updatedAt: new Date().toISOString(),
        parsedSpec: parsedSpec ?? { title: name, version: '', servers: [], operations: [] },
        selectedOperation: preservedOperation,
        collectorConfig,
        scheduleConfig,
        chatMessages: currentMessages,
      });
      setCurrentProjectId(saved.id);
    } catch { /* silent — manual Save button is the fallback */ }
  }

  function handleStop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function handleLoad(json: object) {
    const raw = json as Record<string, unknown>;
    const result = parseSavedJob(raw);
    if (!result) return;

    const { collector, schedule } = result;
    const mergedCollector = { ...collectorConfig, ...collector } as CollectorConfig;
    const synthOperation = {
      method: (mergedCollector.collectMethod ?? 'get').toUpperCase(),
      path: mergedCollector.collectUrl ?? '',
      operationId: mergedCollector.id,
      summary: mergedCollector.description || undefined,
      tags: [] as string[],
      parameters: [] as import('../context/WizardContext').ParsedParameter[],
      servers: [] as string[],
    };

    setCollectorConfig(mergedCollector);
    setScheduleConfig({ ...scheduleConfig, ...schedule } as ScheduleConfig);
    setSelectedOperation(synthOperation);

    // Persist the loaded config so "Open" routes to the wizard next time
    try {
      const name = deriveProjectName(mergedCollector.id, parsedSpec?.title ?? '');
      const saved = await saveProject({
        id: currentProjectId ?? undefined,
        createdAt: undefined,
        name,
        updatedAt: new Date().toISOString(),
        parsedSpec: parsedSpec ?? { title: name, version: '', servers: [], operations: [] },
        selectedOperation: synthOperation,
        collectorConfig: mergedCollector,
        scheduleConfig: { ...scheduleConfig, ...schedule } as ScheduleConfig,
        chatMessages,
      });
      setCurrentProjectId(saved.id);
    } catch { /* non-fatal */ }

    navigate('/configure');
  }

  function handleClear() {
    setMessages([]);
    setError(null);
  }

  async function handleSaveProject() {
    setSaveStatus('saving');
    try {
      const name = deriveProjectName(collectorConfig.id, parsedSpec?.title ?? '');
      const saved = await saveProject({
        id: currentProjectId ?? undefined,
        createdAt: undefined,
        name,
        updatedAt: new Date().toISOString(),
        parsedSpec: parsedSpec ?? { title: name, version: '', servers: [], operations: [] },
        selectedOperation: null,
        collectorConfig,
        scheduleConfig,
        chatMessages: messages,
      });
      setCurrentProjectId(saved.id);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  }

  const hasJson = messages.some(m => extractJsonBlocks(m.content).length > 0);

  return (
    <div className="chat-shell">
      <div className="chat-header">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/spec')}>
          ← Wizard
        </button>
        <div className="chat-header-title">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="8" stroke="#00C58E" strokeWidth="1.5"/>
            <path d="M5 9.5L7.5 12L13 7" stroke="#00C58E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          AI Collector Builder
        </div>
        <div className="chat-header-actions">
          {messages.length > 0 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleClear}>
              Clear
            </button>
          )}
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={handleSaveProject}
            disabled={saveStatus === 'saving'}
            title={currentProjectId ? 'Update project' : 'Save as project'}
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : saveStatus === 'error' ? 'Error' : currentProjectId ? 'Update Project' : 'Save Project'}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/settings')}>
            ⚙ Settings
          </button>
        </div>
      </div>

      {apiKeyOk === false && (
        <div className="chat-api-warning">
          {provider === 'bedrock'
            ? 'No AWS Bedrock credentials configured.'
            : 'No Anthropic API key configured.'}{' '}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/settings')}>
            Configure in Settings →
          </button>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" stroke="#2a3147" strokeWidth="2"/>
                <path d="M14 24c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#00C58E" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="24" cy="24" r="3" fill="#00C58E"/>
                <path d="M24 27v5" stroke="#00C58E" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="chat-empty-title">Describe the API you want to collect</p>
            <p className="chat-empty-hint">
              Try: <em>"Pull GitHub starred repos for a given user, paginated"</em>
            </p>
            <p className="chat-empty-hint">
              Or: <em>"Collect Stripe payment events from the last 4 hours"</em>
            </p>
            <p className="chat-empty-hint">
              Or: <em>"Get PagerDuty incidents with status open or triggered"</em>
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            msg={msg}
            onLoad={msg.role === 'assistant' ? handleLoad : undefined}
          />
        ))}

        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="chat-message chat-message--assistant">
            <div className="chat-bubble">
              <span className="chat-typing">
                <span /><span /><span />
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="chat-error">
            <strong>Error:</strong> {error}
            {error.includes('key') || error.includes('auth') || error.includes('401') ? (
              <> — <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/settings')}>Check Settings →</button></>
            ) : null}
          </div>
        )}

        {hasJson && !streaming && (
          <div className="chat-load-hint">
            Click <strong>Load into wizard →</strong> on any config above to pre-fill the wizard and continue from the Configure step.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the API you want to collect… (Enter to send, Shift+Enter for new line)"
          rows={2}
          disabled={streaming || apiKeyOk === false}
          aria-label="Chat input"
        />
        {streaming ? (
          <button type="button" className="btn btn--ghost chat-send-btn" onClick={handleStop} title="Stop">
            ■ Stop
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary chat-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || apiKeyOk === false}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
