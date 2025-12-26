"""
DRF сериализаторы приложения procurement.

Отвечают за формы/ответы API по заявкам, заказам, котировкам и прайсам.
"""

from rest_framework import serializers
from .models import PurchaseRequest, PurchaseRequestLine, PurchaseOrder, PurchaseOrderLine, Quote, QuoteLine, PriceRecord


class PurchaseRequestLineSerializer(serializers.ModelSerializer):
    """
    PurchaseRequestLineSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: PurchaseRequestLine.
    Поля ответа/запроса:
    - id
    - request
    - item
    - item_sku
    - item_name
    - qty
    - unit
    - need_date
    - deadline_at
    - status
    - … ещё 5 полей
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    item_name = serializers.CharField(source='item.name', read_only=True)
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    
    class Meta:
        model = PurchaseRequestLine
        fields = ['id', 'request', 'item', 'item_sku', 'item_name', 'qty', 'unit', 'need_date', 'deadline_at', 'status', 'comment', 'priority', 'task', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class PurchaseRequestSerializer(serializers.ModelSerializer):
    """
    PurchaseRequestSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: PurchaseRequest.
    Поля ответа/запроса:
    - id
    - project
    - project_stage
    - status
    - requested_by
    - comment
    - deadline
    - lines
    - created_at
    - updated_at
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    lines = PurchaseRequestLineSerializer(many=True, read_only=True)
    
    class Meta:
        model = PurchaseRequest
        fields = ['id', 'project', 'project_stage', 'status', 'requested_by', 'comment', 'deadline', 'lines', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class PriceRecordSerializer(serializers.ModelSerializer):
    """
    PriceRecordSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: PriceRecord.
    Поля ответа/запроса:
    - id
    - item
    - item_sku
    - supplier
    - supplier_name
    - price
    - currency
    - pack_qty
    - lead_days
    - moq_qty
    - … ещё 2 полей
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    item_sku = serializers.CharField(source='item.sku', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    
    class Meta:
        model = PriceRecord
        fields = ['id', 'item', 'item_sku', 'supplier', 'supplier_name', 'price', 'currency', 'pack_qty', 'lead_days', 'moq_qty', 'lot_step', 'dt']
        read_only_fields = ['dt']


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    """
    PurchaseOrderLineSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: PurchaseOrderLine.
    Поля ответа/запроса:
    - id
    - order
    - item
    - item_sku
    - item_name
    - qty
    - price
    - status
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    item_sku = serializers.CharField(source='item.sku', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    
    class Meta:
        model = PurchaseOrderLine
        fields = ['id', 'order', 'item', 'item_sku', 'item_name', 'qty', 'price', 'status']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    """
    PurchaseOrderSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: PurchaseOrder.
    Поля ответа/запроса:
    - id
    - number
    - supplier
    - supplier_name
    - status
    - lines
    - created_at
    - updated_at
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    lines = PurchaseOrderLineSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    
    class Meta:
        model = PurchaseOrder
        fields = ['id', 'number', 'supplier', 'supplier_name', 'status', 'lines', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class QuoteLineSerializer(serializers.ModelSerializer):
    """
    QuoteLineSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: QuoteLine.
    Поля ответа/запроса:
    - id
    - quote
    - item
    - item_sku
    - item_name
    - vendor_sku
    - name
    - unit
    - price
    - currency
    - … ещё 4 полей
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    item_sku = serializers.CharField(source='item.sku', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    
    class Meta:
        model = QuoteLine
        fields = ['id', 'quote', 'item', 'item_sku', 'item_name', 'vendor_sku', 'name', 'unit', 'price', 'currency', 'lead_days', 'moq_qty', 'pack_qty', 'lot_step']


class QuoteSerializer(serializers.ModelSerializer):
    """
    QuoteSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: Quote.
    Поля ответа/запроса:
    - id
    - supplier
    - supplier_name
    - purchase_request
    - file_path
    - source
    - lines
    - created_at
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    lines = QuoteLineSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    
    class Meta:
        model = Quote
        fields = ['id', 'supplier', 'supplier_name', 'purchase_request', 'file_path', 'source', 'lines', 'created_at']
        read_only_fields = ['created_at']