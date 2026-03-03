from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProjectViewSet, 
    ProjectStageViewSet, 
    ProjectListLiteView, 
    StageTemplateViewSet,
    StageTemplateLineViewSet,
)


router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='projects')
router.register(r'stages', ProjectStageViewSet, basename='project-stages')
router.register(r'projectstages', ProjectStageViewSet, basename='project-stages-nodash')
router.register(r'stage', ProjectStageViewSet, basename='project-stage-singular')

router.register(r'project-stages', ProjectStageViewSet, basename='project-stages-compat')
router.register(r"templates", StageTemplateViewSet, basename="stage-templates") 
router.register(r'template-lines', StageTemplateLineViewSet, basename='stage-template-lines') 

urlpatterns = [
    # Lite list for dropdowns
    path("", ProjectListLiteView.as_view(), name="projects-lite"),

    # COMPAT: frontend fallbacks (older UI variants)
    path("project/", ProjectListLiteView.as_view(), name="projects-lite-project"),
    path("list/", ProjectListLiteView.as_view(), name="projects-lite-list"),

    path("", include(router.urls)),
]