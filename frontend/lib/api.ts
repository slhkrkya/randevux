'use client';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL!;

type FetchOpts = {
  method?: string;
  body?: any;
  token?: string;
};

export async function api<T = any>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { method = 'GET', body, token } = opts;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* noop */ }

  if (!res.ok) {
    const msg = data?.message || text || res.statusText;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL!;
// Tüm isteklerde aynı tabanı kullanımı
export async function apiGet(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}
// Yardımcı: <input type="datetime-local"> -> ISO string
export function toISO(dtLocal: string) {
  return new Date(dtLocal).toISOString(); // örn: "2025-08-27T07:00:00.000Z"
}