"""
serializers.py — ФИНАЛЬНАЯ ВЕРСИЯ С ИСПРАВЛЕНИЕМ
Добавляем parent_id в ответ!
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
    - includes
    - excludes
    - borderline
    - parent
    - parent_id  ВАЖНО! Нужно для buildTree()
    - is_leaf
    - level
    - path
    """
    # ДОБАВЛЯЕМ parent_id как отдельное поле
    parent_id = serializers.IntegerField(source='parent.id', read_only=True, allow_null=True)
    
    class Meta:
        model = Category
        fields = ['id', 'code', 'name', 'description', 'includes', 'excludes', 'borderline', 'parent', 'parent_id', 'is_leaf', 'level', 'path']


class ItemSerializer(serializers.ModelSerializer):
    """
    ItemSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: Item.
    """
    unit_name = serializers.CharField(source='unit.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_code = serializers.CharField(source="category.code", read_only=True)

    class Meta:
        model = Item
        fields = ['id', 'sku', 'name', 'description', 'unit', 'unit_name', 'category', 'category_code','category_name', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class CategoryTreeSerializer(serializers.ModelSerializer):
    """Сериализатор с вложенными детьми"""
    children = serializers.SerializerMethodField()
    parent_id = serializers.IntegerField(source='parent.id', read_only=True, allow_null=True)

    class Meta:
        model = Category
        fields = ['id', 'code', 'name', 'description', 'includes', 'excludes', 'borderline', 'parent', 'parent_id', 'is_leaf', 'level', 'path', 'children']

    def get_children(self, obj):
        children = Category.objects.filter(parent_id=obj.id).order_by('path')
        return CategoryTreeSerializer(children, many=True, context=self.context).data
