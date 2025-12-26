from django.contrib import admin
from .models import Supplier, SupplierContact, SupplierTerms, SupplierPriceList, SupplierPriceLine



class SupplierContactInline(admin.TabularInline):
    model = SupplierContact
    extra = 1



class SupplierTermsInline(admin.StackedInline):
    model = SupplierTerms
    extra = 0



class SupplierPriceListInline(admin.TabularInline):
    model = SupplierPriceList
    extra = 1



@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "inn", "status", "rating", "is_active")
    list_filter = ("is_active", "status", "rating")
    search_fields = ("name", "inn", "activity")
    inlines = [SupplierContactInline, SupplierTermsInline, SupplierPriceListInline]



@admin.register(SupplierContact)
class SupplierContactAdmin(admin.ModelAdmin):
    list_display = ("person_name", "position", "phone", "email", "supplier")
    list_filter = ("supplier",)
    search_fields = ("person_name", "phone", "email")



@admin.register(SupplierTerms)
class SupplierTermsAdmin(admin.ModelAdmin):
    list_display = ("supplier", "payment_terms", "lead_time_days")
    search_fields = ("supplier__name",)



@admin.register(SupplierPriceList)
class SupplierPriceListAdmin(admin.ModelAdmin):
    list_display = ("supplier", "title", "valid_from", "currency")
    list_filter = ("supplier", "currency", "valid_from")
    search_fields = ("supplier__name", "title")



@admin.register(SupplierPriceLine)
class SupplierPriceLineAdmin(admin.ModelAdmin):
    list_display = ("pricelist", "item", "supplier_sku", "price")
    list_filter = ("pricelist__supplier",)
    search_fields = ("item__sku", "supplier_sku")