import { ApiError, createApiClient, type Query, type StoredSession, type TokenStorage } from '@estateflow/shared';

export { ApiError, type Query };

declare global {
  interface Window {
    ESTATEFLOW_CONFIG?: { apiUrl?: string; appDownloadUrl?: string };
  }
}

/**
 * API origin. The dashboard (Netlify) and the API are deployed separately: /env.js can re-point a
 * deployed build without rebuilding, otherwise VITE_API_URL from build time. Empty = same origin
 * (local dev goes through the Vite proxy).
 */
export const serverUrl = () => (window.ESTATEFLOW_CONFIG?.apiUrl || (import.meta.env.VITE_API_URL as string | undefined) || '').trim().replace(/\/+$/, '');

const KEY = 'ef_session';

/** "Keep me signed in" sessions live in localStorage; others end with the browser tab (sessionStorage). */
const storage: TokenStorage = {
  load() {
    try {
      const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      return null;
    }
  },
  save(s) {
    try {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
      (s.remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable (private mode): the session lasts until reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

let expiredHandler: ((reason: string) => void) | null = null;
export const onSessionExpired = (fn: (reason: string) => void) => {
  expiredHandler = fn;
};

const client = createApiClient({
  client: 'dashboard',
  baseUrl: serverUrl,
  storage,
  onSessionExpired: (reason) => expiredHandler?.(reason),
});

export const auth = client.auth;
export const events = client.events;

export const api = {
  ...client.api,
  /** Fetches a protected file with the auth header and saves it. */
  async download(path: string, fallbackName: string, query?: Query) {
    const { blob, fileName } = await client.api.download(path, fallbackName, query);
    saveBlob(blob, fileName);
  },
  /** Opens a protected PDF/image in a new tab (e.g. a receipt preview). */
  async open(path: string, fallbackName: string) {
    const win = window.open('', '_blank');
    try {
      const { blob } = await client.api.download(path, fallbackName);
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else saveBlob(blob, fallbackName);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      win?.close();
      throw e;
    }
  },
};

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
