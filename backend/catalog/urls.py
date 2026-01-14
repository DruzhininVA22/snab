from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, ItemViewSet, category_tree


router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"items", ItemViewSet, basename="item")

urlpatterns = router.urls + [
    path("categories-tree/", category_tree, name="category-tree"),
]
