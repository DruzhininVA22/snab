"""
urls.py — маршруты модуля закупок (procurement).

Сейчас регистрируем:
- PriceRecordViewSet -> /api/procurement/pricerecords/
- PurchaseRequestViewSet -> /api/procurement/purchase-requests/ (+ /refs/)
"""

from rest_framework.routers import DefaultRouter

from .views import PriceRecordViewSet, PurchaseRequestViewSet

router = DefaultRouter()

router.register(
    r"pricerecords",
    PriceRecordViewSet,
    basename="pricerecord",
)

router.register(
    r"purchase-requests",
    PurchaseRequestViewSet,
    basename="purchaserequest",
)

urlpatterns = router.urls
