"""
Корневые URL‑маршруты проекта SNAB.

Задача этого файла:
- отдать healthcheck ("/"),
- подключить Django admin,
- отдать CSRF‑эндпоинт,
- собрать под /api/ все REST‑маршруты приложений (core, suppliers, procurement, projects, catalog, warehouse).
"""

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.http import JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView


from core.auth_csrf import csrf as csrf_view
from core.views import UnitViewSet, ItemViewSet
from catalog.views import CategoryViewSet as CatalogCategoryViewSet



# Роутер для "базовых" справочников ядра (единицы измерения и номенклатура).
# Эти сущности используются в разных доменах (catalog, procurement, suppliers).
router = DefaultRouter()
router.register(r"units", UnitViewSet, basename="unit")
router.register(r"items", ItemViewSet, basename="item")


def root_ok(request):
    """
    Простой healthcheck endpoint.

    Нужен для:
    - проверок балансировщиками/мониторингом,
    - чтобы GET / не возвращал 404.

    Возвращает JSON:
    {"status": "ok", "service": "snab-backend"}
    """
    return JsonResponse({"status": "ok", "service": "snab-backend"})


# ---------------------------------------------------------------------
# COMPAT ROUTES (frontend fallback)
# ---------------------------------------------------------------------
# Фронтенд в некоторых местах пробует альтернативные URL-ы:
# - /api/categories/ и /api/core/categories/ (категории)
# - /api/catalog/units/ (единицы измерения)
#
# Эти маршруты НЕ меняют контракты существующих эндпоинтов,
# а лишь добавляют alias, чтобы не получать 404.

category_list_compat = CatalogCategoryViewSet.as_view({"get": "list", "post": "create"})
category_detail_compat = CatalogCategoryViewSet.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy",
})

unit_list_compat = UnitViewSet.as_view({"get": "list", "post": "create"})
unit_detail_compat = UnitViewSet.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy",
})

urlpatterns = [
    # Healthcheck
    path("", root_ok),

    # Django admin
    path("admin/", admin.site.urls),

    # CSRF‑endpoint для фронтенда (забирает/ставит csrftoken cookie)
    path("api/auth/csrf/", csrf_view),

    # -----------------------------------------------------------------
    # COMPAT: frontend fallback routes (должны идти ДО include("api/..."))
    # -----------------------------------------------------------------
    # 1) /api/categories/ и /api/core/categories/ (категории)
    # 2) /api/catalog/units/ (единицы измерения)
    #
    # ВАЖНО: этот блок должен быть ВЫШЕ, чем:
    # - path('api/core/', include('core.urls'))  (иначе съест /api/core/categories/)
    # - path("api/catalog/", include("catalog.urls")) (иначе съест /api/catalog/units/)
    # - path("api/", include(router.urls)) (иначе съест /api/categories/)
    #
    # Эти маршруты не меняют существующие контракты — это лишь alias.

    path("api/categories/", category_list_compat),
    path("api/categories/<int:pk>/", category_detail_compat),
    path("api/core/categories/", category_list_compat),
    path("api/core/categories/<int:pk>/", category_detail_compat),
    path("api/catalog/units/", unit_list_compat),
    path("api/catalog/units/<int:pk>/", unit_detail_compat),

    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),

    # Поставщики и всё, что к ним относится (CRUD, прайсы и т.п.)
    path("api/suppliers/", include("suppliers.urls")),

    # Доменные модули
    path('api/reference/', include('core.urls')),
    # COMPAT: alias for frontend fallback (/api/core/units/)
    path('api/core/', include('core.urls')),

    path("api/procurement/", include("procurement.urls")),
    path("api/projects/", include("projects.urls")),
    path("api/catalog/", include("catalog.urls")),
    path("api/warehouse/", include("warehouse.urls")),

    # Базовые справочники ядра: /api/units/, /api/items/
    path("api/", include(router.urls)),
    path("api/dashboard/", include("dashboard.urls")),
    
]