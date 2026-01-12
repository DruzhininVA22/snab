"""
views.py — вьюхи для модуля закупок (procurement).

Реализовано:
- PriceRecordViewSet — read‑only история цен,
- PurchaseRequestViewSet — CRUD заявок с nested строками и /refs/.
"""

from django.db import transaction
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import PriceRecord, PurchaseRequest
from .serializers import (
    PriceRecordSerializer,
    PurchaseRequestSerializer,
    PurchaseRequestWriteSerializer,
)
from projects.models import Project, ProjectStage


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
