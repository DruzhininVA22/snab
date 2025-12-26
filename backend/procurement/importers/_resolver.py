
"""
Resolver для импорта прайсов.

Задача resolver'а — сопоставить строку входного файла (например, прайса поставщика) с номенклатурой SNAB.
В простейшем случае сопоставление идет по SKU; при необходимости можно учитывать контекст поставщика/категорию.
"""

from typing import Optional
from catalog.models import Item
from suppliers.models import Supplier
from ..services import supplier_map


def resolve_item_id_by_supplier_context(supplier_name_or_id, sku: str) -> Optional[int]:
    """
    Функция resolve_item_id_by_supplier_context относится к бизнес‑логике SNAB. См. код и параметры вызова.
    """

    if not sku:
        return None
    try:
        return Item.objects.only('id').get(sku=sku).id
    except Item.DoesNotExist:
        pass
    supplier_id = None
    if isinstance(supplier_name_or_id, int):
        supplier_id = supplier_name_or_id
    elif supplier_name_or_id:
        try:
            supplier_id = Supplier.objects.only('id').get(name=str(supplier_name_or_id)).id
        except Supplier.DoesNotExist:
            supplier_id = None
    if supplier_id:
        mapped = supplier_map.find_item_id_by_map(supplier_id, sku)
        if mapped:
            return mapped
    return None