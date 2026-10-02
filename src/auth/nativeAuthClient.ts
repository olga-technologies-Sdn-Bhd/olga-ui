import { entraConfig, entraScopes } from './entraConfig';

// Microsoft Entra External ID Native Authentication REST API (email OTP kept
// inside the app). There is no React Native SDK — Microsoft ships MSAL native
// auth for Android/iOS/web only and documents calling the REST API directly
// from other frameworks:
// https://learn.microsoft.com/en-us/entra/identity-platform/reference-native-authentication-api
//
// Never log request bodies or responses: they carry the email, OTP and
// continuation/refresh tokens. Only error codes and timings are logged.
const BASE_URL = `${entraConfig.authority}/${entraConfig.tenantSubdomain}.onmicrosoft.com`;

export class NativeAuthError extends Error {
  readonly code: string;
  readonly subError?: string;
  readonly errorCodes: number[];
  readonly correlationId?: string;
  constructor(code: string, description: string, errorCodes: number[] = [], subError?: string, correlationId?: string) {
    super(description);
    this.name = 'NativeAuthError';
    this.code = code;
    this.subError = subError;
    this.errorCodes = errorCodes;
    this.correlationId = correlationId;
  }
}

// The tenant's app registration doesn't allow native auth yet (AADSTS550022
// "Confidential Client is not supported", or the API not enabled). The app
// then falls back to the Microsoft-hosted page so sign-in keeps working.
export function isNativeAuthUnavailable(error: unknown): boolean {
  return (
    error instanceof NativeAuthError &&
    (error.errorCodes.includes(550022) ||
      error.code === 'invalid_client' ||
      error.code === 'unauthorized_client' ||
      error.code === 'unsupported_challenge_type')
  );
}

export function isUserNotFound(error: unknown): boolean {
  return error instanceof NativeAuthError && (error.code === 'user_not_found' || error.errorCodes.includes(50034));
}

// Wrong or expired code: let the user retry or resend.
export function isInvalidCode(error: unknown): boolean {
  return (
    error instanceof NativeAuthError &&
    error.code === 'invalid_grant' &&
    (error.subError === 'invalid_oob_value' || error.errorCodes.includes(50181) || error.errorCodes.includes(50184))
  );
}

export function isExpiredSession(error: unknown): boolean {
  return error instanceof NativeAuthError && error.code === 'expired_token';
}

export type ChallengeResponse = {
  continuation_token: string;
  challenge_type?: string;
  challenge_target_label?: string; // masked email
  code_length?: number;
};
type ContinuationResponse = { continuation_token: string };
export type NativeTokenResponse = {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

const TIMEOUT_MS = 30000;

async function post<T>(path: string, params: Record<string, string>): Promise<T> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&'),
      signal: controller.signal,
    });
    const json = await response.json().catch(() => ({}));
    console.info(`[auth] ${path} HTTP ${response.status} in ${Date.now() - started} ms`);
    if (!response.ok || json.error) {
      console.warn(`[auth] ${path} error=${json.error} codes=${(json.error_codes ?? []).join(',')} correlation_id=${json.correlation_id}`);
      throw new NativeAuthError(
        json.error ?? 'unknown_error',
        json.error_description ?? `HTTP ${response.status}`,
        json.error_codes ?? [],
        json.suberror,
        json.correlation_id
      );
    }
    return json as T;
  } catch (error) {
    if (error instanceof NativeAuthError) throw error;
    console.warn(`[auth] ${path} network error after ${Date.now() - started} ms`);
    throw new NativeAuthError('network_error', 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}

const scope = entraScopes.join(' ');
const clientId = entraConfig.clientId;

export const nativeAuthClient = {
  // Sign-in: initiate -> challenge (sends the code) -> token(oob)
  signInInitiate: (username: string) =>
    post<ContinuationResponse>('/oauth2/v2.0/initiate', {
      client_id: clientId,
      username,
      challenge_type: 'oob redirect',
    }),
  signInChallenge: (continuationToken: string) =>
    post<ChallengeResponse>('/oauth2/v2.0/challenge', {
      client_id: clientId,
      continuation_token: continuationToken,
      challenge_type: 'oob redirect',
    }),
  signInToken: (continuationToken: string, oob: string) =>
    post<NativeTokenResponse>('/oauth2/v2.0/token', {
      client_id: clientId,
      continuation_token: continuationToken,
      grant_type: 'oob',
      oob,
      scope,
    }),

  // Sign-up: start -> challenge (sends the code) -> continue(oob) -> token
  // (continuation_token grant signs the new user in without a second OTP).
  signUpStart: (username: string) =>
    post<ContinuationResponse>('/signup/v1.0/start', {
      client_id: clientId,
      username,
      challenge_type: 'oob redirect',
    }),
  signUpChallenge: (continuationToken: string) =>
    post<ChallengeResponse>('/signup/v1.0/challenge', {
      client_id: clientId,
      continuation_token: continuationToken,
      challenge_type: 'oob redirect',
    }),
  signUpContinue: (continuationToken: string, oob: string) =>
    post<ContinuationResponse>('/signup/v1.0/continue', {
      client_id: clientId,
      continuation_token: continuationToken,
      grant_type: 'oob',
      oob,
    }),
  signInAfterSignUp: (continuationToken: string, username: string) =>
    post<NativeTokenResponse>('/oauth2/v2.0/token', {
      client_id: clientId,
      continuation_token: continuationToken,
      grant_type: 'continuation_token',
      username,
      scope,
    }),
};
