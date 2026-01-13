"""
API эндпоинты для работы с поставщиками.

Содержит:
- SupplierViewSet: CRUD по поставщикам с фильтрацией и поиском.
"""

from django.db.models import Q

from rest_framework import permissions, viewsets
from rest_framework.response import Response

from .models import Supplier
from .serializers import (
    SupplierListSerializer,
    SupplierDetailSerializer,
    SupplierWriteSerializer,
)


class SupplierViewSet(viewsets.ModelViewSet):
    """
    CRUD по поставщикам.

    Эндпоинты:
    - GET /api/suppliers/suppliers/ — список (страница SuppliersPage)
    - GET /api/suppliers/suppliers/{id}/ — детальная карточка
    - POST /api/suppliers/suppliers/ — создать
    - PATCH /api/suppliers/suppliers/{id}/ — частичное обновление
    - PUT /api/suppliers/suppliers/{id}/ — полное обновление
    """

    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        """
        Выбор сериализатора в зависимости от действия:
        - create/update/partial_update → SupplierWriteSerializer (форма)
        - retrieve → SupplierDetailSerializer (детальная карточка)
        - list/прочие → SupplierListSerializer (краткое представление)
        """
        if self.action in ("create", "update", "partial_update"):
            return SupplierWriteSerializer
        if self.action == "retrieve":
            return SupplierDetailSerializer
        return SupplierListSerializer

    def get_queryset(self):
        """
        Базовый queryset поставщиков + фильтры.

        Поддерживаемые query‑параметры:
        - ?search=... — поиск по:
          name, activity, inn, address,
          terms.delivery_regions, terms.payment_terms
        - ?status=... — фильтр по полю Supplier.status
          (preferred / regular / blocked)
        - ?region=... — фильтр по terms.delivery_regions (icontains)
        - ?categories=... — фильтр по категориям (может быть несколько раз)
          ?categories=15&categories=16
        - ?ordering=... — сортировка, по умолчанию name
        """
        qs = (
            Supplier.objects.all()
            .select_related("terms")
            .prefetch_related("contacts", "categories", "pricelists")
        )

        params = self.request.query_params

        # Поиск по тексту
        search = params.get("search")
        if search:
            s = search.strip()
            if s:
                qs = qs.filter(
                    Q(name__icontains=s)
                    | Q(activity__icontains=s)
                    | Q(inn__icontains=s)
                    | Q(address__icontains=s)
                    | Q(terms__delivery_regions__icontains=s)
                    | Q(terms__payment_terms__icontains=s)
                )

        # Фильтр по статусу (важен для теста test_filter_and_search_suppliers)
        status_val = params.get("status")
        if status_val:
            qs = qs.filter(status=status_val)

        # Фильтр по региону
        region = params.get("region")
        if region:
            r = region.strip()
            if r:
                qs = qs.filter(terms__delivery_regions__icontains=r)

        # ✅ Фильтр по категориям (множественный ?categories=15&categories=16)
        category_ids = params.getlist("categories")
        if category_ids:
            qs = qs.filter(categories__id__in=category_ids).distinct()

        # Сортировка
        ordering = params.get("ordering") or "name"
        if ordering:
            qs = qs.order_by(ordering)

        return qs

    def update(self, request, *args, **kwargs):
        """
        Обновление поставщика (PUT/PATCH).

        Используем SupplierWriteSerializer для валидации и записи,
        а на выход отдаём SupplierDetailSerializer, чтобы фронт
        получил полную карточку.
        """
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        in_serializer = SupplierWriteSerializer(
            instance, data=request.data, partial=partial
        )

        in_serializer.is_valid(raise_exception=True)
        supplier = in_serializer.save()
        out_serializer = SupplierDetailSerializer(supplier)
        return Response(out_serializer.data)

    def partial_update(self, request, *args, **kwargs):
        """
        Частичное обновление (PATCH).

        Просто пробрасываем в общий update с partial=True.
        """
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)
