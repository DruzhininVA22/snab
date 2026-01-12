from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, category_tree


router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="category")


urlpatterns = router.urls + [
    path("categories-tree/", category_tree, name="category-tree"),
]
