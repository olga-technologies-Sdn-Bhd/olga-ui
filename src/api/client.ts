import type { ApiErrorBody, WithEtag } from './types';

// The dev Azure containers scale to zero and can take ~50 s to answer the
// first call after idling, so allow up to a minute before giving up.
const DEFAULT_TIMEOUT_MS = 60000;

// Client-side error codes, used when the server never returned a problem body.
export const NETWORK_ERROR = 'NETWORK_ERROR';
export const TIMEOUT = 'TIMEOUT';

export class ApiError extends Error {
  status: number; // 0 when the request never got an HTTP response
  code: string;
  correlationId?: string;
  fieldErrors?: Record<string, string[]>;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    correlationId?: string,
    fieldErrors?: Record<string, string[]>,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
    this.fieldErrors = fieldErrors;
    this.details = details;
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

// Entra access token for `Authorization: Bearer` (Docs/MOBILE_ENTRA_EXTERNAL_ID
// §7). Olga.Core doesn't validate it yet (MVP: X-Member-Id still identifies
// the member) — sent so the app is ready when the API starts enforcing it.
// Never logged.
let accessTokenProvider: () => string | null = () => null;

export function setAccessTokenProvider(provider: () => string | null) {
  accessTokenProvider = provider;
}

// Headers for an image the app loads straight from Core (<Image source>):
// the same member and token headers every other Core call carries.
export function imageHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const memberId = memberIdProvider();
  if (memberId) headers['X-Member-Id'] = memberId;
  const token = accessTokenProvider();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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
        body.field_errors,
        body.details
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

  // A FormData body (a picture upload) must not get a Content-Type: the
  // network layer adds multipart/form-data with its boundary.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const finalHeaders: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined && !isForm) finalHeaders['Content-Type'] = 'application/json';
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
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
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

// No answer yet (no network, timed out) or the gateway says the app is still
// starting: worth asking again. A real answer (4xx, 500) is not.
export function isTransient(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504);
}

// Dev Core scales to zero when idle, and its first answer can take over a
// minute. One long wait looks frozen and can still run out, so a call that
// must get through (sign-in) is tried several times with growing timeouts,
// each attempt on a fresh request. The first attempt also wakes the server.
// Pass the same idempotency key in every attempt for writes.
export const PATIENT_ATTEMPTS_MS = [15000, 20000, 25000, 30000];

export async function withRetries<T>(
  call: (timeoutMs: number) => Promise<T>,
  attemptsMs: number[] = PATIENT_ATTEMPTS_MS,
  pauseMs = 1000
): Promise<T> {
  let last: unknown;
  for (const [i, timeoutMs] of attemptsMs.entries()) {
    try {
      return await call(timeoutMs);
    } catch (error) {
      last = error;
      if (!isTransient(error) || i === attemptsMs.length - 1) break;
      await new Promise<void>((resolve) => setTimeout(resolve, pauseMs));
    }
  }
  throw last;
}

// Normalizes a response to one `etag`: the body's `e_tag` (what Core/NLP
// send), else the ETag response header.
export function withEtag<T extends { e_tag?: string }>(r: { data: T; headers: Headers }): WithEtag<T> {
  const { e_tag, ...rest } = r.data;
  return { ...rest, etag: e_tag ?? r.headers.get('ETag') ?? '' };
}

type ClientConfig = {
  // Add the signed-in user's Entra access token as a Bearer header.
  sendAccessToken?: boolean;
};

export function makeApiClient(baseUrl: string, config: ClientConfig = {}) {
  const withAuth = (options?: RequestOptions): RequestOptions | undefined => {
    const token = config.sendAccessToken ? accessTokenProvider() : null;
    return token ? { ...options, headers: { Authorization: `Bearer ${token}`, ...options?.headers } } : options;
  };
  const data = <T>(method: Method, path: string, body: unknown, options?: RequestOptions) =>
    send<T>(baseUrl, method, path, body, withAuth(options)).then((r) => r.data);

  return {
    get: <T>(path: string, options?: RequestOptions) => data<T>('GET', path, undefined, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) => data<T>('POST', path, body, options),
    put: <T>(path: string, body?: unknown, options?: RequestOptions) => data<T>('PUT', path, body, options),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) => data<T>('PATCH', path, body, options),
    del: <T>(path: string, options?: RequestOptions) => data<T>('DELETE', path, undefined, options),
    // Same as the above but also returns status + response headers (e.g. ETag).
    send: <T>(method: Method, path: string, body?: unknown, options?: RequestOptions) =>
      send<T>(baseUrl, method, path, body, withAuth(options)),
  };
}
