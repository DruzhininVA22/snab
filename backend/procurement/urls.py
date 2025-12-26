from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PriceRecordViewSet, PurchaseRequestViewSet, PurchaseRequestLineViewSet,
    PurchaseOrderViewSet, best_price, metrics_overview
)
from .views_import import import_price_excel
from .views_import_ext import import_invoice_preview


router = DefaultRouter()
router.register(r'pricerecords', PriceRecordViewSet, basename='pricerecord')
router.register(r'purchase-requests', PurchaseRequestViewSet, basename='purchase-request')
router.register(r'purchase-request-lines', PurchaseRequestLineViewSet, basename='purchase-request-line')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-order')


urlpatterns = [
    path('', include(router.urls)),
    path('best_price/', best_price, name='best-price'),
    path('metrics/overview/', metrics_overview, name='metrics-overview'),
    path('pricerecords/import_excel/', import_price_excel, name='pricerecord-import-excel'),
    path('invoices/import_preview/', import_invoice_preview, name='invoice-import-preview'),
]