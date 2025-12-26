"""
DRF сериализаторы приложения projects.

Формируют списки/детальные карточки проектов и этапов для UI.
"""

from rest_framework import serializers
from .models import Project, ProjectStage, Task


class ProjectStageSerializer(serializers.ModelSerializer):
    """
    ProjectStageSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: ProjectStage.
    Поля ответа/запроса:
    - id
    - project
    - order
    - name
    - status
    - planned_start
    - planned_end
    - created_at
    - updated_at
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    class Meta:
        model = ProjectStage
        fields = ['id', 'project', 'order', 'name', 'status', 'planned_start', 'planned_end', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class TaskSerializer(serializers.ModelSerializer):
    """
    TaskSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: Task.
    Поля ответа/запроса:
    - id
    - project
    - stage
    - parent
    - code
    - name
    - start_planned
    - finish_planned
    - start_fact
    - finish_fact
    - … ещё 2 полей
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    class Meta:
        model = Task
        fields = ['id', 'project', 'stage', 'parent', 'code', 'name', 'start_planned', 'finish_planned', 'start_fact', 'finish_fact', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class ProjectListSerializer(serializers.ModelSerializer):
    """
    ProjectListSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: Project.
    Поля ответа/запроса:
    - id
    - code
    - name
    - status
    - start_date
    - end_date
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    class Meta:
        model = Project
        fields = ['id', 'code', 'name', 'status', 'start_date', 'end_date']


class ProjectDetailSerializer(serializers.ModelSerializer):
    """
    ProjectDetailSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: Project.
    Поля ответа/запроса:
    - id
    - code
    - name
    - status
    - description
    - start_date
    - end_date
    - stages
    - tasks
    - created_at
    - … ещё 1 полей
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    stages = ProjectStageSerializer(many=True, read_only=True)
    tasks = TaskSerializer(many=True, read_only=True)
    
    class Meta:
        model = Project
        fields = ['id', 'code', 'name', 'status', 'description', 'start_date', 'end_date', 'stages', 'tasks', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']