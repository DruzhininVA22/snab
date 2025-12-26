"""
Корневые URL‑маршруты проекта SNAB.

Файл агрегирует API‑маршруты приложений (procurement/projects/catalog/warehouse)
и базовые сервисные обработчики (CSRF).
"""

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.auth_csrf import csrf as csrf_view
from core.views import UnitViewSet, SupplierViewSet, ItemViewSet
from django.http import JsonResponse


router = DefaultRouter()
router.register(r'units', UnitViewSet)
router.register(r'suppliers', SupplierViewSet)
router.register(r'items', ItemViewSet)

def root_ok(request):
    """
    Healthcheck endpoint для стенда/мониторинга.
    Нужен, чтобы GET / не давал 404 и можно было быстро проверить,
    что Django поднят и отвечает.
    """
    return JsonResponse({"status": "ok", "service": "snab-backend"})

urlpatterns = [
    path("", root_ok),
    path('api/auth/csrf/', csrf_view),
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/procurement/', include('procurement.urls')),
    path('api/projects/', include('projects.urls')),
    path('api/catalog/', include('catalog.urls')),
    path('api/warehouse/', include('warehouse.urls')),
]