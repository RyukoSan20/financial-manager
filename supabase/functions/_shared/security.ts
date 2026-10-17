// JWT/Security utilities for Supabase Edge Functions

import { createRemoteJWKSet, jwtVerify } from 'https://esm.sh/jose@2.0.6';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// JWKS for verifying Supabase JWTs
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

export interface JWTPayload {
  sub: string;        // User ID
  email?: string;
  role?: string;
  aud?: string;
  exp?: number;
  iat?: number;
}

export async function verifyJWT(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    });
    return payload as unknown as JWTPayload;
  } catch (err) {
    console.error('JWT verification failed:', err);
    throw new Error('Invalid token');
  }
}

// Simple token creation for backend-only operations (guest login)
export function createSimpleToken(userId: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: userId.toString(),
    iat: Date.now(),
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
  }));
  const signature = btoa(`${header}.${payload}.secret`); // Simple for Edge
  return `${header}.${payload}.${signature}`;
}

export function verifySimpleToken(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Date.now()) return null;
    return parseInt(payload.sub);
  } catch {
    return null;
  }
}

// Password hashing using Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'finmanager_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}
