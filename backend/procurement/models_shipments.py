from django.db import models


class Shipment(models.Model):
    """Поставка (партия) по заказу поставщику."""

    class Status(models.TextChoices):
        PLANNED = "planned", "Планируется"
        IN_TRANSIT = "in_transit", "В пути"
        DELIVERED = "delivered", "Доставлено"
        CANCELLED = "cancelled", "Отменено"

    order = models.ForeignKey(
        "procurement.PurchaseOrder",
        on_delete=models.CASCADE,
        related_name="shipments",
        verbose_name="Заказ поставщику",
    )

    number = models.CharField("№ доставки", max_length=64, blank=True, default="")
    status = models.CharField("Статус", max_length=20, choices=Status.choices, default=Status.PLANNED)

    eta_date = models.DateField("План. дата поставки", null=True, blank=True)
    delivered_at = models.DateField("Факт. дата поставки", null=True, blank=True)

    address = models.CharField("Адрес доставки", max_length=500, blank=True, default="")
    notes = models.TextField("Комментарий", blank=True, default="")

    created_at = models.DateTimeField("Создано", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлено", auto_now=True)

    class Meta:
        verbose_name = "Доставка"
        verbose_name_plural = "Доставки"
        ordering = ["-id"]

    def __str__(self) -> str:
        return self.number or f"SHIP#{self.pk}"

    def save(self, *args, **kwargs):
        creating = self.pk is None
        super().save(*args, **kwargs)
        if creating and not self.number:
            self.number = f"SH-{self.order.number}-{self.pk}"
            super().save(update_fields=["number"])


class ShipmentLine(models.Model):
    """Строка доставки (привязка к строке заказа с количеством)."""

    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name="lines",
        verbose_name="Доставка",
    )
    order_line = models.ForeignKey(
        "procurement.PurchaseOrderLine",
        on_delete=models.PROTECT,
        related_name="shipment_lines",
        verbose_name="Строка заказа",
    )
    qty = models.DecimalField("Количество", max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = "Строка доставки"
        verbose_name_plural = "Строки доставки"
        unique_together = [("shipment", "order_line")]

    def __str__(self) -> str:
        return f"{self.shipment.number}:{self.order_line_id}"
