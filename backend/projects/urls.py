from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, ProjectStageViewSet


router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='projects')
router.register(r'stages', ProjectStageViewSet, basename='project-stages')
router.register(r'project-stages', ProjectStageViewSet, basename='project-stages-compat')


urlpatterns = [
    path('', include(router.urls)),
]