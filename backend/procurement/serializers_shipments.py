from decimal import Decimal
from typing import Any, Dict, List

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
    project_id = serializers.IntegerField(source="order.purchase_request.project.id", read_only=True)
    project_name = serializers.CharField(source="order.purchase_request.project.name", read_only=True)
    stage_id = serializers.IntegerField(source="order.purchase_request.project_stage.id", read_only=True)
    stage_name = serializers.CharField(source="order.purchase_request.project_stage.name", read_only=True)
    purchase_request_id = serializers.IntegerField(source="order.purchase_request.id", read_only=True)
    lines = ShipmentLineSerializer(many=True, read_only=True)

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
            "status",
            "eta_date",
            "delivered_at",
            "address",
            "notes",
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
