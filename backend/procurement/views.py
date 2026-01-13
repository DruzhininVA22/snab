"""
views.py — вьюхи для модуля закупок (procurement).

Реализовано:
- PriceRecordViewSet — read‑only история цен,
- PurchaseRequestViewSet — CRUD заявок с nested строками и /refs/.
"""

from django.db import transaction
from django.db.models import Count

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    PriceRecord, 
    PurchaseRequest, 
    PurchaseRequestLine,
    PurchaseOrder, 
    PurchaseOrderLine, 
    Quote, 
    QuoteLine,
)

from .serializers import (
    PriceRecordSerializer,
    PurchaseRequestSerializer,
    PurchaseRequestWriteSerializer,
    PurchaseOrderSerializer,
    PurchaseOrderLineSerializer,
    PurchaseRequestLineSerializer,
)
from projects.models import Project, ProjectStage
from datetime import date, timedelta
from collections import defaultdict

class SafeReadOnlyMixin:
    """
    Миксин, копирующий старое поведение:
    - SAFE_METHODS (GET/HEAD/OPTIONS) доступны всем,
    - изменяющие методы требуют аутентификацию.
    """

    def get_permissions(self):
        method = getattr(self.request, "method", "GET")
        if method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

class PriceRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /api/procurement/pricerecords/

    Только чтение истории цен.
    """

    queryset = PriceRecord.objects.all().select_related("supplier", "item")
    permission_classes = [permissions.AllowAny]
    serializer_class = PriceRecordSerializer


class PurchaseRequestViewSet(viewsets.ModelViewSet):
    """
    /api/procurement/purchase-requests/

    ViewSet для заявок на закупку (PurchaseRequest) c nested строками.
    """

    queryset = PurchaseRequest.objects.all().prefetch_related("lines")
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PurchaseRequestWriteSerializer
        return PurchaseRequestSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = PurchaseRequestWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pr = serializer.save()
        out = PurchaseRequestSerializer(pr, context={"request": request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.get("partial", False)
        instance = self.get_object()
        serializer = PurchaseRequestWriteSerializer(
            instance, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        pr = serializer.save()
        out = PurchaseRequestSerializer(pr, context={"request": request})
        return Response(out.data)

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    @action(methods=["get"], detail=False, url_path="refs")
    def refs(self, request, *args, **kwargs):
        """
        GET /api/procurement/purchase-requests/refs/

        Возвращает справочные данные:
        - список проектов,
        - список этапов проектов.
        """
        projects = list(
            Project.objects.all()
            .order_by("name")
            .values("id", "code", "name", "status")
        )
        stages = list(
            ProjectStage.objects.all()
            .order_by("project_id", "order")
            .values(
                "id",
                "project_id",
                "name",
                "status",
                "planned_start",
                "planned_end",
            )
        )
        return Response({"projects": projects, "stages": stages})

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    """
    /api/procurement/purchase-orders/

    CRUD по заказам поставщикам.
    """

    queryset = (
        PurchaseOrder.objects
        .select_related("supplier")
        .prefetch_related("lines")
        .order_by("-id")
    )
    permission_classes = [permissions.AllowAny]
    serializer_class = PurchaseOrderSerializer

@api_view(["GET"])
def metrics_overview(request):
    """
    GET /api/procurement/metrics-overview/

    Краткие метрики для дашборда.
    """
    # заявки
    total_pr = PurchaseRequest.objects.count()
    open_pr = PurchaseRequest.objects.filter(status="open").count()

    # строки заявок в ожидании
    waiting_lines = PurchaseRequestLine.objects.filter(status="pending").count()

    # простая раскладка по статусам сроков (ETA/SLAs) — можно доработать позже
    today = date.today()
    warn_date = today + timedelta(days=3)

    sla = defaultdict(int)
    qs = PurchaseRequestLine.objects.all().only("need_date", "status")
    for ln in qs:
        if not ln.need_date:
            continue
        if ln.need_date <= today:
            sla["hot"] += 1
        elif ln.need_date <= warn_date:
            sla["warn"] += 1
        else:
            sla["ok"] += 1

    data = {
        "purchase_requests_total": total_pr,
        "purchase_requests_open": open_pr,
        "lines_waiting": waiting_lines,
        "sla_hot": sla["hot"],
        "sla_warn": sla["warn"],
        "sla_ok": sla["ok"],
    }

    return Response(data)

@api_view(["GET"])
def metricsoverview(request):
    """
    GET /api/procurement/metricsoverview/

    Сводные метрики для дашборда (как в старом бэке).
    """

    data = {
        "purchaserequests_total": PurchaseRequest.objects.count(),
        "purchaseorders_total": PurchaseOrder.objects.count(),
        "quotes_total": Quote.objects.count(),
        "pricerecords_total": PriceRecord.objects.count(),
        "purchaserequests_by_status": list(
            PurchaseRequest.objects.values("status")
            .order_by("status")
            .annotate(count=Count("id"))
        ),
    }
    return Response(data)
