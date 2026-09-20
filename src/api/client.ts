export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  headers?: Record<string, string>;
};

async function request<T>(baseUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(response.status, text || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function makeApiClient(baseUrl: string) {
  return {
    get: <T>(path: string, headers?: Record<string, string>) => request<T>(baseUrl, path, { method: 'GET', headers }),
    post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
      request<T>(baseUrl, path, { method: 'POST', body, headers }),
    patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
      request<T>(baseUrl, path, { method: 'PATCH', body, headers }),
    del: <T>(path: string, headers?: Record<string, string>) => request<T>(baseUrl, path, { method: 'DELETE', headers }),
  };
}
