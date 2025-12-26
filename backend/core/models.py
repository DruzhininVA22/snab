"""
Модели приложения core.

Здесь находятся базовые справочники, которые используются во всех остальных модулях SNAB.
На текущем этапе это, прежде всего, единицы измерения (Unit), которые используются в номенклатуре и закупках.
"""

from django.db import models
from django.utils import timezone

class Unit(models.Model):
    """Единицы измерения"""
    code = models.CharField("Код", max_length=16, unique=True)
    name = models.CharField("Наименование", max_length=128)
    description = models.TextField("Описание", blank=True, default="")
    
    created_at = models.DateTimeField("Создана", default=timezone.now)
    updated_at = models.DateTimeField("Обновлена", default=timezone.now)

    class Meta:
        verbose_name = "Единица измерения"
        verbose_name_plural = "Единицы измерения"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} ({self.name})"