from django.contrib import admin
from .models import Category, Item


class CategoryInline(admin.TabularInline):
    model = Category
    extra = 1


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "parent", "is_leaf", "level")
    list_filter = ("is_leaf", "level", "parent")
    search_fields = ("code", "name")
    readonly_fields = ("level", "path", "is_leaf")
    inlines = [CategoryInline]


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "unit", "category")
    list_filter = ("unit", "category")
    search_fields = ("sku", "name")
    readonly_fields = ("created_at", "updated_at")