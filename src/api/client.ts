import type { ApiErrorBody } from './types';

const DEFAULT_TIMEOUT_MS = 15000;

// Client-side error codes, used when the server never returned a problem body.
export const NETWORK_ERROR = 'NETWORK_ERROR';
export const TIMEOUT = 'TIMEOUT';

export class ApiError extends Error {
  status: number; // 0 when the request never got an HTTP response
  code: string;
  correlationId?: string;
  fieldErrors?: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    correlationId?: string,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
    this.fieldErrors = fieldErrors;
  }
}

// X-Member-Id source. AuthContext registers this once the member ID is stored
// after POST /v1/members; until then no header is sent (the server then
// silently acts as dev member A123, so member-scoped calls must wait for it).
let memberIdProvider: () => string | null = () => null;

export function setMemberIdProvider(provider: () => string | null) {
  memberIdProvider = provider;
}

export function getMemberId() {
  return memberIdProvider();
}

// RFC 4122 v4 UUID. Math.random is fine here: idempotency keys only need to be
// unique per user action, not unguessable, and Hermes has no crypto.randomUUID.
export function newIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestOptions = {
  headers?: Record<string, string>;
  // Pass the same key when retrying the same user action after a network
  // failure; generate it once (newIdempotencyKey) outside any retry loop.
  // Omitted on a write → a fresh key is generated for this call.
  idempotencyKey?: string;
  timeoutMs?: number;
};

export type ApiResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
};

async function toApiError(response: Response): Promise<ApiError> {
  const headerCorrelationId = response.headers.get('X-Correlation-Id') ?? undefined;
  const text = await response.text().catch(() => '');
  try {
    const body = JSON.parse(text) as Partial<ApiErrorBody>;
    if (body && typeof body.code === 'string') {
      return new ApiError(
        response.status,
        body.code,
        body.message ?? response.statusText,
        body.correlation_id ?? headerCorrelationId,
        body.field_errors
      );
    }
  } catch {
    // not JSON — fall through to the raw text
  }
  return new ApiError(response.status, `HTTP_${response.status}`, text || response.statusText, headerCorrelationId);
}

async function send<T>(
  baseUrl: string,
  method: Method,
  path: string,
  body: unknown,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { headers = {}, idempotencyKey, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const finalHeaders: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  const memberId = memberIdProvider();
  if (memberId) finalHeaders['X-Member-Id'] = memberId;
  if (method !== 'GET') finalHeaders['Idempotency-Key'] = idempotencyKey ?? newIdempotencyKey();
  Object.assign(finalHeaders, headers);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    throw timedOut
      ? new ApiError(0, TIMEOUT, `Request timed out after ${timeoutMs} ms`)
      : new ApiError(0, NETWORK_ERROR, e instanceof Error ? e.message : 'Network request failed');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  const text = response.status === 204 ? '' : await response.text();
  return {
    data: (text ? JSON.parse(text) : undefined) as T,
    status: response.status,
    headers: response.headers,
  };
}

export function makeApiClient(baseUrl: string) {
  const data = <T>(method: Method, path: string, body: unknown, options?: RequestOptions) =>
    send<T>(baseUrl, method, path, body, options).then((r) => r.data);

  return {
    get: <T>(path: string, options?: RequestOptions) => data<T>('GET', path, undefined, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) => data<T>('POST', path, body, options),
    put: <T>(path: string, body?: unknown, options?: RequestOptions) => data<T>('PUT', path, body, options),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) => data<T>('PATCH', path, body, options),
    del: <T>(path: string, options?: RequestOptions) => data<T>('DELETE', path, undefined, options),
    // Same as the above but also returns status + response headers (e.g. ETag).
    send: <T>(method: Method, path: string, body?: unknown, options?: RequestOptions) =>
      send<T>(baseUrl, method, path, body, options),
  };
}
