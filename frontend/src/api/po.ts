/**
 * API: закупочные заказы (Purchase Orders).
 *
 * Функции в этом модуле — тонкая обёртка над REST-эндпоинтами backend.
 * Возвращаем "сырой" data, чтобы UI мог гибко подстроиться под структуру ответа.
 */
import { http, fixPath } from './_http';

export async function listPurchaseOrders(params: Record<string, any> = {}) {
  const query = new URLSearchParams(params as any).toString();
  const url = fixPath('/api/procurement/purchase-orders/') + (query ? ('?' + query) : '');
  const res = await http.get(url);
  return res.data;
}
