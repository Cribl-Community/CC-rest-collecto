export type BedrockChunk =
  | { type: 'text'; text: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string;
}

function criblApiBase(): string {
  return (window as unknown as { CRIBL_API_URL?: string }).CRIBL_API_URL ?? '/api/v1';
}

/**
 * Write the SigV4 Authorization header value to KV so the Cribl proxy can inject it.
 *
 * The Cribl proxy strips `Authorization` from all outgoing requests. The workaround:
 * store the per-request signed value at KV key `bedrockAuth` immediately before the
 * fetch, then proxies.yml injects it via `Authorization: kv.bedrockAuth`. Written as
 * a raw string (no JSON.stringify) so the proxy reads and injects the value verbatim.
 */
async function writeBedrockAuthToKv(authValue: string): Promise<void> {
  await fetch(`${criblApiBase()}/kvstore/bedrockAuth`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: authValue,
  });
}

/**
 * Stream from AWS Bedrock (Anthropic Claude via Bedrock API).
 *
 * Auth flow:
 *   1. Sign the request with SigV4 to obtain the Authorization header value.
 *   2. Write that value to KV key `bedrockAuth` immediately before fetching.
 *   3. proxies.yml injects `Authorization: kv.bedrockAuth` on all Bedrock domains.
 *   4. Forward all other SigV4 headers (x-amz-date, x-amz-content-sha256, etc.)
 *      directly in the fetch; omit Authorization and host.
 *
 * Response format: AWS binary EventStream frames (NOT SSE).
 */
export async function* streamBedrock(
  messages: BedrockMessage[],
  modelId: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  systemPrompt: string,
  signal?: AbortSignal,
): AsyncGenerator<BedrockChunk> {
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke-with-response-stream`;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 16000,
    system: systemPrompt,
    messages,
  });

  // SigV4 sign the request using the browser's native Web Crypto API.
  // @aws-crypto/sha256-js produces incorrect HMAC in some browser environments,
  // so we implement the hash interface with SubtleCrypto directly.
  let signedHeaders: Record<string, string>;
  try {
    const { SignatureV4 } = await import('@smithy/signature-v4');

    type SourceData = string | ArrayBuffer | ArrayBufferView;
    class WebCryptoSha256 {
      private key: Promise<CryptoKey> | null = null;
      private chunks: Uint8Array[] = [];
      constructor(secret?: SourceData) {
        if (secret !== undefined) {
          const raw: BufferSource =
            typeof secret === 'string'
              ? new TextEncoder().encode(secret)
              : ArrayBuffer.isView(secret)
              ? (secret as ArrayBufferView<ArrayBuffer>)
              : (secret as ArrayBuffer);
          this.key = crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        }
      }
      update(data: SourceData): void {
        const bytes: Uint8Array =
          typeof data === 'string'
            ? new TextEncoder().encode(data)
            : ArrayBuffer.isView(data)
            ? new Uint8Array((data as ArrayBufferView).buffer, (data as ArrayBufferView).byteOffset, (data as ArrayBufferView).byteLength)
            : new Uint8Array(data as ArrayBuffer);
        this.chunks.push(bytes);
      }
      async digest(): Promise<Uint8Array> {
        const combined = new Uint8Array(this.chunks.reduce((n, c) => n + c.length, 0));
        let offset = 0;
        for (const c of this.chunks) { combined.set(c, offset); offset += c.length; }
        if (this.key) {
          const k = await this.key;
          return new Uint8Array(await crypto.subtle.sign('HMAC', k, combined));
        }
        return new Uint8Array(await crypto.subtle.digest('SHA-256', combined));
      }
    }

    const url = new URL(endpoint);
    const signer = new SignatureV4({
      credentials: { accessKeyId, secretAccessKey },
      region,
      service: 'bedrock',
      sha256: WebCryptoSha256 as never,
      // url.pathname is already percent-encoded (e.g. %3A for ':' in the model ID).
      // uriEscapePath:true (default) would double-encode '%' → '%25%3A'.
      // Disable it so the path is used as-is.
      uriEscapePath: false,
    });

    const request = await signer.sign({
      method: 'POST',
      protocol: 'https:',
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        host: url.hostname,
      },
      body,
    });

    signedHeaders = request.headers as Record<string, string>;
  } catch (e) {
    yield { type: 'error', error: `SigV4 signing failed: ${String(e)}` };
    return;
  }

  // Write the Authorization value to KV so the proxy can inject it.
  // This must complete before the fetch — the proxy reads KV at request time.
  const authKey = Object.keys(signedHeaders).find(k => k.toLowerCase() === 'authorization');
  const authValue = (authKey ? signedHeaders[authKey] : '') ?? '';
  try {
    await writeBedrockAuthToKv(authValue);
  } catch (e) {
    yield { type: 'error', error: `Bedrock: failed to write auth to KV: ${String(e)}` };
    return;
  }

  // Forward SigV4 headers (x-amz-date, x-amz-content-sha256, etc.) but NOT
  // Authorization or host — Authorization is injected by the proxy from KV.
  const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  for (const [k, v] of Object.entries(signedHeaders)) {
    const lower = k.toLowerCase();
    if (lower === 'authorization' || lower === 'host') continue;
    fetchHeaders[k] = v;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: fetchHeaders,
    body,
    signal,
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    yield { type: 'error', error: `Bedrock error ${response.status}: ${err}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: 'No response body from Bedrock' };
    return;
  }

  // Bedrock invoke-with-response-stream returns AWS binary EventStream frames, NOT SSE.
  // Frame layout: [4B total_len][4B headers_len][4B prelude_crc][headers…][payload JSON][4B msg_crc]
  // Payload is {"bytes":"base64..."} where atob(bytes) is the Anthropic-format event JSON.
  const dec = new TextDecoder();
  let buf = new Uint8Array(0);

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (value) {
        const tmp = new Uint8Array(buf.length + value.length);
        tmp.set(buf);
        tmp.set(value, buf.length);
        buf = tmp;
      }

      // Parse all complete EventStream frames present in the buffer
      while (buf.length >= 16) {
        const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        const totalLen = view.getUint32(0, false); // big-endian
        if (totalLen < 16 || buf.length < totalLen) break;

        const headersLen = view.getUint32(4, false);
        const payloadStart = 12 + headersLen;
        const payloadEnd = totalLen - 4;

        if (payloadEnd > payloadStart) {
          const payloadText = dec.decode(buf.slice(payloadStart, payloadEnd));
          try {
            const envelope = JSON.parse(payloadText) as { bytes?: string; message?: string };
            if (envelope.bytes) {
              const eventText = atob(envelope.bytes);
              const event = JSON.parse(eventText) as {
                type: string;
                delta?: { type: string; text?: string };
              };
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                yield { type: 'text', text: event.delta.text ?? '' };
              } else if (event.type === 'message_stop') {
                yield { type: 'done' };
              }
            } else if (envelope.message) {
              yield { type: 'error', error: `Bedrock stream error: ${envelope.message}` };
              return;
            }
          } catch {
            // ignore malformed frames
          }
        }
        buf = buf.slice(totalLen);
      }

      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }

  yield { type: 'done' };
}
