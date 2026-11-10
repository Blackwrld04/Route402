import { base64ToUtf8, utf8ToBase64 } from './base64.js';
import type { X402ChallengeBody, X402PaymentPayload } from './types.js';

export const X402_HEADER_PAYMENT = 'x-payment';
export const X402_HEADER_PAYMENT_REQUIRED = 'x-payment-required';
export const X402_HEADER_PAYMENT_RESPONSE = 'x-payment-response';

export function encodeX402Header(data: unknown): string {
  return utf8ToBase64(JSON.stringify(data));
}

export function decodeX402PaymentHeader(rawHeader: string): X402PaymentPayload {
  const trimmed = rawHeader.trim();
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : base64ToUtf8(trimmed);
  const parsed = JSON.parse(jsonText) as X402PaymentPayload;
  if (parsed.x402Version !== 1 || !parsed.payload?.payerId || !parsed.payload?.requestId) {
    throw new Error('Malformed x402 X-PAYMENT payload');
  }
  return parsed;
}

export function decodeX402ChallengeHeader(rawHeader: string): X402ChallengeBody {
  const trimmed = rawHeader.trim();
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : base64ToUtf8(trimmed);
  return JSON.parse(jsonText) as X402ChallengeBody;
}

export function formatUsdc(microUsdc: string | bigint | number): string {
  const val = BigInt(microUsdc);
  const whole = val / 1_000_000n;
  const frac = (val % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '').padEnd(2, '0');
  return `${whole}.${frac}`;
}

export function formatNear(yocto: string | bigint): string {
  const val = BigInt(yocto);
  const whole = val / 1_000_000_000_000_000_000_000_000n;
  const milli = (val % 1_000_000_000_000_000_000_000_000n) / 1_000_000_000_000_000_000_000n;
  const milliStr = milli.toString().padStart(3, '0').replace(/0+$/, '');
  return milliStr ? `${whole}.${milliStr}` : `${whole}`;
}
