
from django.contrib import admin
from .models import Project, ProjectStage, Task


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "status")
    search_fields = ("code", "name")
    ordering = ("code",)


@admin.register(ProjectStage)
class ProjectStageAdmin(admin.ModelAdmin):
    list_display = ("project", "order", "name", "status", "planned_start", "planned_end")
    list_filter = ("project", "status")
    search_fields = ("name", "project__code", "project__name")


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("project", "stage", "code", "name", "start_planned", "finish_planned")
    list_filter = ("project", "stage")
    search_fields = ("code", "name", "project__code", "project__name")