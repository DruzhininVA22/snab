from django.contrib import admin
from .models import Warehouse, Stock

@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("code","name")
    search_fields = ("code","name")
    ordering = ("code",)

@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ("item","wh","qty")
    list_filter  = ("wh",)
    search_fields = ("item__sku","item__name")
