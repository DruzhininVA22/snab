"""
quote_lines_api.py — CRUD API для строк КП (QuoteLine).

Зачем:
- фронту нужно просматривать и редактировать строки КП (цены, сроки, sku),
  не ломая основной QuoteSerializer и без nested write.
- эндпоинт: /api/procurement/quote-lines/

Важно:
- фильтрация по quote_id через query params (?quote_id=123)
- active_only=1 — только НЕ исключенные строки
- только IsAuthenticated
"""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, serializers
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.exceptions import PermissionDenied

from .models import QuoteLine, Quote, PurchaseRequestLine, PurchaseOrder


class QuoteLineApiSerializer(serializers.ModelSerializer):
    item_sku = serializers.CharField(source="item.sku", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    category_name = serializers.CharField(source="item.category.name", read_only=True, default="")
    requested_qty = serializers.SerializerMethodField()

    class Meta:
        model = QuoteLine
        fields = [
            "id",
            "quote",
            "item",
            "item_sku",
            "item_name",
            "category_name",
            "vendor_sku",
            "name",
            "unit",
            "price",
            "currency",
            "lead_days",
            "moq_qty",
            "pack_qty",
            "lot_step",
            "is_blocked",
            "requested_qty",
        ]
        read_only_fields = ["quote", "requested_qty", "item_sku", "item_name", "category_name"]

    def get_requested_qty(self, obj):
        qty_map = self.context.get("qty_map") or {}
        v = qty_map.get(obj.item_id)
        return str(v) if v is not None else None


class QuoteLineViewSet(viewsets.ModelViewSet):
    queryset = QuoteLine.objects.select_related("item", "item__category", "unit", "quote", "quote__supplier")
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = QuoteLineApiSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["quote", "item"]
    search_fields = ["item__sku", "item__name", "vendor_sku", "name"]
    ordering_fields = ["id", "price", "lead_days"]
    ordering = ["id"]

    def _ensure_not_locked(self, quote_id: int):
        if PurchaseOrder.objects.filter(quote_id=quote_id).exists():
            raise PermissionDenied("КП уже связано с заказом поставщику. Удалите заказ, чтобы редактировать КП.")

    def get_queryset(self):
        qs = super().get_queryset()
        qp = self.request.query_params

        quote_id = qp.get("quote_id") or qp.get("quote")
        if quote_id:
            try:
                qs = qs.filter(quote_id=int(quote_id))
            except Exception:
                pass

        active_only = qp.get("active_only") or qp.get("active")
        if active_only in ("1", "true", "True", "yes"):
            qs = qs.filter(is_blocked=False)

        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        qp = self.request.query_params
        quote_id = qp.get("quote_id") or qp.get("quote")
        if not quote_id:
            return ctx

        try:
            qid = int(quote_id)
        except Exception:
            return ctx

        quote = Quote.objects.filter(id=qid).only("id", "purchase_request_id").first()
        if not quote or not quote.purchase_request_id:
            return ctx

        ctx["qty_map"] = {
            row["item_id"]: row["qty"]
            for row in PurchaseRequestLine.objects.filter(request_id=quote.purchase_request_id).values("item_id", "qty")
        }
        return ctx

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        self._ensure_not_locked(obj.quote_id)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        obj = self.get_object()
        self._ensure_not_locked(obj.quote_id)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        self._ensure_not_locked(obj.quote_id)
        return super().destroy(request, *args, **kwargs)
