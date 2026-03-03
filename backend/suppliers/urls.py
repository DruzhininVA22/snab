from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    SupplierViewSet, 
    SupplierPriceListViewSet, 
    SupplierPriceLineViewSet
)

router = DefaultRouter()
router.register(r"suppliers", SupplierViewSet, basename="supplier")
router.register(r"price-lists", SupplierPriceListViewSet, basename="supplier-price-list")
router.register(r"price-lines", SupplierPriceLineViewSet, basename="supplier-price-line")

# ----------------------------------------------------------------------------
# COMPAT: /api/suppliers/ (frontend expects root endpoints)
#
# В проекте исторически использовался префикс /api/suppliers/suppliers/.
# Фронт SNAB использует /api/suppliers/ напрямую.
# Здесь добавляем точные маршруты с int-конвертером, чтобы не конфликтовать
# с /price-lists/ и /price-lines/.
# ----------------------------------------------------------------------------

supplier_root = SupplierViewSet.as_view({"get": "list", "post": "create"})
supplier_detail = SupplierViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
)

urlpatterns = [
    path("", supplier_root, name="supplier-root"),
    path("<int:pk>/", supplier_detail, name="supplier-detail-root"),
    path("", include(router.urls)),
]
