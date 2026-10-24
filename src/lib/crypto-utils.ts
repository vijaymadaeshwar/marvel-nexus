// crypto-utils.ts — Web Crypto API utilities for Marvel Nexus watch parties

const PARTY_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
}

function getRandomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function generatePartyCode(length = 8): Promise<string> {
  const bytes = getRandomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += PARTY_CODE_CHARSET[bytes[i] % PARTY_CODE_CHARSET.length];
  }
  return code;
}

export async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(data: string, key: CryptoKey): Promise<string> {
  const iv = getRandomBytes(12);
  const encoded = new TextEncoder().encode(data);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded as BufferSource
  );

  const ciphertextBytes = new Uint8Array(ciphertext);
  const combined = new Uint8Array(iv.length + ciphertextBytes.length);
  combined.set(iv, 0);
  combined.set(ciphertextBytes, iv.length);

  return toBase64(combined.buffer as ArrayBuffer);
}

export async function decrypt(encrypted: string, key: CryptoKey): Promise<string> {
  const combined = fromBase64(encrypted);
  if (combined.length < 12) throw new Error('Invalid encrypted data: too short');

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext as BufferSource
  );

  return new TextDecoder().decode(plaintext);
}

export async function hashString(str: string): Promise<string> {
  const encoded = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded as BufferSource);
  return toHex(hashBuffer);
}

export async function generateSecureId(): Promise<string> {
  const bytes = getRandomBytes(24);
  return toHex(bytes.buffer as ArrayBuffer);
}

export async function sign(data: string, key: CryptoKey): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const signature = await crypto.subtle.sign(
    { name: 'HMAC', hash: 'SHA-256' },
    key,
    encoded as BufferSource
  );
  return toBase64(signature);
}

export async function verify(data: string, signature: string, key: CryptoKey): Promise<boolean> {
  try {
    const encoded = new TextEncoder().encode(data);
    const sigBytes = fromBase64(signature);
    return await crypto.subtle.verify(
      { name: 'HMAC', hash: 'SHA-256' },
      key,
      sigBytes as BufferSource,
      encoded as BufferSource
    );
  } catch {
    return false;
  }
}

export async function generateHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64(raw as ArrayBuffer);
}

export async function importAesKey(base64: string): Promise<CryptoKey> {
  const raw = fromBase64(base64);
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}
