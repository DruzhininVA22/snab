from decimal import Decimal
from typing import Any, Dict, List, Optional

from rest_framework import serializers

from .models_shipments import Shipment, ShipmentLine


class ShipmentLineSerializer(serializers.ModelSerializer):
    order_line_id = serializers.IntegerField(source="order_line.id", read_only=True)
    item_id = serializers.IntegerField(source="order_line.item.id", read_only=True)
    item_name = serializers.CharField(source="order_line.item.name", read_only=True)
    ordered_qty = serializers.DecimalField(source="order_line.qty", max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ShipmentLine
        fields = ["id", "order_line_id", "item_id", "item_name", "ordered_qty", "qty"]


class ShipmentSerializer(serializers.ModelSerializer):
    order_id = serializers.IntegerField(source="order.id", read_only=True)
    order_number = serializers.CharField(source="order.number", read_only=True)
    supplier_name = serializers.CharField(source="order.supplier.name", read_only=True)
    # NOTE: purchase_request / project / stage are nullable in the data model.
    # Use safe accessors to avoid serialization crashes and "unstable" UI.
    purchase_request_id = serializers.SerializerMethodField()
    project_id = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    stage_id = serializers.SerializerMethodField()
    stage_name = serializers.SerializerMethodField()
    short_number = serializers.SerializerMethodField()
    # Метрики прогресса заявки (по позициям), чтобы быстро понимать: что закрыто и что осталось.
    request_items_total = serializers.SerializerMethodField()
    request_items_fulfilled = serializers.SerializerMethodField()
    request_items_remaining = serializers.SerializerMethodField()
    request_fulfilled_pct = serializers.SerializerMethodField()
    shipment_items_count = serializers.SerializerMethodField()
    shipment_cover_pct = serializers.SerializerMethodField()
    lines = ShipmentLineSerializer(many=True, read_only=True)

    def _get_pr(self, obj: Shipment):
        # purchase_request — источник для метрик прогресса заявки
        try:
            return obj.order.purchase_request
        except Exception:
            return None

    def _get_project(self, obj: Shipment):
        # 1) снимок в доставке
        try:
            if getattr(obj, "project", None):
                return obj.project
        except Exception:
            pass
        # 2) снимок в заказе
        try:
            if getattr(obj.order, "project", None):
                return obj.order.project
        except Exception:
            pass
        # 2.1) если проект в заказе не заполнен, но этап есть — берём project из этапа
        try:
            st = getattr(obj.order, "project_stage", None)
            if st and getattr(st, "project", None):
                return st.project
        except Exception:
            pass
        # 3) через заявку
        pr = self._get_pr(obj)
        if not pr:
            return None
        if getattr(pr, "project", None):
            return pr.project
        st = getattr(pr, "project_stage", None)
        return getattr(st, "project", None) if st else None

    def _get_stage(self, obj: Shipment):
        try:
            if getattr(obj, "project_stage", None):
                return obj.project_stage
        except Exception:
            pass
        try:
            if getattr(obj.order, "project_stage", None):
                return obj.order.project_stage
        except Exception:
            pass
        pr = self._get_pr(obj)
        return getattr(pr, "project_stage", None) if pr else None

    def get_purchase_request_id(self, obj: Shipment):
        pr = self._get_pr(obj)
        return getattr(pr, "id", None) if pr else None

    def get_project_id(self, obj: Shipment):
        p = self._get_project(obj)
        return getattr(p, "id", None) if p else None

    def get_project_name(self, obj: Shipment):
        p = self._get_project(obj)
        return getattr(p, "name", None) if p else None

    def get_stage_id(self, obj: Shipment):
        st = self._get_stage(obj)
        return getattr(st, "id", None) if st else None

    def get_stage_name(self, obj: Shipment):
        st = self._get_stage(obj)
        return getattr(st, "name", None) if st else None

    def get_short_number(self, obj: Shipment) -> str:
        # Глобально-уникальный лаконичный номер для UI (не зависит от номера заказа)
        return f"D-{obj.pk}" if obj.pk else "D-?"

    def _pr_metrics(self, obj: Shipment) -> Optional[Dict[str, Any]]:
        pr_id = self.get_purchase_request_id(obj)
        if not pr_id:
            return None
        metrics_map = self.context.get("pr_metrics") or {}
        return metrics_map.get(int(pr_id))

    def get_request_items_total(self, obj: Shipment) -> Optional[int]:
        m = self._pr_metrics(obj)
        return int(m.get("total", 0)) if m else None

    def get_request_items_fulfilled(self, obj: Shipment) -> Optional[int]:
        m = self._pr_metrics(obj)
        return int(m.get("fulfilled", 0)) if m else None

    def get_request_items_remaining(self, obj: Shipment) -> Optional[int]:
        m = self._pr_metrics(obj)
        return int(m.get("remaining", 0)) if m else None

    def get_request_fulfilled_pct(self, obj: Shipment) -> Optional[float]:
        m = self._pr_metrics(obj)
        if not m:
            return None
        total = int(m.get("total", 0))
        if total <= 0:
            return 0.0
        fulfilled = int(m.get("fulfilled", 0))
        return round((fulfilled / total) * 100.0, 1)

    def get_shipment_items_count(self, obj: Shipment) -> Optional[int]:
        m = self._pr_metrics(obj)
        if not m:
            return None
        req_items = m.get("req_items") or set()
        # lines и order_line__item уже prefetch в queryset
        lines_mgr = getattr(obj, "lines", None)
        if not lines_mgr:
            return 0
        ship_items = {ln.order_line.item_id for ln in lines_mgr.all()}
        return int(len(ship_items.intersection(req_items)))

    def get_shipment_cover_pct(self, obj: Shipment) -> Optional[float]:
        m = self._pr_metrics(obj)
        if not m:
            return None
        total = int(m.get("total", 0))
        if total <= 0:
            return 0.0
        cnt = self.get_shipment_items_count(obj) or 0
        return round((cnt / total) * 100.0, 1)

    class Meta:
        model = Shipment
        fields = [
            "id",
            "order_id",
            "order_number",
            "supplier_name",
            "purchase_request_id",
            "project_id",
            "project_name",
            "stage_id",
            "stage_name",
            "number",
            "short_number",
            "status",
            "eta_date",
            "delivered_at",
            "address",
            "notes",
            "request_items_total",
            "request_items_fulfilled",
            "request_items_remaining",
            "request_fulfilled_pct",
            "shipment_items_count",
            "shipment_cover_pct",
            "created_at",
            "updated_at",
            "lines",
        ]


class ShipmentCreateSerializer(serializers.Serializer):
    order = serializers.IntegerField()
    eta_date = serializers.DateField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class ShipmentSetLinesSerializer(serializers.Serializer):
    lines = serializers.ListField(child=serializers.DictField(), allow_empty=True, required=True)

    def validate_lines(self, value):
        out = []
        for row in value:
            if not isinstance(row, dict):
                raise serializers.ValidationError("line must be object")
            if "order_line_id" not in row or "qty" not in row:
                raise serializers.ValidationError("order_line_id and qty are required")
            try:
                oid = int(row["order_line_id"])
            except Exception:
                raise serializers.ValidationError("order_line_id must be int")
            try:
                q = Decimal(str(row["qty"]))
            except Exception:
                raise serializers.ValidationError("qty must be decimal")
            if q <= 0:
                continue
            out.append({"order_line_id": oid, "qty": q})
        return out


class ShipmentSetStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=list(Shipment.Status.values))
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
