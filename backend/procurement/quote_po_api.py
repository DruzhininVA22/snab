from decimal import Decimal

from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Quote, PurchaseOrder, PurchaseOrderLine, PurchaseRequestLine


class QuotePurchaseOrderView(APIView):
    """
    API для работы со связкой КП -> Заказ поставщику.

    GET  /api/procurement/quotes/<id>/purchase-order/  -> {purchase_order_id, number} | null
    POST /api/procurement/quotes/<id>/purchase-order/  -> создать заказ из НЕ исключённых строк КП

    Правила:
    - строки КП с is_blocked=True не попадают в заказ
    - qty берём из PurchaseRequestLine по item_id (если есть связанная заявка)
    - если заказ уже существует — 409
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, quote_id: int):
        po = PurchaseOrder.objects.filter(quote_id=quote_id).order_by("-id").first()
        if not po:
            return Response({"purchase_order_id": None}, status=status.HTTP_200_OK)
        return Response({"purchase_order_id": po.id, "number": po.number}, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request, quote_id: int):
        quote = Quote.objects.select_related("supplier", "purchase_request").prefetch_related("lines__item").get(id=quote_id)

        existing = PurchaseOrder.objects.filter(quote_id=quote.id).order_by("-id").first()
        if existing:
            return Response(
                {"detail": "По этому КП уже сформирован заказ поставщику.", "purchase_order_id": existing.id},
                status=status.HTTP_409_CONFLICT,
            )

        po_number = f"PO-{quote.id}"

        po = PurchaseOrder.objects.create(
            supplier=quote.supplier,
            number=po_number,
            status="draft",
            quote=quote,
            purchase_request=quote.purchase_request,
        )

        qty_map = {}
        if quote.purchase_request_id:
            qty_map = {
                row["item_id"]: row["qty"]
                for row in PurchaseRequestLine.objects.filter(request_id=quote.purchase_request_id).values("item_id", "qty")
            }

        for ln in quote.lines.filter(is_blocked=False).select_related("item"):
            qty = qty_map.get(ln.item_id) or Decimal("1")
            PurchaseOrderLine.objects.create(
                order=po,
                item=ln.item,
                qty=qty,
                price=ln.price,
                status="pending",
            )

        return Response({"purchase_order_id": po.id, "number": po.number}, status=status.HTTP_201_CREATED)
