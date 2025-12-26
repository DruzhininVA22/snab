from django.contrib import admin
from . import models

def _get(obj, *names, default='—'):
    for n in names:
        if hasattr(obj, n):
            return getattr(obj, n)
    return default

# --- История цен ---
@admin.register(models.PriceRecord)
class PriceRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'item_display', 'supplier_display', 'price', 'currency', 'dt', 'pack_qty', 'lead_days')
    search_fields = ('item__name', 'item__sku', 'supplier__name')
    list_filter = ('currency', 'supplier')
    date_hierarchy = 'dt'
    ordering = ('-dt', '-id')

    @admin.display(description='Номенклатура')
    def item_display(self, obj):
        return _get(obj, 'item')

    @admin.display(description='Поставщик')
    def supplier_display(self, obj):
        return _get(obj, 'supplier')

# --- Заявки ---
@admin.register(models.PurchaseRequest)
class PurchaseRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'created_at', 'status', 'requester_display', 'comment_short')
    search_fields = ('comment',)
    ordering = ('-id',)

    def get_list_filter(self, request):
        flt = []
        if hasattr(models.PurchaseRequest, 'status'):
            flt.append('status')
        return flt

    @admin.display(description='Заявитель')
    def requester_display(self, obj):
        return _get(obj, 'requester', 'author', default='')

    @admin.display(description='Комментарий')
    def comment_short(self, obj):
        txt = _get(obj, 'comment', default='')
        return (txt[:80] + '…') if isinstance(txt, str) and len(txt) > 80 else txt

@admin.register(models.PurchaseRequestLine)
class PurchaseRequestLineAdmin(admin.ModelAdmin):
    list_display = ('id', 'pr_display', 'item_display', 'qty_display', 'deadline_display', 'status_display')
    search_fields = ('item__name', 'item__sku', 'purchase_request__comment')
    ordering = ('-id',)

    def get_list_filter(self, request):
        flt = []
        if hasattr(models.PurchaseRequestLine, 'status'):
            flt.append('status')
        return flt

    @admin.display(description='Заявка')
    def pr_display(self, obj):
        return _get(obj, 'purchase_request', 'request')

    @admin.display(description='Номенклатура')
    def item_display(self, obj):
        return _get(obj, 'item')

    @admin.display(description='Кол-во')
    def qty_display(self, obj):
        return _get(obj, 'qty', 'quantity', default='')

    @admin.display(description='Дедлайн')
    def deadline_display(self, obj):
        return _get(obj, 'deadline', 'need_by', default='')

    @admin.display(description='Статус')
    def status_display(self, obj):
        return _get(obj, 'status', default='')

# --- Заказы поставщикам ---
@admin.register(models.PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'number', 'supplier_display', 'status', 'eta_display', 'created_at')
    search_fields = ('number', 'supplier__name')
    ordering = ('-id',)

    def get_list_filter(self, request):
        flt = []
        if hasattr(models.PurchaseOrder, 'status'):
            flt.append('status')
        if hasattr(models.PurchaseOrder, 'supplier'):
            flt.append('supplier')
        return flt

    @admin.display(description='Поставщик')
    def supplier_display(self, obj):
        return _get(obj, 'supplier')

    @admin.display(description='ETA')
    def eta_display(self, obj):
        return _get(obj, 'eta', 'expected_date', default='')

@admin.register(models.PurchaseOrderLine)
class PurchaseOrderLineAdmin(admin.ModelAdmin):
    list_display = ('id', 'po_display', 'item_display', 'qty_display', 'price', 'status')
    search_fields = ('item__name', 'item__sku', 'purchase_order__number')
    ordering = ('-id',)

    def get_list_filter(self, request):
        return ['status'] if hasattr(models.PurchaseOrderLine, 'status') else []

    @admin.display(description='Заказ')
    def po_display(self, obj):
        return _get(obj, 'purchase_order', 'order')

    @admin.display(description='Номенклатура')
    def item_display(self, obj):
        return _get(obj, 'item')

    @admin.display(description='Кол-во')
    def qty_display(self, obj):
        return _get(obj, 'qty', 'quantity', default='')

# --- Коммерческие предложения (если есть модели) ---
if hasattr(models, 'Quote'):
    @admin.register(models.Quote)
    class QuoteAdmin(admin.ModelAdmin):
        list_display = ('id', 'supplier_display', 'dt_display', 'status_display')
        search_fields = ('supplier__name',)
        ordering = ('-id',)

        def get_list_filter(self, request):
            flt = []
            if hasattr(models.Quote, 'status'):
                flt.append('status')
            if hasattr(models.Quote, 'supplier'):
                flt.append('supplier')
            return flt

        @admin.display(description='Поставщик')
        def supplier_display(self, obj):
            return _get(obj, 'supplier')

        @admin.display(description='Дата')
        def dt_display(self, obj):
            return _get(obj, 'dt', 'created_at', default='')

        @admin.display(description='Статус')
        def status_display(self, obj):
            return _get(obj, 'status', default='')

if hasattr(models, 'QuoteLine'):
    @admin.register(models.QuoteLine)
    class QuoteLineAdmin(admin.ModelAdmin):
        list_display = ('id', 'quote_display', 'item_display', 'qty_display', 'price', 'currency_display')
        search_fields = ('item__name', 'item__sku', 'quote__id')
        ordering = ('-id',)

        @admin.display(description='КП')
        def quote_display(self, obj):
            return _get(obj, 'quote')

        @admin.display(description='Номенклатура')
        def item_display(self, obj):
            return _get(obj, 'item')

        @admin.display(description='Кол-во')
        def qty_display(self, obj):
            return _get(obj, 'qty', 'quantity', default='')

        @admin.display(description='Валюта')
        def currency_display(self, obj):
            return _get(obj, 'currency', default='')
