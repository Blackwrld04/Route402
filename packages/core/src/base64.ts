/** Environment-neutral UTF-8 base64 helpers (work in Node >= 18 and browsers; no `Buffer`). */
export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function base64ToUtf8(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function bytesToUtf8(bytes: ArrayLike<number>): string {
  return new TextDecoder().decode(Uint8Array.from(bytes as ArrayLike<number>));
}
