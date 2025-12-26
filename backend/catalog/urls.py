from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet

# Поставщиков берём из core.views (там теперь живёт SupplierViewSet)
try:
    from core.views import SupplierViewSet  # noqa
except Exception:
    SupplierViewSet = None  # на случай, если core ещё не собран

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="category")

# Если хотим доступ к поставщикам под /api/catalog/suppliers/,
# регистрируем их здесь, но с уникальным basename, чтобы не конфликтовать
# с возможными /api/suppliers/ в других urls.
if SupplierViewSet is not None:
    router.register(r"suppliers", SupplierViewSet, basename="catalog-supplier")

urlpatterns = router.urls
