
from typing import Optional, List, Dict, Any
from django.db import connection

def find_item_id_by_map(supplier_id: int, supplier_sku: str) -> Optional[int]:
    sql = """
    SELECT item_id
    FROM procurement_supplieritemmap
    WHERE supplier_id = %s AND supplier_sku = %s AND is_active = TRUE
    LIMIT 1
    """
    with connection.cursor() as cur:
        cur.execute(sql, [supplier_id, supplier_sku])
        row = cur.fetchone()
        return row[0] if row else None

def upsert_map(supplier_id: int, supplier_sku: str, item_id: int, supplier_name: str = None) -> int:
    sql = """
    INSERT INTO procurement_supplieritemmap (supplier_id, supplier_sku, supplier_name, item_id, is_active)
    VALUES (%s, %s, %s, %s, TRUE)
    ON CONFLICT (supplier_id, supplier_sku)
    DO UPDATE SET item_id = EXCLUDED.item_id, supplier_name = COALESCE(EXCLUDED.supplier_name, procurement_supplieritemmap.supplier_name), is_active = TRUE, updated_at = NOW()
    RETURNING id
    """
    with connection.cursor() as cur:
        cur.execute(sql, [supplier_id, supplier_sku, supplier_name, item_id])
        row = cur.fetchone()
        return int(row[0])

def bulk_upsert(rows: List[Dict[str, Any]]) -> int:
    cnt = 0
    for r in rows:
        if not (r.get('supplier_id') and r.get('supplier_sku') and r.get('item_id')):
            continue
        upsert_map(r['supplier_id'], r['supplier_sku'], r['item_id'], r.get('supplier_name'))
        cnt += 1
    return cnt
