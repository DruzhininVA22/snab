"""
Модели приложения warehouse.

На текущем этапе складской контур представлен минимально:
- склад (Warehouse);
- остатки (Stock) по номенклатуре.

Раздел развивается по мере необходимости (приемка/резервирование/списания).
"""

from django.db import models
from django.utils.translation import gettext_lazy as _
from catalog.models import Item


class Warehouse(models.Model):
    """
    Warehouse — модель предметной области SNAB.
    Основные поля:
    - code: CharField
    - name: CharField
    Используется в API/бизнес‑логике соответствующего приложения.
    """

    code = models.CharField(_("Код склада"), max_length=16, unique=True)
    name = models.CharField(_("Название склада"), max_length=128)

    class Meta:
        verbose_name = _("Склад")
        verbose_name_plural = _("Склады")
        ordering = ("code",)

    def __str__(self):
        return self.code


class Stock(models.Model):
    """
    Stock — модель предметной области SNAB.
    Основные поля:
    - qty: DecimalField
    Связи:
    - item: ForeignKey → Item
    - wh: ForeignKey → Warehouse
    Используется в API/бизнес‑логике соответствующего приложения.
    """

    item = models.ForeignKey(Item, on_delete=models.CASCADE, verbose_name=_("Номенклатура"))
    wh = models.ForeignKey(Warehouse, on_delete=models.CASCADE, verbose_name=_("Склад"))
    qty = models.DecimalField(_("Количество"), max_digits=14, decimal_places=3, default=0)

    class Meta:
        verbose_name = _("Остаток")
        verbose_name_plural = _("Остатки")
        unique_together = ("item", "wh")

    def __str__(self):
        return f"{self.wh} — {self.item} = {self.qty}"