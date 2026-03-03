from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    PriceRecordViewSet,
    PurchaseRequestViewSet,
    PurchaseOrderViewSet,
    metrics_overview,
    QuoteViewSet,
    SupplierPriceListViewSet,
    SupplierPriceListLineViewSet,
    ItemSupplierMappingViewSet,
)
from .views_shipments import ShipmentViewSet
from .quote_lines_api import QuoteLineViewSet
from .quote_po_api import QuotePurchaseOrderView
from .views_supplier_map import supplier_map_preview, supplier_map_upsert


router = DefaultRouter()

router.register("pricerecords", PriceRecordViewSet, basename="pricerecord")
router.register("purchase-requests", PurchaseRequestViewSet, basename="purchaserequest")
router.register("purchase-orders", PurchaseOrderViewSet, basename="purchaseorder")
router.register("quotes", QuoteViewSet, basename="quote")
router.register("quote-lines", QuoteLineViewSet, basename="quote-line")
router.register("shipments", ShipmentViewSet, basename="shipment")

router.register("supplier-price-lists", SupplierPriceListViewSet, basename="supplier-price-list")
router.register("price-list-lines", SupplierPriceListLineViewSet, basename="price-list-line")
router.register("item-supplier-mappings", ItemSupplierMappingViewSet, basename="item-supplier-mapping")

urlpatterns = [
    path("metrics-overview/", metrics_overview, name="metrics-overview"),
    path("supplier-map/preview/", supplier_map_preview, name="supplier-map-preview"),
    path("supplier-map/upsert/", supplier_map_upsert, name="supplier-map-upsert"),
    path("", include(router.urls)),
]

app_name = "procurement"
