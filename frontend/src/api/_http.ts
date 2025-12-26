/**
 * Общий HTTP-клиент для фронтенда SNAB (axios instance).
 *
 * Особенности:
 * - работает с session-cookie (withCredentials=true),
 * - использует стандартные имена Django CSRF cookie/header,
 * - нормализует базовый адрес API (VITE_API_BASE) и пути запросов (fixPath),
 *   чтобы избежать ошибок вида "/api/api/...".
 */
import axios from 'axios';

/** VITE_API_BASE — только origin бэкенда (БЕЗ "/api") */
const RAW = (import.meta as any).env?.VITE_API_BASE?.toString().trim() || '';
const BASE = RAW.replace(/\/+$/, '').replace(/\/api$/i, '');

export const http = axios.create({
  baseURL: BASE,                  // только origin
  withCredentials: true,          // sessionid/csrftoken
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
});

export function fixPath(p: string): string {
  if (!p) return p;
  if (/^https?:\/\//i.test(p)) return p;
  let url = p.startsWith('/') ? p : '/' + p;
  try {
    const base = (http.defaults?.baseURL || '').toString().replace(/\/+$/, '');
    if (base.endsWith('/api') && /^\/api(\/|$)/i.test(url)) {
      url = url.replace(/^\/api/i, ''); // срезаем один "/api"
    }
  } catch {}
  return url;
}

// страховка от /api/api на уровне интерсептора
http.interceptors.request.use((cfg) => {
  const base = (cfg.baseURL ?? http.defaults.baseURL ?? '').toString().replace(/\/+$/, '');
  let url = (cfg.url ?? '').toString();
  if (base.endsWith('/api') && /^\/api(\/|$)/i.test(url)) url = url.replace(/^\/api/i, '');
  if (url && !url.startsWith('/')) url = '/' + url;
  cfg.url = url;
  return cfg;
});

// для отладки из консоли
// @ts-ignore
(window as any).__http = http;
