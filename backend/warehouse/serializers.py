"""
DRF сериализаторы приложения warehouse.

Используются для передачи складских сущностей (склады/остатки) через API.
"""

from rest_framework import serializers
from .models import Warehouse, Stock


class WarehouseSerializer(serializers.ModelSerializer):
    """
    WarehouseSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: Warehouse.
    Поля ответа/запроса:
    - id
    - code
    - name
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    class Meta:
        model = Warehouse
        fields = ['id', 'code', 'name']


class StockSerializer(serializers.ModelSerializer):
    """
    StockSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: Stock.
    Поля ответа/запроса:
    - id
    - item
    - item_sku
    - item_name
    - wh
    - wh_name
    - qty
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    item_sku = serializers.CharField(source='item.sku', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    wh_name = serializers.CharField(source='wh.name', read_only=True)
    
    class Meta:
        model = Stock
        fields = ['id', 'item', 'item_sku', 'item_name', 'wh', 'wh_name', 'qty']