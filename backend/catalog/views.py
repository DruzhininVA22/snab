"""
API приложения catalog.

Содержит ViewSet'ы для справочника категорий и связанных объектов.
"""

from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from .models import Category
from .serializers import CategorySerializer

class CategoryViewSet(viewsets.ModelViewSet):
    """
    CategoryViewSet — REST‑endpoint для работы с сущностью/ресурсом SNAB.
    По умолчанию использует сериализатор: CategorySerializer.
    Переопределяет get_queryset(): поддерживает фильтрацию/поиск по query params.
    Назначение: обеспечить единый интерфейс для операций CRUD и чтения статусов.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = CategorySerializer
    queryset = Category.objects.all().select_related('parent').order_by('code')

    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'code', 'description', 'includes', 'excludes', 'borderline']

    def get_queryset(self):
        """
        Формирует queryset с учетом параметров запроса.
        Используется для фильтрации/поиска и оптимизации выборки (select_related/prefetch_related).
        Используемые параметры запроса: code_prefix, is_leaf, parent.
        """

        qs = super().get_queryset()
        qp = self.request.query_params

        parent = qp.get('parent')
        if parent not in (None, '', 'null', 'undefined'):
            try:
                qs = qs.filter(parent_id=int(parent))
            except ValueError:
                pass

        is_leaf = qp.get('is_leaf')
        if is_leaf in ('true', '1'):
            qs = qs.filter(is_leaf=True)
        elif is_leaf in ('false', '0'):
            qs = qs.filter(is_leaf=False)

        code_prefix = qp.get('code_prefix')
        if code_prefix:
            qs = qs.filter(code__istartswith=code_prefix)

        return qs