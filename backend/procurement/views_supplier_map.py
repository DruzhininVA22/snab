from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Unit
from catalog.models import Item
from suppliers.models import Supplier
from procurement.models import ItemSupplierMapping, SupplierPriceList, SupplierPriceListLine


def _ensure_unit() -> Unit:
    # stable default for tests/demo
    u = Unit.objects.filter(code__iexact="PCS").first() or Unit.objects.filter(code__iexact="шт").first()
    if u:
        return u
    return Unit.objects.create(code="PCS", name="шт")


def _get_or_create_price_list(supplier: Supplier) -> SupplierPriceList:
    pl = SupplierPriceList.objects.filter(supplier=supplier, is_active=True).order_by("-id").first()
    if pl:
        return pl
    return SupplierPriceList.objects.create(
        supplier=supplier,
        name="Авто-прайс (stub)",
        version="1.0",
        effective_date=date.today(),
        currency="RUB",
        is_active=True,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def supplier_map_preview(request):
    item_id = request.query_params.get("item")
    qs = ItemSupplierMapping.objects.select_related("item", "price_list_line__price_list__supplier")
    if item_id:
        try:
            qs = qs.filter(item_id=int(item_id))
        except Exception:
            pass
    data = []
    for m in qs.order_by("-id")[:200]:
        pl = m.price_list_line.price_list
        data.append(
            {
                "id": m.id,
                "item_id": m.item_id,
                "item_name": getattr(m.item, "name", ""),
                "supplier_id": pl.supplier_id,
                "supplier_name": getattr(pl.supplier, "name", ""),
                "supplier_sku": m.price_list_line.supplier_sku,
                "price": str(m.price_list_line.price),
                "conversion_factor": str(m.conversion_factor),
                "is_preferred": bool(m.is_preferred),
            }
        )
    return Response({"results": data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def supplier_map_upsert(request):
    """Contract expected by tests:

    POST /api/procurement/supplier-map/upsert/
    {
      "rows": [
        {"supplier": "<Supplier.name>", "supplier_sku": "SUP-ABC", "item_id": 1}
      ]
    }
    """
    payload = request.data or {}
    rows = payload.get("rows") or []
    if not isinstance(rows, list):
        return Response({"detail": "rows must be a list"}, status=400)

    unit = _ensure_unit()
    upserted = 0

    for row in rows:
        if not isinstance(row, dict):
            continue
        supplier_name = str(row.get("supplier") or "").strip()
        supplier_sku = str(row.get("supplier_sku") or "").strip()
        item_id = row.get("item_id")

        if not supplier_name or not supplier_sku or not item_id:
            continue

        try:
            item = Item.objects.get(id=int(item_id))
        except Exception:
            continue

        supplier = Supplier.objects.filter(name=supplier_name).first()
        if not supplier:
            supplier = Supplier.objects.create(name=supplier_name)

        pl = _get_or_create_price_list(supplier)

        pll, _ = SupplierPriceListLine.objects.get_or_create(
            price_list=pl,
            supplier_sku=supplier_sku,
            defaults={
                "description": item.name,
                "unit": unit,
                "price": Decimal("0"),
            },
        )

        ItemSupplierMapping.objects.update_or_create(
            item=item,
            price_list_line=pll,
            defaults={
                "conversion_factor": Decimal("1"),
                "is_preferred": True,
                "is_active": True,
            },
        )
        upserted += 1

    return Response({"upserted": upserted}, status=200)
