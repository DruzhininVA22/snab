
"""
API приложения procurement.

Содержит ViewSet'ы и сервисные ручки для:
- работы с прайсами (PriceRecord);
- жизненного цикла заявок (PurchaseRequest) и строк;
- формирования заказов (PurchaseOrder);
- хранения и просмотра котировок (Quote);
- вспомогательных расчетов (best_price) и метрик (metrics_overview).
"""

from collections import defaultdict
from datetime import date, timedelta

from django.db.models import Count
from rest_framework import permissions, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    PriceRecord,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseRequest,
    PurchaseRequestLine,
    Quote,
    QuoteLine,
)
from .serializers import (
    PriceRecordSerializer,
    PurchaseOrderLineSerializer,
    PurchaseOrderSerializer,
    PurchaseRequestLineSerializer,
    PurchaseRequestSerializer,
    QuoteSerializer,
)

# Мягкие импорты
try:
    from core.models import Project, Stage, Task  # type: ignore
except Exception:  # pragma: no cover
    Project = Stage = Task = None  # type: ignore


class SafeReadOnlyMixin:
    """
    SafeReadOnlyMixin — REST‑endpoint для работы с сущностью/ресурсом SNAB.
    Назначение: обеспечить единый интерфейс для операций CRUD и чтения статусов.
    """

    def get_permissions(self):
        method = getattr(getattr(self, "request", None), "method", "GET")
        if method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]


class PriceRecordViewSet(SafeReadOnlyMixin, viewsets.ReadOnlyModelViewSet):
    """
    PriceRecordViewSet — REST‑endpoint для работы с сущностью/ресурсом SNAB.
    По умолчанию использует сериализатор: PriceRecordSerializer.
    Назначение: обеспечить единый интерфейс для операций CRUD и чтения статусов.
    """

    queryset = PriceRecord.objects.select_related("item", "supplier").order_by("-dt", "item__sku")
    serializer_class = PriceRecordSerializer


class PurchaseRequestViewSet(SafeReadOnlyMixin, viewsets.ModelViewSet):
    """
    PurchaseRequestViewSet — REST‑endpoint для работы с сущностью/ресурсом SNAB.
    По умолчанию использует сериализатор: PurchaseRequestSerializer.
    Переопределяет get_queryset(): поддерживает фильтрацию/поиск по query params.
    Назначение: обеспечить единый интерфейс для операций CRUD и чтения статусов.
    """

    serializer_class = PurchaseRequestSerializer

    def get_queryset(self):
        """
        Формирует queryset с учетом параметров запроса.
        Используется для фильтрации/поиска и оптимизации выборки (select_related/prefetch_related).
        Используемые параметры запроса: project, project_id, project_stage, stage, stage_id, status.
        """

        qs = PurchaseRequest.objects.all().order_by("-id")
        p = getattr(self.request, "query_params", {})
        pid = p.get("project") or p.get("project_id")
        sid = p.get("stage") or p.get("project_stage") or p.get("stage_id")
        status = p.get("status")
        try:
            if pid is not None and str(pid).strip() != "" and str(pid).lower() != "all":
                qs = qs.filter(project_id=int(pid))
        except Exception:
            pass
        try:
            if sid is not None and str(sid).strip() != "" and str(sid).lower() != "all":
                qs = qs.filter(project_stage_id=int(sid))
        except Exception:
            pass
        if status and str(status).lower() != "all":
            qs = qs.filter(status__iexact=str(status))
        return qs

    @action(detail=False, methods=["get"])
    def refs(self, request):
        data = {"projects": [], "stages": []}
        if Project:
            data["projects"] = list(Project.objects.order_by("name").values("id", "name"))
        pid = request.query_params.get("project")
        if pid and Stage:
            try:
                pid_i = int(pid)
            except Exception:
                pid_i = None
            if pid_i:
                data["stages"] = list(
                    Stage.objects.filter(project_id=pid_i).order_by("name").values("id", "name", "project_id")
                )
        return Response(data)

    @action(detail=True, methods=["post"])
    def assign_stage(self, request, pk=None):
        if Task is None:
            return Response({"error": "Task model not available"}, status=400)
        pr = self.get_object()
        stage_id = request.data.get("stage_id")
        project_id = request.data.get("project_id")
        try:
            stage_id = int(stage_id)
        except Exception:
            return Response({"error": "stage_id required"}, status=400)

        task = Task.objects.filter(stage_id=stage_id).order_by("id").first()
        if not task:
            return Response({"error": "Нет задач для указанной стадии"}, status=400)

        if project_id is not None:
            try:
                project_id = int(project_id)
            except Exception:
                project_id = None
            if project_id and getattr(task, "project_id", None) and task.project_id != project_id:
                return Response({"error": "Стадия не принадлежит проекту"}, status=400)

        updated = PurchaseRequestLine.objects.filter(request=pr, task_id__isnull=True).update(task_id=task.id)
        return Response({"ok": True, "task_id": task.id, "updated_lines": updated})


class PurchaseRequestLineViewSet(SafeReadOnlyMixin, viewsets.ModelViewSet):
    """
    PurchaseRequestLineViewSet — REST‑endpoint для работы с сущностью/ресурсом SNAB.
    По умолчанию использует сериализатор: PurchaseRequestLineSerializer.
    Назначение: обеспечить единый интерфейс для операций CRUD и чтения статусов.
    """

    queryset = PurchaseRequestLine.objects.select_related("request", "item", "unit").all().order_by("-id")
    serializer_class = PurchaseRequestLineSerializer


class PurchaseOrderViewSet(SafeReadOnlyMixin, viewsets.ModelViewSet):
    """
    PurchaseOrderViewSet — REST‑endpoint для работы с сущностью/ресурсом SNAB.
    По умолчанию использует сериализатор: PurchaseOrderSerializer.
    Назначение: обеспечить единый интерфейс для операций CRUD и чтения статусов.
    """

    queryset = PurchaseOrder.objects.select_related("supplier").prefetch_related("lines").order_by("-id")
    serializer_class = PurchaseOrderSerializer


class QuoteViewSet(SafeReadOnlyMixin, viewsets.ModelViewSet):
    """
    QuoteViewSet — REST‑endpoint для работы с сущностью/ресурсом SNAB.
    По умолчанию использует сериализатор: QuoteSerializer.
    Назначение: обеспечить единый интерфейс для операций CRUD и чтения статусов.
    """

    queryset = Quote.objects.prefetch_related("lines").order_by("-id")
    serializer_class = QuoteSerializer


@api_view(["GET"])
def best_price(request, item_id=None):
    """
    Возвращает «лучшую цену» по номенклатуре на основании истории прайсов (PriceRecord).
    Используется frontend для подбора поставщика/ориентира цены.
    Ожидаемые параметры обычно приходят через query params (например item_id/sku и т.п.).
    """

    iid = item_id or request.query_params.get("item")
    try:
        iid = int(iid)
    except Exception:
        return Response({"error": "item (id) required"}, status=400)

    rec = (
        PriceRecord.objects.filter(item_id=iid)
        .select_related("item", "supplier")
        .order_by("price", "-dt")
        .first()
    )
    if not rec:
        return Response({"best_price": None})
    return Response({"best_price": PriceRecordSerializer(rec).data})


@api_view(["GET"])
def metrics_overview(request):
    """
    Сводные метрики по закупкам для панели мониторинга.
    Агрегирует количество заявок/заказов/строк и их статусы за выбранный период.
    """

    data = {
        "purchase_requests_total": PurchaseRequest.objects.count(),
        "purchase_orders_total": PurchaseOrder.objects.count(),
        "quotes_total": Quote.objects.count(),
        "price_records_total": PriceRecord.objects.count(),
        "purchase_requests_by_status": list(
            PurchaseRequest.objects.values("status").order_by().annotate(count=Count("id"))
        ),
    }
    return Response(data)