/**
 * API: сопоставление поставщиков (SupplierMap).
 *
 * Используется в импорте прайс-листов: помогает заранее "свести" наименования поставщиков
 * из Excel к реальным сущностям в справочнике SNAB.
 */
import { http, fixPath } from './_http';
export async function previewSupplierMap(rows: Array<any>) {
  const res = await http.post(fixPath('/api/procurement/supplier-map/preview/'), { rows });
  return res.data;
}
export async function upsertSupplierMap(rows: Array<any>) {
  const res = await http.post(fixPath('/api/procurement/supplier-map/upsert/'), { rows });
  return res.data;
}
