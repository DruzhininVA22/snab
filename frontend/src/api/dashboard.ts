/**
 * API: метрики дашборда.
 *
 * Дашборд агрегирует показатели по закупкам (кол-во заявок/заказов, статусные срезы и т.п.).
 * Формат ответа зависит от backend-эндпоинта /api/procurement/metrics/overview/.
 */
import { http, fixPath } from './_http';

export async function fetchOverviewMetrics() {
  const url = fixPath('/api/procurement/metrics/overview/');
  const res = await http.get(url);
  return res.data;
}
