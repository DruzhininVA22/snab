"""
API приложения projects.

Содержит эндпоинты для чтения/редактирования проектов и их этапов.
Также реализует безопасные обертки на случай, когда БД еще не прогрета или миграции не применены.
"""

from typing import Any, Dict, List, Iterable

from django.db import transaction, IntegrityError, ProgrammingError, OperationalError
from django.db.models import Q

from rest_framework import viewsets, mixins, status, generics, permissions, serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from .models import Project, ProjectStage, StageTemplate, StageTemplateLine
from .serializers import (
    ProjectListSerializer,
    ProjectDetailSerializer,
    ProjectStageSerializer,
    ProjectSerializer,
)


class SafeMixin:
    """
    SafeMixin — REST‑endpoint для работы с сущностью/ресурсом SNAB.
    Назначение: обеспечить единый интерфейс для операций CRUD и чтения статусов.
    """

    def _db_safe(self, fn, *args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except (ProgrammingError, OperationalError) as e:
            return Response(
                {"detail": f"DB error: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


def _normalize_project_stage_order(project_id: int) -> List[Dict[str, Any]]:
    """Приводим номера этапов к 1..N по order,id (в транзакции)."""
    with transaction.atomic():
        rows = list(
            ProjectStage.objects.select_for_update()
            .filter(project_id=project_id)
            .order_by("order", "id")
        )
        for idx, row in enumerate(rows, start=1):
            if row.order != idx:
                row.order = idx
                row.save(update_fields=["order"])

    # Возвращаем сериализованные данные (для удобного ответа)
    data = ProjectStageSerializer(
        ProjectStage.objects.filter(project_id=project_id).order_by("order", "id"),
        many=True,
    ).data
    return data


class ProjectViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
    SafeMixin,
):
    """
    ProjectViewSet — REST‑endpoint для работы с сущностью/ресурсом SNAB.
    Переопределяет get_queryset(): поддерживает фильтрацию/поиск по query params.
    Переопределяет get_serializer_class(): выбирает сериализатор в зависимости от действия (list/retrieve/...).
    Назначение: обеспечить единый интерфейс для операций CRUD и чтения статусов.
    """

    # permission_classes = [IsAuthenticatedOrReadOnly]
    permission_classes = [permissions.AllowAny]
    queryset = Project.objects.all().order_by("-id")
    serializer_class = ProjectSerializer

    def get_serializer_class(self):
        """
        Выбирает сериализатор в зависимости от выполняемого действия (list/retrieve/create/...).
        Нужно, чтобы в списках отдавать краткую форму, а в карточке — расширенную.
        """
        if self.action == "retrieve":
            return ProjectDetailSerializer
        return ProjectListSerializer

    def get_queryset(self):
        """
        Формирует queryset с учетом параметров запроса.
        Используется для фильтрации/поиска и оптимизации выборки (select_related/prefetch_related).
        Используемые параметры запроса: search.
        """
        try:
            qs = Project.objects.all()
        except (ProgrammingError, OperationalError):
            return Project.objects.none()

        search = self.request.query_params.get("search") if self.request else None
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))

        if hasattr(Project, "created_at"):
            return qs.order_by("-created_at", "-id")
        return qs.order_by("-id")

    def create(self, request, *args, **kwargs):
        """
        Обёртка вокруг стандартного create + _db_safe.
        Здесь используется perform_create, чтобы развернуть стадии по шаблону.
        """

        def _create():
            ser = self.get_serializer(data=request.data)
            ser.is_valid(raise_exception=True)
            try:
                with transaction.atomic():
                    self.perform_create(ser)
            except IntegrityError as e:
                return Response(
                    {"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST
                )

            headers = self.get_success_headers(ser.data)
            return Response(ser.data, status=status.HTTP_201_CREATED, headers=headers)

        return self._db_safe(_create)

    # ---------- ЭТАПЫ ПРОЕКТА ----------

    @action(detail=True, methods=["get", "post"], url_path="stages")
    def stages(self, request, pk=None):
        if request.method.lower() == "get":

            def _list():
                qs = ProjectStage.objects.filter(project_id=pk).order_by(
                    "order", "id"
                )
                data = ProjectStageSerializer(qs, many=True).data
                return Response(data, status=status.HTTP_200_OK)

            return self._db_safe(_list)

        # POST: создать этап → нормализовать → вернуть полный список
        def _create():
            payload: Dict[str, Any] = dict(request.data or {})
            payload["project"] = int(pk)

            if not payload.get("status"):
                try:
                    default_status = ProjectStage._meta.get_field("status").default
                except Exception:
                    default_status = None
                payload["status"] = default_status or "planned"

            ser = ProjectStageSerializer(data=payload)
            ser.is_valid(raise_exception=True)

            with transaction.atomic():
                obj = ser.save()

            stages = _normalize_project_stage_order(int(pk))
            return Response(
                {
                    "created": ProjectStageSerializer(obj).data,
                    "count": len(stages),
                    "stages": stages,
                },
                status=status.HTTP_201_CREATED,
            )

        return self._db_safe(_create)

    def perform_create(self, serializer):
        """
        Хук DRF: создаём проект и, если передан template,
        разворачиваем стадии по шаблону.
        """
        request = self.request
        template_id = request.data.get("template") or request.data.get("template_id")

        project = serializer.save()

        if not template_id:
            return

        try:
            tpl = StageTemplate.objects.get(id=int(template_id))
        except (StageTemplate.DoesNotExist, ValueError, TypeError):
            return

        lines = tpl.lines.order_by("order", "id")
        for line in lines:
            ProjectStage.objects.create(
                project=project,
                order=line.order,
                name=line.name,
                status="planned",
            )

    @action(detail=True, methods=["post"], url_path="apply_template")
    def apply_template(self, request, pk=None):
        """
        POST /api/projects/projects/<id>/apply_template

        Применяет шаблон этапов к существующему проекту.
        При replace=true старые этапы удаляются.
        """
        template_id = (
            request.data.get("template_id")
            or request.data.get("template")
        )
        if not template_id:
            return Response(
                {"detail": "template_id required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            tpl = StageTemplate.objects.get(id=int(template_id))
        except (StageTemplate.DoesNotExist, ValueError, TypeError):
            return Response(
                {"detail": "Template not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        replace = bool(request.data.get("replace"))
        renumber_from = int(request.data.get("renumber_from") or 1)

        with transaction.atomic():
            # удалить старые этапы, если нужно
            if replace:
                ProjectStage.objects.filter(project_id=pk).delete()

            # создать новые этапы по линиям шаблона
            lines = tpl.lines.order_by("order", "id")
            for idx, line in enumerate(lines, start=renumber_from):
                ProjectStage.objects.create(
                    project_id=pk,
                    order=idx,
                    name=line.name,
                    status="planned",
                )

            stages = _normalize_project_stage_order(int(pk))

        return Response(
            {"stages": stages},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="stages/reorder")
    def stages_reorder(self, request, pk=None):
        """Принять список ID в целевом порядке и пересохранить order → 1..N."""
        ids: List[int] = list(request.data or {}).get("ids") or []
        if not isinstance(ids, list) or not all(isinstance(x, int) for x in ids):
            return Response(
                {"detail": 'Ожидается JSON: {"ids": [int, ...]}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Установим временно большие номера, чтобы избежать конфликтов уникальности, если появится
            base = 1000000
            for i, sid in enumerate(ids, start=1):
                ProjectStage.objects.filter(project_id=pk, id=sid).update(
                    order=base + i
                )

        stages = _normalize_project_stage_order(int(pk))
        return Response(
            {"count": len(stages), "stages": stages},
            status=status.HTTP_200_OK,
        )


# ---------- ЭТАПЫ ПРОЕКТА ----------


class ProjectStageViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
    SafeMixin,
):
    """
    ProjectStageViewSet — REST‑endpoint для работы с сущностью/ресурсом SNAB.
    По умолчанию использует сериализатор: ProjectStageSerializer.
    Переопределяет get_queryset(): поддерживает фильтрацию/поиск по query params.
    Назначение: обеспечить единый интерфейс для операций CRUD и чтения статусов.
    """

    permission_classes = [IsAuthenticatedOrReadOnly]
    serializer_class = ProjectStageSerializer

    def get_queryset(self):
        """
        Формирует queryset с учетом параметров запроса.
        Используется для фильтрации/поиска и оптимизации выборки (select_related/prefetch_related).
        Используемые параметры запроса: project, search.
        """
        try:
            qs = ProjectStage.objects.all()
        except (ProgrammingError, OperationalError):
            return ProjectStage.objects.none()

        project_id = self.request.query_params.get("project") if self.request else None
        if project_id:
            qs = qs.filter(project_id=project_id)

        search = self.request.query_params.get("search") if self.request else None
        if search:
            qs = qs.filter(Q(name__icontains=search))

        return qs.order_by("project_id", "order", "id")

    def create(self, request, *args, **kwargs):
        """
        Стандартный обработчик DRF (create). Основные правила описаны в сериализаторах и permissions.
        """

        def _create():
            ser = self.get_serializer(data=request.data)
            ser.is_valid(raise_exception=True)
            with transaction.atomic():
                obj = ser.save()
            # Нормализуем порядок в рамках проекта
            _normalize_project_stage_order(
                int(
                    ser.validated_data.get("project").id
                    if hasattr(ser.validated_data.get("project"), "id")
                    else ser.validated_data.get("project")
                )
            )
            return Response(
                self.get_serializer(obj).data,
                status=status.HTTP_201_CREATED,
            )

        return self._db_safe(_create)

    def update(self, request, *args, **kwargs):
        """
        Стандартный обработчик DRF (update). Основные правила описаны в сериализаторах и permissions.
        """
        partial = kwargs.pop("partial", False)

        def _update():
            instance = self.get_object()
            ser = self.get_serializer(instance, data=request.data, partial=partial)
            ser.is_valid(raise_exception=True)
            with transaction.atomic():
                obj = ser.save()
            # Нормализуем μετά изменения order
            _normalize_project_stage_order(int(obj.project_id))
            # Вернём актуальный список по проекту для удобства
            data = ProjectStageSerializer(
                ProjectStage.objects.filter(project_id=obj.project_id).order_by(
                    "order", "id"
                ),
                many=True,
            ).data
            return Response(
                {"updated": ProjectStageSerializer(obj).data, "stages": data},
                status=status.HTTP_200_OK,
            )

        return self._db_safe(_update)

    def destroy(self, request, *args, **kwargs):
        """
        Стандартный обработчик DRF (destroy). Основные правила описаны в сериализаторах и permissions.
        """

        def _destroy():
            instance = self.get_object()
            project_id = int(instance.project_id)
            instance.delete()
            stages = _normalize_project_stage_order(project_id)
            return Response(
                {"deleted": True, "stages": stages},
                status=status.HTTP_200_OK,
            )

        return self._db_safe(_destroy)


class ProjectListLiteView(generics.ListAPIView):
    """
    GET /api/projects/?pagesize=25&search=...
    Лёгкий список проектов для выпадашки.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = ProjectSerializer

    def get_queryset(self):
        qs = Project.objects.all()

        params = self.request.query_params

        search = params.get("search")
        if search:
            s = search.strip()
            if s:
                from django.db.models import Q

                qs = qs.filter(Q(name__icontains=s) | Q(code__icontains=s))

        return qs.order_by("name")


class StageTemplateLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = StageTemplateLine
        fields = [
            "id",
            "template",
            "order",
            "name",
            "default_duration_days",
            "default_offset_days",
        ]


class StageTemplateSerializer(serializers.ModelSerializer):
    lines = StageTemplateLineSerializer(many=True, read_only=True)

    class Meta:
        model = StageTemplate
        fields = ["id", "name", "code", "is_active", "description", "lines"]


class StageTemplateViewSet(viewsets.ModelViewSet):
    queryset = StageTemplate.objects.all().order_by("name", "id")
    serializer_class = StageTemplateSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
