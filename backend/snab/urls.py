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

from core.auth_csrf import csrf as csrf_view
from core.views import UnitViewSet, ItemViewSet


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


urlpatterns = [
    # Healthcheck
    path("", root_ok),

    # Django admin
    path("admin/", admin.site.urls),

    # CSRF‑endpoint для фронтенда (забирает/ставит csrftoken cookie)
    path("api/auth/csrf/", csrf_view),

    # Поставщики и всё, что к ним относится (CRUD, прайсы и т.п.)
    path("api/suppliers/", include("suppliers.urls")),

    # Доменные модули
    path("api/procurement/", include("procurement.urls")),
    path("api/projects/", include("projects.urls")),
    path("api/catalog/", include("catalog.urls")),
    path("api/warehouse/", include("warehouse.urls")),

    # Базовые справочники ядра: /api/units/, /api/items/
    path("api/", include(router.urls)),
]
