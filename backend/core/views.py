"""
ViewSet'ы приложения core.

Файл содержит REST‑эндпоинты для справочников: единицы измерения, поставщики и номенклатура.
Эти ручки используются фронтендом для заполнения выпадающих списков, поиска и выбора сущностей.
"""

from django.db.models import Q
from django.core.exceptions import FieldDoesNotExist
from rest_framework import viewsets

from core.models import Unit
from catalog.models import Item
from suppliers.models import Supplier
from core.serializers import UnitSerializer
from catalog.serializers import ItemSerializer
from suppliers.serializers import SupplierListSerializer, SupplierDetailSerializer


class UnitViewSet(viewsets.ModelViewSet):
    """
    UnitViewSet — REST‑endpoint для работы с сущностью/ресурсом SNAB.
    По умолчанию использует сериализатор: UnitSerializer.
    Назначение: обеспечить единый интерфейс для операций CRUD и чтения статусов.
    """

    queryset = Unit.objects.all().order_by("name")
    serializer_class = UnitSerializer


class SupplierViewSet(viewsets.ModelViewSet):
    """
    SupplierViewSet — REST‑endpoint для работы с сущностью/ресурсом SNAB.
    Переопределяет get_queryset(): поддерживает фильтрацию/поиск по query params.
    Переопределяет get_serializer_class(): выбирает сериализатор в зависимости от действия (list/retrieve/...).
    Назначение: обеспечить единый интерфейс для операций CRUD и чтения статусов.
    """

    queryset = Supplier.objects.all().order_by("name")
    
    def get_serializer_class(self):
        """
        Выбирает сериализатор в зависимости от выполняемого действия (list/retrieve/create/...).
        Нужно, чтобы в списках отдавать краткую форму, а в карточке — расширенную.
        """

        if self.action == 'retrieve':
            return SupplierDetailSerializer
        return SupplierListSerializer

    def get_queryset(self):
        """
        Формирует queryset с учетом параметров запроса.
        Используется для фильтрации/поиска и оптимизации выборки (select_related/prefetch_related).
        Используемые параметры запроса: category, search.
        """

        qs = super().get_queryset().prefetch_related("categories")
        params = getattr(self.request, "query_params", {})

        cat = params.get("category")
        if cat not in (None, "", "null", "undefined"):
            try:
                qs = qs.filter(categories__id=int(cat))
            except (TypeError, ValueError):
                pass

        search = params.get("search")
        if search:
            s = search.strip()
            if s:
                qs = qs.filter(Q(name__icontains=s) | Q(inn__icontains=s))
        return qs


class ItemViewSet(viewsets.ModelViewSet):
    """
    ItemViewSet — REST‑endpoint для работы с сущностью/ресурсом SNAB.
    По умолчанию использует сериализатор: ItemSerializer.
    Переопределяет get_queryset(): поддерживает фильтрацию/поиск по query params.
    Назначение: обеспечить единый интерфейс для операций CRUD и чтения статусов.
    """

    serializer_class = ItemSerializer
    queryset = Item.objects.all().select_related("unit", "category").order_by("sku")

    def get_queryset(self):
        """
        Формирует queryset с учетом параметров запроса.
        Используется для фильтрации/поиска и оптимизации выборки (select_related/prefetch_related).
        Используемые параметры запроса: category, q, search.
        """

        qs = super().get_queryset()
        params = getattr(self.request, "query_params", {})

        # Фильтр по категории
        cat = params.get("category")
        if cat not in (None, "", "null", "undefined"):
            try:
                cat_val = int(cat)
                qs = qs.filter(category_id=cat_val)
            except (TypeError, ValueError):
                pass

        # Поиск по name и sku
        search = params.get("search") or params.get("q")
        if search:
            s = search.strip()
            if s:
                qs = qs.filter(Q(name__icontains=s) | Q(sku__icontains=s))

        return qs