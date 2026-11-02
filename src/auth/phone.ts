import { ApiError, withRetries } from '../api/client';
import type { PhoneVerificationCheckResponse } from '../api/types';

// Phone OTP (Core + Twilio Verify). The phone, the code and the proof are
// sensitive: held in memory only, never stored, logged or sent anywhere else.

export const PHONE_CODE_LENGTH = 6;
export const PHONE_RESEND_COOLDOWN_S = 60;

// The proof lasts 300 s; treat it as gone a little early so a registration
// never starts with one that expires on the way.
const PROOF_MARGIN_MS = 10000;
const PROOF_LIFETIME_MS = 300000;

// Core only accepts E.164: +<country code><number>, no spaces or brackets.
export function normalizePhone(input: string): string | null {
  const phone = input.replace(/[\s\-().]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

// Outside the phone-entry field the number is never shown in full.
export function maskPhone(phone: string): string {
  return `•••• ${phone.slice(-4)}`;
}

export type PhoneProof = { phone: string; token: string; expiresAt: number };

export function proofFrom(phone: string, response: PhoneVerificationCheckResponse, now = Date.now()): PhoneProof {
  const expires = Date.parse(response.expires_at);
  return { phone, token: response.verification_token, expiresAt: Number.isFinite(expires) ? expires : now + PROOF_LIFETIME_MS };
}

export function proofIsFresh(proof: PhoneProof | null | undefined, now = Date.now()): proof is PhoneProof {
  return Boolean(proof) && now < proof!.expiresAt - PROOF_MARGIN_MS;
}

// The proof is missing, expired, or for another number: verify again.
export class PhoneProofExpiredError extends Error {
  constructor() {
    super('The phone verification has expired');
    this.name = 'PhoneProofExpiredError';
  }
}

export type PhoneProblem = {
  message: string;
  // The proof is gone or wrong: go back and verify the number again.
  restart: boolean;
};

const WAIT_MESSAGE = 'Too many tries. Please wait a little and try again.';

// What to tell the user for a failed send / check / registration call.
export function phoneProblem(error: unknown): PhoneProblem {
  if (error instanceof PhoneProofExpiredError) {
    return { message: 'Your verification has expired. Please verify your number again.', restart: true };
  }
  if (!(error instanceof ApiError)) return { message: 'Something went wrong. Please try again.', restart: false };
  switch (error.code) {
    case 'MEMBER_PHONE_INVALID':
      return { message: "That number doesn't look right. Include your country code, e.g. +60 12 345 6789.", restart: false };
    case 'PHONE_VERIFICATION_CODE_INVALID':
      return { message: "That code didn't work. Check it, or resend a new one.", restart: false };
    case 'PHONE_VERIFICATION_REQUIRED':
    case 'PHONE_VERIFICATION_INVALID':
      return { message: 'Your verification has expired. Please verify your number again.', restart: true };
    case 'PHONE_VERIFICATION_RATE_LIMITED':
      return {
        message: error.retryAfterSeconds
          ? `Too many tries. Please wait ${error.retryAfterSeconds} seconds and try again.`
          : WAIT_MESSAGE,
        restart: false,
      };
  }
  if (error.status === 429) return { message: WAIT_MESSAGE, restart: false };
  if (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504) {
    return { message: "Couldn't reach Ol-ga. Check your connection and try again.", restart: false };
  }
  return { message: 'Something went wrong. Please try again.', restart: false };
}

// The attempts a phone call gets while Core wakes up or Twilio is busy. Every
// attempt carries the same Idempotency-Key (the caller makes it once), so a
// retry never sends a second text or registers a second member.
const PHONE_ATTEMPTS_MS = [15000, 20000, 25000];
const IN_PROGRESS_PAUSE_MS = 1500;
const IN_PROGRESS_RETRIES = 2;

export async function withPhoneRetries<T>(call: (timeoutMs: number) => Promise<T>, pauseMs = IN_PROGRESS_PAUSE_MS): Promise<T> {
  for (let retry = 0; ; retry++) {
    try {
      return await withRetries(call, PHONE_ATTEMPTS_MS);
    } catch (error) {
      const inProgress = error instanceof ApiError && error.status === 409 && error.code === 'PHONE_VERIFICATION_IN_PROGRESS';
      // 409 IN_PROGRESS: the same action is still running; ask again shortly.
      if (!inProgress || retry >= IN_PROGRESS_RETRIES) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, pauseMs));
    }
  }
}
