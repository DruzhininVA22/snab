
"""
Resolver для импорта прайсов.

Задача resolver'а — сопоставить строку входного файла (например, прайса поставщика) с номенклатурой SNAB.
В простейшем случае сопоставление идет по SKU; при необходимости можно учитывать контекст поставщика/категорию.


Логика: когда загружаем прайс-лист или импортируем счёт,
нужно понять какому Item'у соответствует артикул поставщика.

Возможные стратегии:
1. По ItemSupplierMapping (если сопоставление уже создано)
2. По точному совпадению SKU
3. По нечёткому поиску (contains)

"""

from typing import Optional
from catalog.models import Item
from suppliers.models import Supplier
from procurement.models import ItemSupplierMapping


def resolve_item_id_by_supplier_context(supplier_name, sku, strategy='auto'):
    """
    Разрешить Item ID по контексту поставщика и артикулу.
    
    Стратегии:
    - 'auto': попробовать все (по порядку)
    - 'mapping': только по ItemSupplierMapping
    - 'sku': только по точному совпадению Item.sku
    - 'fuzzy': нечёткий поиск
    
    Args:
        supplier_name: название поставщика (str)
        sku: артикул поставщика (str)
        strategy: стратегия поиска (auto/mapping/sku/fuzzy)
    
    Returns:
        (item_id, confidence): (int или None, float 0-1)
        
    Примеры:
        resolve_item_id_by_supplier_context('ООО Стройсервис', 'KR-001')
        → (5, 1.0)  # полное совпадение по ItemSupplierMapping
        
        resolve_item_id_by_supplier_context('ООО Стройсервис', 'UNKNOWN-SKU')
        → (None, 0.0)  # ничего не найдено
    """
    
    if not supplier_name or not sku:
        return None, 0.0
    
    supplier = None
    try:
        supplier = Supplier.objects.get(name=supplier_name)
    except Supplier.DoesNotExist:
        pass
    
    # Стратегия 1: ItemSupplierMapping (самая надёжная)
    if strategy in ('auto', 'mapping') and supplier:
        mapping = ItemSupplierMapping.objects.filter(
            price_list_line__price_list__supplier=supplier,
            price_list_line__supplier_sku=sku,
            is_active=True
        ).first()
        
        if mapping:
            return mapping.item_id, 1.0
    
    # Стратегия 2: Точное совпадение Item.sku
    if strategy in ('auto', 'sku'):
        item = Item.objects.filter(sku=sku).first()
        if item:
            return item.id, 1.0
    
    # Стратегия 3: Нечёткий поиск
    if strategy in ('auto', 'fuzzy'):
        items = Item.objects.filter(sku__icontains=sku)[:1]
        if items:
            return items[0].id, 0.8
    
    return None, 0.0


def find_possible_items_for_sku(sku, supplier_name=None, limit=5):
    """
    Найти возможные Item'ы для артикула поставщика.
    
    Используется для suggestions при импорте прайс-листов.
    
    Args:
        sku: артикул поставщика
        supplier_name: (опционально) название поставщика
        limit: максимум результатов
    
    Returns:
        list: [{id, sku, name, confidence}, ...]
    """
    
    results = []
    
    # Попытка 1: Точное совпадение SKU
    exact_matches = Item.objects.filter(sku=sku)
    for item in exact_matches[:limit]:
        results.append({
            'id': item.id,
            'sku': item.sku,
            'name': item.name,
            'confidence': 1.0,
            'match_type': 'exact_sku'
        })
    
    if len(results) >= limit:
        return results[:limit]
    
    # Попытка 2: ItemSupplierMapping (если указан поставщик)
    if supplier_name:
        try:
            supplier = Supplier.objects.get(name=supplier_name)
            mappings = ItemSupplierMapping.objects.filter(
                price_list_line__price_list__supplier=supplier,
                price_list_line__supplier_sku=sku,
                is_active=True
            ).select_related('item')
            
            for mapping in mappings[:limit]:
                if mapping.item.id not in [r['id'] for r in results]:
                    results.append({
                        'id': mapping.item.id,
                        'sku': mapping.item.sku,
                        'name': mapping.item.name,
                        'confidence': 1.0,
                        'match_type': 'supplier_mapping'
                    })
        except Supplier.DoesNotExist:
            pass
    
    if len(results) >= limit:
        return results[:limit]
    
    # Попытка 3: Нечёткий поиск (contains)
    fuzzy_matches = Item.objects.filter(sku__icontains=sku).exclude(
        id__in=[r['id'] for r in results]
    )
    for item in fuzzy_matches[:limit - len(results)]:
        results.append({
            'id': item.id,
            'sku': item.sku,
            'name': item.name,
            'confidence': 0.8,
            'match_type': 'fuzzy_sku'
        })
    
    return results[:limit]


def get_supplier_options_for_item(item_id):
    """
    Получить всех доступных поставщиков для Item'а.
    
    Returns:
        list: [{
            'supplier_id': int,
            'supplier_name': str,
            'supplier_sku': str,
            'price': Decimal,
            'is_preferred': bool,
            'lead_time_days': int
        }, ...]
    """
    
    from procurement.models import SupplierPriceListLine
    
    mappings = ItemSupplierMapping.objects.filter(
        item_id=item_id,
        is_active=True
    ).select_related(
        'price_list_line',
        'price_list_line__price_list',
        'price_list_line__price_list__supplier'
    ).order_by(
        '-is_preferred',
        'price_list_line__price'
    )
    
    options = []
    for mapping in mappings:
        line = mapping.price_list_line
        supplier = line.price_list.supplier
        
        options.append({
            'supplier_id': supplier.id,
            'supplier_name': supplier.name,
            'supplier_sku': line.supplier_sku,
            'price': line.price,
            'effective_price': line.effective_price,
            'is_preferred': mapping.is_preferred,
            'lead_time_days': line.lead_time_days,
            'conversion_factor': mapping.conversion_factor
        })
    
    return options


# ============================================================================
# Вспомогательные функции для импорта
# ============================================================================

def create_or_update_price_records_from_import(price_list_lines, supplier_id=None):
    """
    Создать или обновить PriceRecord'ы на основе импортированных данных.
    
    (Опционально, если нужна интеграция с устаревшей моделью PriceRecord)
    
    Args:
        price_list_lines: список SupplierPriceListLine объектов
        supplier_id: (опционально) ID поставщика
    
    Returns:
        int: количество созданных/обновленных PriceRecord'ов
    """
    
    from procurement.models import PriceRecord
    from datetime import date
    
    count = 0
    for line in price_list_lines:
        # Попытаться найти Item
        item_id = resolve_item_id_by_supplier_context(
            line.price_list.supplier.name,
            line.supplier_sku
        )[0]
        
        if not item_id:
            continue
        
        # Создать или обновить PriceRecord
        price_record, created = PriceRecord.objects.update_or_create(
            item_id=item_id,
            supplier=line.price_list.supplier,
            dt=date.today(),
            defaults={
                'price': line.price,
                'currency': line.price_list.currency,
                'lead_days': line.lead_time_days,
                'pack_qty': line.package_quantity,
                'moq_qty': line.min_quantity,
                'lot_step': line.quantity_step,
            }
        )
        
        count += 1
    
    return count
