from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, ProjectStageViewSet, ProjectListLiteView, StageTemplateViewSet


router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='projects')
router.register(r'stages', ProjectStageViewSet, basename='project-stages')
router.register(r'project-stages', ProjectStageViewSet, basename='project-stages-compat')
router.register(r"templates", StageTemplateViewSet, basename="stage-templates") 


urlpatterns = [
    path("", ProjectListLiteView.as_view(), name="projects-lite"),
    path("", include(router.urls)),
]