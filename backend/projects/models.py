"""
Модели приложения projects.

Проекты и этапы используются для привязки заявок на закупку к конкретному объекту строительства,
а также для контроля сроков и планирования работ.
"""

from django.db import models

class Project(models.Model):
    """Проекты"""
    class Status(models.TextChoices):
        PLANNED = "planned", "План"
        ACTIVE = "active", "В работе"
        PAUSED = "paused", "Пауза"
        DONE = "done", "Завершён"

    code = models.CharField("Код проекта", max_length=32, unique=True)
    name = models.CharField("Название проекта", max_length=255)
    status = models.CharField("Статус", max_length=20, choices=Status.choices, default=Status.PLANNED)
    description = models.TextField("Описание", blank=True, default="")
    
    template = models.ForeignKey(
        "projects.StageTemplate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='projects',
        verbose_name='Шаблон стадий',
    )

    start_date = models.DateField("Дата старта", null=True, blank=True)
    end_date = models.DateField("Дата окончания", null=True, blank=True)
    
    created_at = models.DateTimeField("Создан", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлён", auto_now=True)

    class Meta:
        verbose_name = "Проект"
        verbose_name_plural = "Проекты"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.code} — {self.name}"


class ProjectStage(models.Model):
    """Этапы проекта"""
    class Status(models.TextChoices):
        PLANNED = "planned", "План"
        IN_PROGRESS = "in_progress", "В работе"
        DONE = "done", "Готово"
        CANCELED = "canceled", "Отменён"

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="stages",
        verbose_name="Проект"
    )
    order = models.PositiveIntegerField("№", default=1)
    name = models.CharField("Название этапа", max_length=255)
    status = models.CharField("Статус", max_length=20, choices=Status.choices, default=Status.PLANNED)
    
    planned_start = models.DateField("План. старт", blank=True, null=True)
    planned_end = models.DateField("План. завершение", blank=True, null=True)
    
    created_at = models.DateTimeField("Создан", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлён", auto_now=True)

    class Meta:
        verbose_name = "Этап проекта"
        verbose_name_plural = "Этапы проекта"
        ordering = ["project", "order", "id"]
        unique_together = [["project", "order"]]

    def __str__(self):
        return f"{self.project.code}:{self.order} — {self.name}"


class Task(models.Model):
    """Задачи/подзадачи для отслеживания работ"""
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="tasks",
        verbose_name="Проект"
    )
    stage = models.ForeignKey(
        ProjectStage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
        verbose_name="Этап"
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subtasks",
        verbose_name="Родительская задача"
    )
    
    code = models.CharField("Код задачи", max_length=64)
    name = models.CharField("Наименование задачи", max_length=255)
    
    start_planned = models.DateField("План. старт", null=True, blank=True)
    finish_planned = models.DateField("План. финиш", null=True, blank=True)
    start_fact = models.DateField("Факт. старт", null=True, blank=True)
    finish_fact = models.DateField("Факт. финиш", null=True, blank=True)
    
    created_at = models.DateTimeField("Создана", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлена", auto_now=True)

    class Meta:
        verbose_name = "Задача/подзадача"
        verbose_name_plural = "Задачи/подзадачи"
        ordering = ["project__code", "code"]
        unique_together = [["project", "code"]]

    def __str__(self):
        return f"{self.project.code}:{self.code} — {self.name}"


class StageTemplate(models.Model):
    """Шаблоны этапов (архив, не реализовано)"""
    name = models.CharField("Название шаблона", max_length=200)
    code = models.CharField("Код", max_length=50, blank=True, null=True)
    is_active = models.BooleanField("Активен", default=True)
    description = models.TextField("Описание", blank=True, default="")

    created_at = models.DateTimeField("Создан", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлён", auto_now=True)

    class Meta:
        verbose_name = "Шаблон этапов"
        verbose_name_plural = "Шаблоны этапов"
        ordering = ("name", "id")

    def __str__(self):
        return f"{self.code or 'T'} — {self.name}"


class StageTemplateLine(models.Model):
    """Строки шаблона этапов (архив)"""
    template = models.ForeignKey(
        StageTemplate,
        on_delete=models.CASCADE,
        related_name="lines",
        verbose_name="Шаблон",
    )
    order = models.PositiveIntegerField("№", default=1)
    name = models.CharField("Название этапа", max_length=200)
    default_duration_days = models.PositiveIntegerField("Длительность, дни", blank=True, null=True)
    default_offset_days = models.IntegerField("Смещение старта от даты проекта, дни", blank=True, null=True)

    class Meta:
        verbose_name = "Этап в шаблоне"
        verbose_name_plural = "Этапы в шаблоне"
        ordering = ("order", "id")

    def __str__(self):
        return f"{self.order}. {self.name}"