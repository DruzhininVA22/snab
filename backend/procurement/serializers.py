"""
serializers.py — сериализаторы для модуля закупок (procurement).

Фокус:
- PriceRecord — чтение истории цен,
- PurchaseRequest — заявка на закупку,
- PurchaseRequestLine — строки заявки с nested‑созданием/редактированием,
- PurchaseOrder — заказы поставщикам,
- Quote / QuoteLine — коммерческие предложения,
- Shipment (view‑модель) — доставки на базе PurchaseOrder.
- SupplierPriceListSerializer
- SupplierPriceListLineSerializer
- ItemSupplierMappingSerializer
"""

from rest_framework import serializers
from decimal import Decimal
from django.db.models import Q

from suppliers.models import Supplier
from catalog.models import Item
from core.models import Unit

from .models import (
    PriceRecord,
    PurchaseRequest,
    PurchaseRequestLine,
    PurchaseOrder,
    PurchaseOrderLine,
    Quote,
    QuoteLine,
    SupplierPriceList,
    SupplierPriceListLine,
    ItemSupplierMapping,
)
from projects.models import Project, ProjectStage


# ============================================================
# PriceRecord — история цен (read-only)
# ============================================================

class PriceRecordSerializer(serializers.ModelSerializer):
    """ Read-сериализатор для записей о ценах.
    Задача:
    - отдать историю цен по поставщику/позиции;
    - не позволять изменять записи (read-only).
    """

    supplier_name = serializers.CharField(
        source="supplier.name", read_only=True, allow_null=True
    )
    item_name = serializers.CharField(
        source="item.name", read_only=True, allow_null=True
    )
    # Явно объявляем note, чтобы:
    # - стабилизировать тип (строка);
    # - корректно обрабатывать null/blank;
    # - не словить несоответствие контракта.
    note = serializers.CharField(read_only=True, allow_blank=True, allow_null=True)

    class Meta:
        model = PriceRecord
        fields = [
            "id",
            "dt",
            "supplier",
            "supplier_name",
            "item",
            "item_name",
            "price",
            "currency",
            "lead_days",
            "note",
            "pack_qty",
            "moq_qty",
            "lot_step",
        ]
        read_only_fields = fields  # делаем историю цен строго read-only



# ============================================================
# Строки заявки — read
# ============================================================

class PurchaseRequestLineSerializer(serializers.ModelSerializer):
    """
    Read - сериализатор строки заявки.

    Модель PurchaseRequestLine:
    - request: FK на заявку,
    - item: FK на Item,
    - qty: количество,
    - unit: FK на Unit,
    - need_date, deadline_at, status, comment, priority, task и т.п.
    """

    item_name = serializers.CharField(
        source="item.name", read_only=True, allow_null=True
    )
    unit_name = serializers.CharField(
        source="unit.name", read_only=True, allow_null=True
    )

    # Для фронтенда важно показывать категорию позиции в заявке.
    # Категория всегда берётся из Item (catalog.Item.category).
    category_name = serializers.CharField(
        source="item.category.name", read_only=True, allow_null=True
    )

    class Meta:
        model = PurchaseRequestLine
        fields = [
            "id",
            "request",
            "item",
            "item_name",
            "category_name",
            "qty",
            "unit",
            "unit_name",
            "need_date",
            "deadline_at",
            "status",
            "comment",
            "priority",
            "task",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["request", "created_at", "updated_at"]


# ============================================================
# Заявка — read
# ============================================================

class PurchaseRequestSerializer(serializers.ModelSerializer):
    """Read - сериализатор заявки на закупку.

    Важно: проект/этап в заявке nullable, а проект может быть задан как напрямую (project),
    так и через выбранный этап (project_stage). Поэтому все поля ниже — безопасные.
    """

    lines = PurchaseRequestLineSerializer(many=True, read_only=True)

    project_id = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    project_address = serializers.SerializerMethodField()
    # Два поля для совместимости:
    # - stage_id (фронт)
    # - project_stage_id (исторически)
    stage_id = serializers.SerializerMethodField()
    project_stage_id = serializers.SerializerMethodField()
    stage_name = serializers.SerializerMethodField()

    def _get_stage(self, obj: PurchaseRequest):
        try:
            return getattr(obj, "project_stage", None)
        except Exception:
            return None

    def _get_project(self, obj: PurchaseRequest):
        # 1) напрямую в заявке
        try:
            if getattr(obj, "project", None):
                return obj.project
        except Exception:
            pass
        # 2) через этап
        st = self._get_stage(obj)
        try:
            if st and getattr(st, "project", None):
                return st.project
        except Exception:
            pass
        return None

    def get_project_id(self, obj: PurchaseRequest):
        p = self._get_project(obj)
        return getattr(p, "id", None) if p else None

    def get_project_name(self, obj: PurchaseRequest):
        p = self._get_project(obj)
        return getattr(p, "name", None) if p else None

    def get_project_address(self, obj: PurchaseRequest):
        p = self._get_project(obj)
        if not p:
            return None
        return (getattr(p, "delivery_address", None) or "").strip() or None

    def get_stage_id(self, obj: PurchaseRequest):
        st = self._get_stage(obj)
        return getattr(st, "id", None) if st else None

    def get_project_stage_id(self, obj: PurchaseRequest):
        # alias
        return self.get_stage_id(obj)

    def get_stage_name(self, obj: PurchaseRequest):
        st = self._get_stage(obj)
        return getattr(st, "name", None) if st else None

    class Meta:
        model = PurchaseRequest
        fields = [
            "id",
            "project_id",
            "project_stage_id",
            "stage_id",
            "project_name",
            "project_address",
            "stage_name",
            "status",
            "requested_by",
            "comment",
            "deadline",
            "created_at",
            "updated_at",
            "lines",
        ]
        read_only_fields = ["created_at", "updated_at"]


# ============================================================
# Строки заявки — write (nested)
# ============================================================

class PurchaseRequestLineWriteSerializer(serializers.ModelSerializer):
    """
    Write - сериализатор строки заявки.

    Поля для записи:
    - id (опционально, если строка уже существует),
    - item,
    - qty,
    - unit,
    - need_date,
    - deadline_at,
    - status,
    - comment,
    - priority,
    - task.
    """

    class Meta:
        model = PurchaseRequestLine
        fields = [
            "id",
            "item",
            "qty",
            "unit",
            "need_date",
            "deadline_at",
            "status",
            "comment",
            "priority",
            "task",
        ]


# ============================================================
# Заявка — write (nested)
# ============================================================

class PurchaseRequestWriteSerializer(serializers.ModelSerializer):
    """
    Write - сериализатор заявки на закупку.

    Модель PurchaseRequest:
    - project, project_stage, status, requested_by, comment, deadline.

    Принимает:
    - project_id / project_stage_id,
    - status,
    - requested_by,
    - comment (или note, если фронт шлёт по старому),
    - deadline,
    - lines: массив строк заявки.

    Логика по lines:
    - если ключ "lines" есть:
      * строки с id -> обновляются;
      * без id -> создаются;
      * существующие строки, которых нет в payload -> удаляются.
    - если ключа "lines" нет:
      * строки остаются без изменений.
    """

    project_id = serializers.PrimaryKeyRelatedField(
        source="project",
        queryset=Project.objects.all(),
        required=False,
        allow_null=True,
    )
    project_stage_id = serializers.PrimaryKeyRelatedField(
        source="project_stage",
        queryset=ProjectStage.objects.all(),
        required=False,
        allow_null=True,
    )

    # Алиас note -> comment, чтобы сгладить возможный старый контракт
    note = serializers.CharField(write_only=True, required=False, allow_blank=True)

    lines = PurchaseRequestLineWriteSerializer(many=True, required=False)

    class Meta:
        model = PurchaseRequest
        fields = [
            "id",
            "project_id",
            "project_stage_id",
            "status",
            "requested_by",
            "comment",
            "note",
            "deadline",
            "lines",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        note = attrs.pop("note", None)
        if note is not None and not attrs.get("comment"):
            attrs["comment"] = note
        return attrs

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", None)
        pr = PurchaseRequest.objects.create(**validated_data)
        if lines_data is not None:
            self._upsert_lines(pr, lines_data)
        return pr

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
 
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
 
        if lines_data is not None:
            self._upsert_lines(instance, lines_data)
 
        return instance

    def _upsert_lines(self, request_obj, lines_data):
        """
        Upsert + delete-missing для строк заявки.
        """
        existing = {line.id: line for line in request_obj.lines.all()}
        seen_ids = set()

        for payload in lines_data:
            line_id = payload.get("id")
            if line_id and line_id in existing:
                line = existing[line_id]
                for attr, value in payload.items():
                    if attr == "id":
                        continue
                    setattr(line, attr, value)
                line.request = request_obj
                line.save()
                seen_ids.add(line_id)
            else:
                PurchaseRequestLine.objects.create(
                    request=request_obj,
                    **{k: v for k, v in payload.items() if k != "id"},
                )

        to_delete = [obj for pk, obj in existing.items() if pk not in seen_ids]
        if to_delete:
            PurchaseRequestLine.objects.filter(
                id__in=[obj.id for obj in to_delete]
            ).delete()


# ============================================================
# Заказы поставщикам (PurchaseOrder + строки)
# ============================================================

class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    """
    DRF-сериализатор строки заказа поставщику.

    Поля :
    - id
    - request
    - item
    - item_sku (source=item.sku)
    - item_name (source=item.name)
    - qty
    - unit
    - need_date
    - deadline_at
    - status
    - comment
    - priority
    - task
    - created_at
    - updated_at
    """

    item_sku = serializers.CharField(source="item.sku", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = PurchaseOrderLine
        fields = [
            "id",
            "order",
            "item",
            "item_sku",
            "item_name",
            "qty",
            "price",
            "status",
            "is_blocked",
        ]


class PurchaseOrderSerializer(serializers.ModelSerializer):
    """
    DRF-сериализатор заказа поставщику.

    Поля :
    - id
    - number
    - supplier
    - supplier_name
    - status
    - lines
    - created_at
    - updated_at
    """

    lines = PurchaseOrderLineSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    # Для MVP важно стабильно показывать проект/этап в Заказах и Доставках.
    # Проект/этап могут быть сохранены как "снимок" в самом заказе, либо приходить из заявки.
    # Всё nullable → используем безопасные accessors.
    purchase_request_id = serializers.SerializerMethodField()
    project_id = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    stage_id = serializers.SerializerMethodField()
    stage_name = serializers.SerializerMethodField()

    def _get_pr(self, obj: PurchaseOrder):
        try:
            return obj.purchase_request
        except Exception:
            return None

    def _get_project(self, obj: PurchaseOrder):
        # 1) снимок в заказе
        try:
            if getattr(obj, "project", None):
                return obj.project
        except Exception:
            pass
        # 2) через заявку
        pr = self._get_pr(obj)
        if not pr:
            return None
        if getattr(pr, "project", None):
            return pr.project
        # Если по ошибке/данным заполнен только этап — проект берём из этапа.
        st = getattr(pr, "project_stage", None)
        return getattr(st, "project", None) if st else None

    def _get_stage(self, obj: PurchaseOrder):
        try:
            if getattr(obj, "project_stage", None):
                return obj.project_stage
        except Exception:
            pass
        pr = self._get_pr(obj)
        return getattr(pr, "project_stage", None) if pr else None

    def get_purchase_request_id(self, obj: PurchaseOrder):
        pr = self._get_pr(obj)
        return getattr(pr, "id", None) if pr else None

    def get_project_id(self, obj: PurchaseOrder):
        p = self._get_project(obj)
        return getattr(p, "id", None) if p else None

    def get_project_name(self, obj: PurchaseOrder):
        p = self._get_project(obj)
        return getattr(p, "name", None) if p else None

    def get_stage_id(self, obj: PurchaseOrder):
        st = self._get_stage(obj)
        return getattr(st, "id", None) if st else None

    def get_stage_name(self, obj: PurchaseOrder):
        st = self._get_stage(obj)
        return getattr(st, "name", None) if st else None

    class Meta:
        model = PurchaseOrder

        fields = [
            "id",
            "number",
            "supplier",
            "supplier_name",
            "status",
            "purchase_request_id",
            "project_id",
            "project_name",
            "stage_id",
            "stage_name",
            "deadline",
            "planned_delivery_date",
            "delivery_address",
            "sent_at",
            "lines",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]



# ============================================================
# Quote / QuoteLine — коммерческие предложения
# ============================================================

from django.core.cache import cache
from django.utils import timezone
from decimal import Decimal


def _quote_meta_key(quote_id: int) -> str:
    return f"quote_meta:{quote_id}"


def _quote_meta_get(quote_id: int) -> dict:
    """Лёгкое хранилище метаданных по Quote без миграций (cache-based).

    Используем для полей, которых пока нет в модели Quote, но которые нужны фронту:
    status, notes, received_at, delivery_days.
    """
    val = cache.get(_quote_meta_key(quote_id))
    return val if isinstance(val, dict) else {}


def _quote_meta_set(quote_id: int, **updates) -> dict:
    cur = _quote_meta_get(quote_id)
    cur.update({k: v for k, v in updates.items() if v is not None})
    # TTL не ставим: это «память» на dev, до появления полей в модели.
    cache.set(_quote_meta_key(quote_id), cur)
    return cur

class QuoteLineSerializer(serializers.ModelSerializer):
    """
    Read ‑ сериализатор строки коммерческого предложения.
    """

    item_sku = serializers.CharField(source="item.sku", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)

    unit_name = serializers.CharField(source="unit.name", read_only=True, allow_null=True)

    class Meta:
        model = QuoteLine
        # В модели QuoteLine нет qty — количество берём из PurchaseRequestLine.
        fields = [
            "id",
            "quote",
            "item",
            "item_sku",
            "item_name",
            "vendor_sku",
            "name",
            "unit",
            "unit_name",
            "price",
            "currency",
            "lead_days",
            "moq_qty",
            "pack_qty",
            "lot_step",
        ]
        read_only_fields = ["quote"]


class QuoteSerializer(serializers.ModelSerializer):
    """
    Read‑сериализатор коммерческого предложения.

    Используется на странице Коммерческих предложений:
    - список КП,
    - детали КП,
    - смена статуса.
    """

    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    purchase_request_id = serializers.IntegerField(read_only=True)
    lines = QuoteLineSerializer(many=True, read_only=True)

    # Поля-совместимость для фронта (в модели их пока нет)
    rfq_id = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()
    received_at = serializers.SerializerMethodField()
    delivery_days = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    total_price = serializers.SerializerMethodField()

    project_id = serializers.SerializerMethodField()
    project_stage_id = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    project_address = serializers.SerializerMethodField()
    stage_name = serializers.SerializerMethodField()

    purchase_order_id = serializers.SerializerMethodField()
    purchase_order_number = serializers.SerializerMethodField()

    def get_rfq_id(self, obj):
        return 0

    def get_status(self, obj):
        return _quote_meta_get(obj.id).get("status") or "received"

    def get_notes(self, obj):
        return _quote_meta_get(obj.id).get("notes") or ""

    def get_received_at(self, obj):
        # По умолчанию считаем, что КП получено в момент создания записи.
        v = _quote_meta_get(obj.id).get("received_at")
        return v or obj.created_at

    def get_delivery_days(self, obj):
        # Пессимистичная оценка: max(lead_days) по строкам
        v = _quote_meta_get(obj.id).get("delivery_days")
        if v is not None:
            return v
        days = [ln.lead_days for ln in getattr(obj, "lines", []).all() if ln.lead_days is not None]
        return max(days) if days else 0

    def get_currency(self, obj):
        # Валюта: первая валюта строк (если есть), иначе RUB
        for ln in getattr(obj, "lines", []).all():
            if ln.currency:
                return ln.currency
        return "RUB"

    def get_total_price(self, obj):
        # Считаем сумму: price * qty из связанной заявки (если есть), иначе просто сумму price.
        try:
            pr = obj.purchase_request
        except Exception:
            pr = None

        if pr is None:
            total = Decimal("0")
            for ln in getattr(obj, "lines", []).all():
                total += (ln.price or Decimal("0"))
            return total

        qty_by_item = {}
        for pr_ln in pr.lines.all():
            if pr_ln.item_id is None:
                continue
            qty_by_item[pr_ln.item_id] = qty_by_item.get(pr_ln.item_id, Decimal("0")) + (pr_ln.qty or Decimal("0"))

        total = Decimal("0")
        for ql in getattr(obj, "lines", []).all():
            q = qty_by_item.get(ql.item_id, Decimal("0"))
            total += (ql.price or Decimal("0")) * q
        return total

    def _get_pr(self, obj):
        try:
            return obj.purchase_request
        except Exception:
            return None

    def get_project_stage_id(self, obj):
        pr = self._get_pr(obj)
        return getattr(pr, "project_stage_id", None) if pr else None

    def get_project_id(self, obj):
        pr = self._get_pr(obj)
        if not pr:
            return None
        pr_project_id = getattr(pr, "project_id", None)
        if pr_project_id:
            return pr_project_id
        st = getattr(pr, "project_stage", None)
        return getattr(getattr(st, "project", None), "id", None) if st else None

    def get_project_name(self, obj):
        pr = self._get_pr(obj)
        if not pr:
            return None
        project = getattr(pr, "project", None)
        if project is None:
            st = getattr(pr, "project_stage", None)
            project = getattr(st, "project", None) if st else None
        if not project:
            return None
        code = getattr(project, "code", None)
        name = getattr(project, "name", None) or ""
        if code:
            return f"{code} — {name}".strip(" —")
        return name or f"#{getattr(project, 'id', '')}"


    def get_project_address(self, obj):
        pr = self._get_pr(obj)
        if not pr:
            return None
        project = getattr(pr, "project", None)
        if project is None:
            st = getattr(pr, "project_stage", None)
            project = getattr(st, "project", None) if st else None
        if not project:
            return None
        return (getattr(project, "delivery_address", None) or "").strip() or None

    def get_stage_name(self, obj):
        pr = self._get_pr(obj)
        if not pr:
            return None
        st = getattr(pr, "project_stage", None)
        if not st:
            return None
        code = getattr(st, "code", None)
        name = getattr(st, "name", None) or ""
        if code:
            return f"{code} — {name}".strip(" —")
        return name or f"#{getattr(st, 'id', '')}"

    def _get_latest_purchase_order(self, obj):
        """Возвращает последний заказ, сформированный из этого КП (если есть)."""
        try:
            qs = obj.purchase_orders.all().order_by("-id")
            return qs.first()
        except Exception:
            return None

    def get_purchase_order_id(self, obj):
        po = self._get_latest_purchase_order(obj)
        return getattr(po, "id", None) if po else None

    def get_purchase_order_number(self, obj):
        po = self._get_latest_purchase_order(obj)
        return getattr(po, "number", None) if po else None

    class Meta:
        model = Quote
        fields = [
            "id",
            "supplier",
            "supplier_name",
            "purchase_request",
            "purchase_request_id",
            "project_id",
            "project_stage_id",
            "project_name",
            "project_address",
            "stage_name",
            "rfq_id",
            "status",
            "total_price",
            "currency",
            "delivery_days",
            "notes",
            "received_at",
            "purchase_order_id",
            "purchase_order_number",
            "created_at",
            "lines",
        ]
        read_only_fields = ["created_at", "received_at"]


# ============================================================================
# 1. NESTED SERIALIZERS (для включения в основные сериализаторы)
# ============================================================================

class SupplierMinimalSerializer(serializers.ModelSerializer):
    """Минимальная информация о поставщике (для вложения)"""
    class Meta:
        model = Supplier
        fields = ['id', 'name']


class ItemMinimalSerializer(serializers.ModelSerializer):
    """Минимальная информация об Item (для вложения)"""
    class Meta:
        model = Item
        fields = ['id', 'sku', 'name']


class UnitMinimalSerializer(serializers.ModelSerializer):
    """Минимальная информация об единице измерения"""
    class Meta:
        model = Unit
 #       fields = ['id', 'name', 'short_name']
        fields = ['id', 'code', 'name', 'description', 'created_at', 'updated_at']

# ============================================================================
# 2. SupplierPriceListLine SERIALIZERS
# ============================================================================

class SupplierPriceListLineSerializer(serializers.ModelSerializer):
    """
    Полный сериализатор для позиции прайс-листа.
    
    Включает:
    - Все поля модели
    - Вложенные поля (supplier, unit)
    - Расчётные поля (effective_price)
    """
    
    # Вложенные объекты (read-only)
    unit_detail = UnitMinimalSerializer(source='unit', read_only=True)
    
    supplier_name = serializers.CharField(
        source='price_list.supplier.name',
        read_only=True,
        help_text='Название поставщика (для удобства)'
    )
    
    # Расчётные поля
    effective_price = serializers.SerializerMethodField(
        help_text='Эффективная цена (с доставкой, с НДС/без НДС)'
    )
    
    class Meta:
        model = SupplierPriceListLine
        fields = [
            'id',
            'price_list',
            'supplier_sku',
            'description',
            'unit',
            'unit_detail',
            'price',
            'effective_price',
            'min_quantity',
            'min_order_amount',
            'quantity_step',
            'package_quantity',
            'lead_time_days',
            'vat_included',
            'vat_rate',
            'delivery_cost_fixed',
            'delivery_cost_per_unit',
            'notes',
            'is_available',
            'supplier_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'supplier_name',
            'effective_price',
        ]
    
    def get_effective_price(self, obj):
        """Рассчитать эффективную цену"""
        return str(obj.effective_price)


class SupplierPriceListLineDetailSerializer(SupplierPriceListLineSerializer):
    """
    Детальный сериализатор с дополнительной информацией о сопоставлениях.
    
    Добавляет:
    - Связанные ItemSupplierMapping'и
    """
    
    # Сопоставления с Item'ами
    item_mappings = serializers.SerializerMethodField()
    
    class Meta(SupplierPriceListLineSerializer.Meta):
        fields = SupplierPriceListLineSerializer.Meta.fields + [
            'item_mappings',
        ]
    
    def get_item_mappings(self, obj):
        """Получить все сопоставления для этой позиции прайс-листа"""
        mappings = obj.item_mappings.filter(is_active=True)
        return ItemSupplierMappingSerializer(mappings, many=True).data


# ============================================================================
# 3. SupplierPriceList SERIALIZERS
# ============================================================================

class SupplierPriceListSerializer(serializers.ModelSerializer):
    """
    Базовый сериализатор для прайс-листа.
    
    Используется для списков и создания.
    """
    
    # Вложенные объекты (read-only)
    supplier_detail = SupplierMinimalSerializer(source='supplier', read_only=True)
    
    # Расчётные поля
    line_count = serializers.SerializerMethodField(
        help_text='Количество позиций в прайс-листе'
    )
    
    is_valid_today = serializers.SerializerMethodField(
        help_text='Действителен ли прайс-лист сегодня'
    )
    
    days_until_expiry = serializers.SerializerMethodField(
        help_text='Сколько дней до окончания действия'
    )
    
    class Meta:
        model = SupplierPriceList
        fields = [
            'id',
            'supplier',
            'supplier_detail',
            'name',
            'version',
            'effective_date',
            'expiry_date',
            'currency',
            'is_active',
            'description',
            'line_count',
            'is_valid_today',
            'days_until_expiry',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'line_count',
            'is_valid_today',
            'days_until_expiry',
        ]
    
    def get_line_count(self, obj):
        return obj.lines.count()
    
    def get_is_valid_today(self, obj):
        return obj.is_valid_today()
    
    def get_days_until_expiry(self, obj):
        return obj.days_until_expiry()


class SupplierPriceListDetailSerializer(SupplierPriceListSerializer):
    """
    Детальный сериализатор с полным содержимым прайс-листа.
    
    Включает все позиции (lines).
    """
    
    # Позиции прайс-листа
    lines = SupplierPriceListLineSerializer(many=True, read_only=True)
    
    class Meta(SupplierPriceListSerializer.Meta):
        fields = SupplierPriceListSerializer.Meta.fields + [
            'lines',
        ]


# ============================================================================
# 4. ItemSupplierMapping SERIALIZERS
# ============================================================================

class ItemSupplierMappingSerializer(serializers.ModelSerializer):
    """
    Сериализатор для сопоставления Item ↔ Поставщик.
    
    Включает:
    - Item и его детали
    - SupplierPriceListLine и его детали
    - Коэффициент преобразования
    - Статус (preferred, active)
    """
    
    # Вложенные объекты (read-only)
    item_detail = ItemMinimalSerializer(source='item', read_only=True)
    
    price_list_line_detail = SupplierPriceListLineSerializer(
        source='price_list_line',
        read_only=True
    )
    
    supplier_name = serializers.CharField(
        source='supplier.name',
        read_only=True,
        help_text='Название поставщика'
    )
    
    supplier_sku = serializers.CharField(
        source='price_list_line.supplier_sku',
        read_only=True,
        help_text='Артикул поставщика'
    )
    
    # Расчётные поля
    effective_min_quantity = serializers.SerializerMethodField(
        help_text='Эффективный МОК в единицах Item'
    )
    
    class Meta:
        model = ItemSupplierMapping
        fields = [
            'id',
            'item',
            'item_detail',
            'price_list_line',
            'price_list_line_detail',
            'supplier_name',
            'supplier_sku',
            'conversion_factor',
            'is_preferred',
            'is_active',
            'min_quantity_override',
            'effective_min_quantity',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'item_detail',
            'price_list_line_detail',
            'supplier_name',
            'supplier_sku',
            'effective_min_quantity',
        ]
    
    def get_effective_min_quantity(self, obj):
        return str(obj.get_effective_min_quantity())


class ItemSupplierMappingDetailSerializer(ItemSupplierMappingSerializer):
    """Более детальный вариант (опционально)"""
    pass


# ============================================================================
# 5. ВСПОМОГАТЕЛЬНЫЕ SERIALIZERS
# ============================================================================

class ItemSupplierOptionsSerializer(serializers.Serializer):
    """
    Сериализатор для вывода всех поставщиков конкретного Item'а.
    
    Используется в API:
    GET /api/procurement/items/{id}/suppliers/
    
    Возвращает отсортированный список (preferred первыми, потом по цене).
    """
    
    item_id = serializers.IntegerField()
    item_name = serializers.CharField()
    item_sku = serializers.CharField()
    
    suppliers = serializers.SerializerMethodField()
    
    def get_suppliers(self, data):
        """Получить всех поставщиков для Item'а"""
        item_id = data.get('item_id')
        if not item_id:
            return []
        
        # Получить все активные сопоставления
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
        
        return ItemSupplierMappingSerializer(mappings, many=True).data


class QuoteLineGenerationDataSerializer(serializers.Serializer):
    """
    Вспомогательный сериализатор для процесса автогенерации КП.
    
    Содержит информацию о позиции заявки и найденном поставщике.
    """
    
    item_id = serializers.IntegerField()
    item_name = serializers.CharField(read_only=True)
    requested_quantity = serializers.DecimalField(max_digits=12, decimal_places=4)
    
    supplier_id = serializers.IntegerField()
    supplier_name = serializers.CharField(read_only=True)
    supplier_sku = serializers.CharField(read_only=True)
    
    price_per_unit = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    supplier_quantity = serializers.DecimalField(max_digits=12, decimal_places=4, read_only=True)
    total_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    conversion_factor = serializers.DecimalField(max_digits=12, decimal_places=4)
    
    is_valid = serializers.BooleanField(read_only=True)
    error_message = serializers.CharField(required=False, allow_blank=True, read_only=True)



class GenerateQuotesFromRequestSerializer(serializers.Serializer):
    """
    Serializer для запроса на автогенерацию КП.

    Пример:
    {
        "purchase_request_id": 123,
        "supplier_ids": [1, 2, 3],
        "purchase_request_line_ids": [10, 11]  # optional
    }
    """

    purchase_request_id = serializers.IntegerField(
        help_text="ID заявки (PurchaseRequest)"
    )

    supplier_ids = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="Список ID поставщиков, для которых генерировать КП",
    )

    purchase_request_line_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        help_text="(опц.) Список ID строк заявки (PurchaseRequestLine), по которым генерировать КП",
    )

    def validate_purchase_request_id(self, value):
        from procurement.models import PurchaseRequest
        try:
            PurchaseRequest.objects.get(id=value)
        except PurchaseRequest.DoesNotExist:
            raise serializers.ValidationError(f"PurchaseRequest с ID {value} не найдена")
        return value

    def validate_supplier_ids(self, value):
        if not value:
            raise serializers.ValidationError("Список поставщиков не может быть пустым")

        if len(set(value)) != len(value):
            raise serializers.ValidationError("В списке есть дубликаты ID")

        existing_count = Supplier.objects.filter(id__in=value).count()
        if existing_count != len(value):
            raise serializers.ValidationError("Некоторые поставщики не найдены")

        return value

    def validate(self, attrs):
        """Кросс-валидация: если переданы строки заявки, они должны принадлежать purchase_request_id."""
        pr_id = attrs.get("purchase_request_id")
        line_ids = attrs.get("purchase_request_line_ids") or []
        if not line_ids:
            return attrs

        from procurement.models import PurchaseRequestLine
        qs = PurchaseRequestLine.objects.filter(id__in=line_ids, request_id=pr_id)
        if qs.count() != len(set(line_ids)):
            raise serializers.ValidationError(
                {"purchase_request_line_ids": "Некоторые строки не найдены или не принадлежат указанной заявке"}
            )
        return attrs


class GenerateQuotesResponseSerializer(serializers.Serializer):
    """
    Serializer для ответа при автогенерации КП.
    
    Пример:
    {
        "ok": true,
        "quotes_created": 3,
        "quotes": [...],
        "warnings": [...]
    }
    """
    
    ok = serializers.BooleanField()
    quotes_created = serializers.IntegerField()
    quotes = serializers.ListField()
    warnings = serializers.ListField(child=serializers.CharField())

# ============================================================
# ShipmentSerializer — представление доставки на базе PurchaseOrder
# ============================================================

class ShipmentSerializer(serializers.Serializer):
    """
    View‑модель доставки, построенная на базе PurchaseOrder.

    Используется в ShipmentViewSet для фронтовой страницы доставок.
    """

    id = serializers.IntegerField()
    po_id = serializers.IntegerField()
    po_number = serializers.CharField()
    supplier_id = serializers.IntegerField()
    supplier_name = serializers.CharField()
    status = serializers.CharField()
    tracking_number = serializers.CharField(allow_blank=True, allow_null=True)
    estimated_delivery = serializers.DateField(allow_null=True)
    delivery_address = serializers.CharField(allow_blank=True, allow_null=True)
    actual_delivery = serializers.DateField(allow_null=True)
    notes = serializers.CharField(allow_blank=True, allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
