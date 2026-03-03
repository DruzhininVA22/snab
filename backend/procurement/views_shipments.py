from __future__ import annotations

from decimal import Decimal
from typing import Dict, List

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import PurchaseOrder, PurchaseOrderLine
from .models_shipments import Shipment, ShipmentLine
from .serializers_shipments import (
    ShipmentCreateSerializer,
    ShipmentSerializer,
    ShipmentSetLinesSerializer,
    ShipmentSetStatusSerializer,
)


def _recalc_po_status_from_shipments(po: PurchaseOrder) -> None:
    """Минимальный пересчёт статуса заказа по доставкам (для отката/демо)."""
    if po.status == "draft":
        return

    qs = Shipment.objects.filter(order=po)
    if not qs.exists():
        if po.status in ("in_transit", "delivered"):
            po.status = "sent"
            po.save(update_fields=["status"])
        return

    if qs.filter(status=Shipment.Status.IN_TRANSIT).exists():
        if po.status != "in_transit":
            po.status = "in_transit"
            po.save(update_fields=["status"])
        return

    delivered_shipments = qs.filter(status=Shipment.Status.DELIVERED)
    if not delivered_shipments.exists():
        if po.status == "delivered":
            po.status = "sent"
            po.save(update_fields=["status"])
        return

    order_lines = PurchaseOrderLine.objects.filter(order=po)
    for ol in order_lines:
        delivered_qty = (
            ShipmentLine.objects.filter(shipment__in=delivered_shipments, order_line=ol).aggregate(s=Sum("qty"))["s"]
            or Decimal("0")
        )
        if delivered_qty < ol.qty:
            return

    if po.status != "delivered":
        po.status = "delivered"
        po.save(update_fields=["status"])


class ShipmentViewSet(viewsets.ModelViewSet):
    """Доставки (партии) по заказам. Дробление по позициям."""

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Shipment.objects.select_related(
            "order",
            "order__supplier",
            "order__purchase_request",
            "order__purchase_request__project",
            "order__purchase_request__project_stage",
        ).prefetch_related("lines__order_line__item")
        order_id = self.request.query_params.get("order") or self.request.query_params.get("po_id")
        if order_id:
            try:
                qs = qs.filter(order_id=int(order_id))
            except Exception:
                pass
        return qs.order_by("-id")

    def get_serializer_class(self):
        if self.action == "create":
            return ShipmentCreateSerializer
        if self.action == "set_lines":
            return ShipmentSetLinesSerializer
        if self.action == "set_status":
            return ShipmentSetStatusSerializer
        return ShipmentSerializer

    def list(self, request, *args, **kwargs):
        return Response(ShipmentSerializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, *args, **kwargs):
        obj = self.get_queryset().get(pk=kwargs["pk"])
        return Response(ShipmentSerializer(obj).data)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        ser = ShipmentCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        po = PurchaseOrder.objects.select_related("supplier").get(id=ser.validated_data["order"])
        sh = Shipment.objects.create(
            order=po,
            eta_date=ser.validated_data.get("eta_date"),
            address=(ser.validated_data.get("address") or "").strip() or getattr(po, "delivery_address", "") or "",
            notes=(ser.validated_data.get("notes") or "").strip(),
        )
        return Response(ShipmentSerializer(sh).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    @action(detail=True, methods=["post"])
    def set_lines(self, request, pk=None):
        sh = self.get_queryset().get(pk=pk)

        ser = ShipmentSetLinesSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        rows = ser.validated_data["lines"]

        other_alloc: Dict[int, Decimal] = {}
        other = (
            ShipmentLine.objects.filter(order_line__order=sh.order)
            .exclude(shipment=sh)
            .values("order_line_id")
            .annotate(s=Sum("qty"))
        )
        for r in other:
            other_alloc[int(r["order_line_id"])] = r["s"] or Decimal("0")

        order_lines = {ol.id: ol for ol in PurchaseOrderLine.objects.filter(order=sh.order).select_related("item")}
        errors: List[str] = []

        for r in rows:
            ol_id = r["order_line_id"]
            qty = r["qty"]
            ol = order_lines.get(ol_id)
            if not ol:
                errors.append(f"order_line_id={ol_id} not found")
                continue
            already = other_alloc.get(ol_id, Decimal("0"))
            if already + qty > ol.qty:
                errors.append(f"overorder line {ol_id}: {already}+{qty} > {ol.qty}")

        if errors:
            return Response({"detail": "Нельзя распределить больше, чем заказано.", "errors": errors}, status=400)

        ShipmentLine.objects.filter(shipment=sh).delete()
        bulk = [ShipmentLine(shipment=sh, order_line_id=r["order_line_id"], qty=r["qty"]) for r in rows]
        if bulk:
            ShipmentLine.objects.bulk_create(bulk)

        _recalc_po_status_from_shipments(sh.order)

        sh.refresh_from_db()
        return Response(ShipmentSerializer(sh).data)

    @transaction.atomic
    @action(detail=True, methods=["post"])
    def set_status(self, request, pk=None):
        sh = self.get_queryset().get(pk=pk)
        ser = ShipmentSetStatusSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        sh.status = ser.validated_data["status"]
        if sh.status == Shipment.Status.DELIVERED and not sh.delivered_at:
            sh.delivered_at = timezone.localdate()
        sh.save()

        _recalc_po_status_from_shipments(sh.order)

        return Response(ShipmentSerializer(sh).data)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        sh = self.get_queryset().get(pk=kwargs["pk"])
        po = sh.order
        sh.delete()
        _recalc_po_status_from_shipments(po)
        return Response(status=status.HTTP_204_NO_CONTENT)
