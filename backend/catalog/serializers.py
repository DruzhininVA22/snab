"""
DRF сериализаторы приложения catalog.

Определяют представления категорий и номенклатуры для API.
"""

from rest_framework import serializers
from .models import Category, Item


class CategorySerializer(serializers.ModelSerializer):
    """
    CategorySerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: Category.
    Поля ответа/запроса:
    - id
    - code
    - name
    - description
    - parent
    - is_leaf
    - level
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    class Meta:
        model = Category
        fields = ['id', 'code', 'name', 'description', 'parent', 'is_leaf', 'level']


class ItemSerializer(serializers.ModelSerializer):
    """
    ItemSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: Item.
    Поля ответа/запроса:
    - id
    - sku
    - name
    - description
    - unit
    - unit_name
    - category
    - category_name
    - created_at
    - updated_at
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    unit_name = serializers.CharField(source='unit.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = Item
        fields = ['id', 'sku', 'name', 'description', 'unit', 'unit_name', 'category', 'category_name', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']