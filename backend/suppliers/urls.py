from rest_framework.routers import DefaultRouter
from .views import (
    SupplierViewSet,
    SupplierPriceListViewSet,
    SupplierPriceLineViewSet,
)

router = DefaultRouter()

# основной справочник поставщиков
router.register(
    r'suppliers',
    SupplierViewSet,
    basename='supplier'
)

# прайсы (пока опционально, но пусть будут)
router.register(
    r'supplier-pricelists',
    SupplierPriceListViewSet,
    basename='supplier-pricelist'
)

router.register(
    r'supplier-pricelines',
    SupplierPriceLineViewSet,
    basename='supplier-priceline'
)

urlpatterns = router.urls
