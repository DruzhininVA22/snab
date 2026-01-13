from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    PriceRecordViewSet,
    PurchaseRequestViewSet,
    PurchaseOrderViewSet,
    metrics_overview,
)

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

router.register(
    r"purchase-orders", 
    PurchaseOrderViewSet, 
    basename="purchaseorder"
)

urlpatterns = [
    path("metrics-overview/", 
    metrics_overview, 
    name="metrics-overview"),
]

urlpatterns += router.urls
