"""
Сериализаторы приложения core (DRF).

Определяют формат передачи справочников core через REST API.
"""

from rest_framework import serializers
from .models import Unit


class UnitSerializer(serializers.ModelSerializer):
    """
    UnitSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: Unit.
    Поля ответа/запроса:
    - id
    - code
    - name
    - description
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    class Meta:
        model = Unit
        fields = ['id', 'code', 'name', 'description']