"""
Модели приложения procurement.

Здесь описаны сущности процесса снабжения:
- заявки на закупку и их строки;
- запросы/предложения (котировки) от поставщиков;
- оформленные заказы и их строки;
- записи прайса (PriceRecord) как история цен и условий поставки.

Эти модели являются «сердцем» бизнес‑логики SNAB.
"""

from django.db import models
from catalog.models import Item
from projects.models import Project, ProjectStage, Task
from suppliers.models import Supplier
from core.models import Unit

class RequestStatus(models.TextChoices):
    """
    RequestStatus — модель предметной области SNAB.
    Используется в API/бизнес‑логике соответствующего приложения.
    """

    DRAFT = "draft", "Черновик"
    OPEN = "open", "Открыта"
    CLOSED = "closed", "Закрыта"
    CANCELLED = "cancelled", "Отменена"

class LineStatus(models.TextChoices):
    """
    LineStatus — модель предметной области SNAB.
    Используется в API/бизнес‑логике соответствующего приложения.
    """

    PENDING = "pending", "Ожидание"
    PROCESSING = "processing", "В обработке"
    AWARDED = "awarded", "Выполнено"
    DELIVERED = "delivered", "Доставлено"


class PurchaseRequest(models.Model):
    """Заявка на закупку"""
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="purchase_requests",
        verbose_name="Проект"
    )
    project_stage = models.ForeignKey(
        ProjectStage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_requests",
        verbose_name="Этап проекта"
    )
    
    status = models.CharField(
        "Статус",
        max_length=20,
        choices=RequestStatus.choices,
        default=RequestStatus.DRAFT
    )
    
    requested_by = models.CharField("Кто создал", max_length=255, blank=True, default="")
    comment = models.TextField("Примечание", blank=True, default="", db_column="note")
    deadline = models.DateTimeField("Дедлайн", null=True, blank=True)
    
    created_at = models.DateTimeField("Создана", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлена", auto_now=True)

    class Meta:
        verbose_name = "Заявка на закупку"
        verbose_name_plural = "Заявки на закупку"
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["project"]),
            models.Index(fields=["deadline"]),
        ]

    def __str__(self):
        return f"PR#{self.id} ({self.get_status_display()})"


class PurchaseRequestLine(models.Model):
    """Строка заявки на закупку"""
    request = models.ForeignKey(
        PurchaseRequest,
        on_delete=models.CASCADE,
        related_name="lines",
        verbose_name="Заявка"
    )
    
    item = models.ForeignKey(
        Item,
        on_delete=models.PROTECT,
        verbose_name="Номенклатура"
    )
    
    qty = models.DecimalField(
        "Количество",
        max_digits=18,
        decimal_places=6,
        default=0
    )
    
    unit = models.ForeignKey(
        Unit,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Единица"
    )
    
    need_date = models.DateField("Необходимо к", null=True, blank=True)
    deadline_at = models.DateTimeField("Дедлайн", null=True, blank=True)
    
    status = models.CharField(
        "Статус",
        max_length=20,
        choices=LineStatus.choices,
        default=LineStatus.PENDING
    )
    
    comment = models.TextField("Комментарий", blank=True, default="")
    priority = models.CharField("Приоритет", max_length=20, blank=True, default="normal")
    
    task = models.ForeignKey(
        Task,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_lines",
        verbose_name="Задача"
    )
    
    created_at = models.DateTimeField("Создана", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлена", auto_now=True)

    class Meta:
        verbose_name = "Строка заявки"
        verbose_name_plural = "Строки заявки"
        ordering = ["request", "id"]
        indexes = [
            models.Index(fields=["request", "status"]),
            models.Index(fields=["item"]),
        ]

    def __str__(self):
        return f"{self.request_id}:{self.item.sku} x{self.qty}"


class PriceRecord(models.Model):
    """История цен"""
    item = models.ForeignKey(Item, on_delete=models.CASCADE, verbose_name="Номенклатура")
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, verbose_name="Поставщик")
    price = models.DecimalField("Цена", max_digits=12, decimal_places=2)
    currency = models.CharField("Валюта", max_length=10, default="RUB")
    dt = models.DateTimeField("Дата записи", auto_now_add=True)
    pack_qty = models.DecimalField("Кол-во в упаковке", max_digits=12, decimal_places=2, null=True, blank=True)
    lead_days = models.PositiveIntegerField("Срок поставки (дн.)", null=True, blank=True)
    moq_qty = models.DecimalField("МОЗ", max_digits=12, decimal_places=2, null=True, blank=True)
    lot_step = models.DecimalField("Шаг лота", max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        verbose_name = "История цены"
        verbose_name_plural = "История цен"
        ordering = ["-dt", "item__sku"]
        indexes = [
            models.Index(fields=["item", "-dt"]),
            models.Index(fields=["supplier", "-dt"]),
        ]

    def __str__(self):
        return f"{self.item.sku} @ {self.supplier.name}: {self.price}"


class PurchaseOrder(models.Model):
    """Заказ поставщику"""
    number = models.CharField("№ заказа", max_length=64, unique=True)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="purchase_orders",
        verbose_name="Поставщик"
    )
    status = models.CharField("Статус", max_length=20, default="draft")
    
    created_at = models.DateTimeField("Создан", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлён", auto_now=True)

    class Meta:
        verbose_name = "Заказ поставщику"
        verbose_name_plural = "Заказы поставщикам"
        ordering = ["-id"]

    def __str__(self):
        return f"PO#{self.number}"


class PurchaseOrderLine(models.Model):
    """Строка заказа"""
    order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="lines",
        verbose_name="Заказ"
    )
    item = models.ForeignKey(Item, on_delete=models.PROTECT, verbose_name="Номенклатура")
    qty = models.DecimalField("Количество", max_digits=12, decimal_places=2)
    price = models.DecimalField("Цена", max_digits=12, decimal_places=2)
    status = models.CharField("Статус", max_length=20, default="pending")

    class Meta:
        verbose_name = "Строка заказа"
        verbose_name_plural = "Строки заказа"

    def __str__(self):
        return f"{self.order.number}:{self.item.sku}"


class Quote(models.Model):
    """Коммерческое предложение (КП)"""
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="quotes",
        verbose_name="Поставщик"
    )
    purchase_request = models.ForeignKey(
        PurchaseRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quotes",
        verbose_name="Заявка"
    )
    file_path = models.CharField("Путь к файлу", max_length=500, blank=True, default="")
    source = models.CharField("Источник", max_length=255, blank=True, default="")
    created_at = models.DateTimeField("Создана", auto_now_add=True)

    class Meta:
        verbose_name = "КП"
        verbose_name_plural = "КП"
        ordering = ["-id"]

    def __str__(self):
        return f"Quote#{self.id} ({self.supplier.name})"


class QuoteLine(models.Model):
    """Строка КП"""
    quote = models.ForeignKey(
        Quote,
        on_delete=models.CASCADE,
        related_name="lines",
        verbose_name="КП"
    )
    item = models.ForeignKey(Item, on_delete=models.PROTECT, verbose_name="Номенклатура")
    vendor_sku = models.CharField("Артикул поставщика", max_length=255, blank=True, default="")
    name = models.CharField("Название", max_length=255, blank=True, default="")
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Единица")
    price = models.DecimalField("Цена", max_digits=12, decimal_places=2)
    currency = models.CharField("Валюта", max_length=10, default="RUB")
    lead_days = models.PositiveIntegerField("Срок поставки (дн.)", null=True, blank=True)
    moq_qty = models.DecimalField("МОЗ", max_digits=12, decimal_places=2, null=True, blank=True)
    pack_qty = models.DecimalField("Упаковка", max_digits=12, decimal_places=2, null=True, blank=True)
    lot_step = models.DecimalField("Шаг лота", max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        verbose_name = "Строка КП"
        verbose_name_plural = "Строки КП"

    def __str__(self):
        return f"{self.quote.id}:{self.item.sku}"