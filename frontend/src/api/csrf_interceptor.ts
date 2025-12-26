/**
 * Автоматическая CSRF-подготовка и повтор запросов.
 *
 * Логика:
 * 1) при старте приложения запрашиваем CSRF cookie через /api/auth/csrf/ (если нужно),
 * 2) если API вернул 403 с признаком CSRF — делаем повторный запрос после обновления cookie.
 *
 * Это позволяет работать с Django session auth без ручной передачи CSRF токенов по всему коду.
 */
import axios from 'axios';
import { http } from './_http';

const CSRF_PATH = '/api/auth/csrf/';

let csrfReady = false;
let inFlight: Promise<void> | null = null;

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

async function ensureCsrf(): Promise<void> {
  if (csrfReady) return;
  if (inFlight) return inFlight;

  const ORIGIN_BASE = (http.defaults?.baseURL || '').toString().replace(/\/+$/, '').replace(/\/api$/i, '');
  const ax = axios.create({ baseURL: ORIGIN_BASE, withCredentials: true });

  inFlight = ax.get(CSRF_PATH, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
    .then(() => { csrfReady = true; })
    .catch(() => {})
    .finally(() => { inFlight = null; });

  return inFlight;
}

http.interceptors.request.use(async (config) => {
  const url = (config.url || '').toString();
  if (url.includes(CSRF_PATH)) return config;

  const token = getCookie('csrftoken');
  if (!token) await ensureCsrf();

  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options', 'trace'].includes(method)) {
    const t = getCookie('csrftoken');
    if (t) {
      config.headers = config.headers || {};
      if (!('X-CSRFToken' in (config.headers as any))) {
        (config.headers as any)['X-CSRFToken'] = t;
      }
    }
  }
  return config;
});

http.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg: any = error?.config || {};
    const status = error?.response?.status;
    const detail = String(error?.response?.data?.detail || '').toLowerCase();
    const isCsrf = status === 403 && detail.includes('csrf');
    if (isCsrf && !cfg.__csrfRetried) {
      csrfReady = false;
      await ensureCsrf();
      const t = getCookie('csrftoken');
      const nextCfg = { ...cfg, __csrfRetried: true, headers: { ...(cfg.headers || {}) } };
      if (t) (nextCfg.headers as any)['X-CSRFToken'] = t;
      return http.request(nextCfg);
    }
    return Promise.reject(error);
  }
);
