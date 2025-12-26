from django.db.models import Q
from rest_framework import viewsets, permissions
from rest_framework.response import Response

from .models import (
    Supplier,
    SupplierPriceList,
    SupplierPriceLine,
)
from .serializers import (
    SupplierListSerializer,
    SupplierDetailSerializer,
    SupplierWriteSerializer,
    SupplierPriceListSummarySerializer,
    SupplierPriceListDetailSerializer,
    SupplierPriceLineSerializer,
)


class SupplierViewSet(viewsets.ModelViewSet):
    """
    /api/suppliers/
    - GET (list): используется слева в SuppliersPage для списка поставщиков
    - GET (retrieve): детальная карточка справа
    - POST/PATCH: формы создания/редактирования
    """
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        # форма создания/редактирования
        if self.action in ("create", "update", "partial_update"):
            return SupplierWriteSerializer
        # просмотр одной карточки (в т.ч. для редактирования)
        if self.action in ("retrieve",):
            return SupplierDetailSerializer
        # список слева
        return SupplierListSerializer

    def get_queryset(self):
        """
        Мы поддерживаем те параметры, которые уже шлёт фронт:
        - ?search=текст
        - ?status=regular / preferred / blocked
        - ?region=Москва
        - ?ordering=name (или любая колонка)
        - ?page_size=200 (пагинация DRF сделает остальное)
        """
        qs = (
            Supplier.objects.all()
            .select_related("terms")
            .prefetch_related("contacts", "categories", "pricelists")
        )

        params = self.request.query_params

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

        status_val = params.get("status")
        if status_val:
            qs = qs.filter(status=status_val)

        region = params.get("region")
        if region:
            r = region.strip()
            if r:
                qs = qs.filter(terms__delivery_regions__icontains=r)

        ordering = params.get("ordering")
        if ordering:
            # пример: "name" или "-name"
            qs = qs.order_by(ordering)

        return qs

    def create(self, request, *args, **kwargs):
        """
        Создание нового поставщика из SupplierCreatePage.
        Использует SupplierWriteSerializer.
        """
        serializer = SupplierWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        out = SupplierDetailSerializer(instance)
        return Response(out.data)

    def partial_update(self, request, *args, **kwargs):
        """
        PATCH /api/suppliers/{id}/
        Редактирование поставщика из SupplierEditPage.
        """
        instance = self.get_object()
        serializer = SupplierWriteSerializer(
            instance, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        out = SupplierDetailSerializer(instance)
        return Response(out.data)

    # update (PUT) и destroy (DELETE) можно оставить
    # базовыми, если они тебе нужны потом.


class SupplierPriceListViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /api/supplier-pricelists/
    Детали прайсов (пока фронт их не дергает напрямую,
    но оставляем на будущее).
    """
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        if self.action in ("retrieve",):
            return SupplierPriceListDetailSerializer
        return SupplierPriceListSummarySerializer

    def get_queryset(self):
        qs = (
            SupplierPriceList.objects.all()
            .select_related("supplier")
            .prefetch_related("lines")
        )

        supplier_id = self.request.query_params.get("supplier")
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)

        return qs.order_by("-valid_from", "-created_at")


class SupplierPriceLineViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /api/supplier-pricelines/
    Строки прайс-листа. Сейчас в UI напрямую не вызывается,
    но пригодится для сравнения цен.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = SupplierPriceLineSerializer

    def get_queryset(self):
        qs = (
            SupplierPriceLine.objects.all()
            .select_related("pricelist", "unit", "pricelist__supplier")
        )

        pricelist_id = self.request.query_params.get("pricelist")
        if pricelist_id:
            qs = qs.filter(pricelist_id=pricelist_id)

        return qs.order_by("pricelist_id", "item")
