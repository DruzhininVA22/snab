"""
views.py — актуальная версия для catalog.

Содержит:
- category_tree: выдача дерева категорий (корни + вложенные дети),
- CategoryViewSet: CRUD по категориям с фильтрацией и поиском.
"""

from rest_framework import viewsets, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Category
from .serializers import CategorySerializer, CategoryTreeSerializer


@api_view(["GET"])
@permission_classes([AllowAny])  # пока открыт для прототипа; позже можно ограничить
def category_tree(request):
    """
    Дерево корневых категорий (level=0) с рекурсивными детьми.
    Используется фронтендом для построения дерева выбора категории.
    """
    roots = (
        Category.objects.filter(level=0)
        .prefetch_related("children")
        .order_by("path")
    )
    serializer = CategoryTreeSerializer(
        roots,
        many=True,
        context={"request": request},
    )
    return Response(serializer.data)


class CategoryViewSet(viewsets.ModelViewSet):
    """
    CategoryViewSet — REST‑endpoint для работы с сущностью Category.

    По умолчанию:
    - использует CategorySerializer,
    - требует аутентификацию (IsAuthenticated),
    - поддерживает поиск по имени/коду/описанию/подсказкам,
    - поддерживает фильтрацию по parent, is_leaf, code_prefix.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = CategorySerializer
    queryset = (
        Category.objects.all()
        .select_related("parent")
        .prefetch_related("children")
        .order_by("code")
    )
    filter_backends = [filters.SearchFilter]
    search_fields = [
        "name",
        "code",
        "description",
        "includes",
        "excludes",
        "borderline",
    ]

    def get_queryset(self):
        """
        Формирует queryset с учетом параметров запроса.

        query params:
        - parent: id родительской категории;
        - is_leaf: "true"/"1" или "false"/"0";
        - code_prefix: префикс кода (Hxx/Sxx).
        """
        qs = super().get_queryset()
        qp = self.request.query_params

        parent = qp.get("parent")
        if parent not in (None, "", "null", "undefined"):
            try:
                qs = qs.filter(parent_id=int(parent))
            except ValueError:
                pass

        is_leaf = qp.get("is_leaf")
        if is_leaf in ("true", "1"):
            qs = qs.filter(is_leaf=True)
        elif is_leaf in ("false", "0"):
            qs = qs.filter(is_leaf=False)

        code_prefix = qp.get("code_prefix")
        if code_prefix:
            qs = qs.filter(code__istartswith=code_prefix)

        return qs
