
from django.contrib import admin
from django.shortcuts import render, redirect
from django.urls import path
from django import forms

from .models import Project, ProjectStage, Task, StageTemplate, StageTemplateLine

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

@admin.register(StageTemplate)
class StageTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_active")
    search_fields = ("name", "code")
    list_filter = ("is_active",)

@admin.register(StageTemplateLine)
class StageTemplateLineAdmin(admin.ModelAdmin):
    list_display = ("template", "order", "name", "default_duration_days", "default_offset_days")
    list_filter = ("template",)
    ordering = ("template", "order", "id")

class ApplyTemplateForm(forms.Form):
    template = forms.ModelChoiceField(
        queryset=StageTemplate.objects.filter(is_active=True).order_by("name"),
        label="Шаблон стадий",
    )
    replace = forms.BooleanField(
        required=False,
        initial=True,
        label="Удалить существующие стадии проекта",
    )
    renumber_from = forms.IntegerField(
        required=False,
        initial=1,
        label="Начальный номер этапа",
    )

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "status")
    search_fields = ("code", "name")
    ordering = ("code",)

    actions = ["apply_stage_template"]

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "apply-template/",
                self.admin_site.admin_view(self.apply_template_view),
                name="projects_project_apply_template",
            ),
        ]
        return custom + urls

    def apply_stage_template(self, request, queryset):
        """
        Action: выбрать проекты и применить к ним шаблон.
        """
        project_ids = ",".join(str(p.id) for p in queryset)
        return redirect(
            f"{request.path}apply-template/?ids={project_ids}"
        )

    apply_stage_template.short_description = "Назначить шаблон стадий"

    def apply_template_view(self, request):
        ids = request.GET.get("ids", "")
        project_ids = [int(x) for x in ids.split(",") if x.strip().isdigit()]
        projects = Project.objects.filter(id__in=project_ids)

        if not projects.exists():
            self.message_user(request, "Не выбрано ни одного проекта.")
            return redirect("admin:projects_project_changelist")

        if request.method == "POST":
            form = ApplyTemplateForm(request.POST)
            if form.is_valid():
                template = form.cleaned_data["template"]
                replace = form.cleaned_data["replace"]
                renumber_from = form.cleaned_data["renumber_from"] or 1

                lines = list(
                    template.lines.order_by("order", "id")
                )

                for project in projects:
                    if replace:
                        ProjectStage.objects.filter(project=project).delete()
                    order_base = renumber_from
                    for i, line in enumerate(lines, start=0):
                        ProjectStage.objects.create(
                            project=project,
                            order=order_base + i,
                            name=line.name,
                            status="planned",
                            # plannedstart / plannedend можно потом высчитывать по offset/duration
                        )

                self.message_user(
                    request,
                    f"Шаблон '{template.name}' применён к {projects.count()} проект(ам).",
                )
                return redirect("admin:projects_project_changelist")
        else:
            form = ApplyTemplateForm()

        context = dict(
            self.admin_site.each_context(request),
            title="Назначить шаблон стадий",
            form=form,
            projects=projects,
        )
        return render(request, "admin/projects/apply_template.html", context)