"""
БЛОК 2: Модели для управления прайс-листами поставщиков
=========================================================

Здесь описаны сущности процесса снабжения:
- PurchaseRequest, PurchaseRequestLine - заявки на закупку и их строки;
- Quote, QuoteLine (КП на основе заявки), запросы/предложения (котировки) от поставщиков;
- оформленные заказы и их строки;
- записи прайса (PriceRecord) как история цен и условий поставки.
- SupplierPriceList — метаданные прайс-листа поставщика
- SupplierPriceListLine — позиции (строки) в прайс-листе
- ItemSupplierMapping — сопоставление внутренней номенклатуры с артикулами поставщиков

Архитектура:
- SupplierPriceList версионируется (version поле)
- Каждая SupplierPriceListLine может быть связана через ItemSupplierMapping с Item'ом
- ItemSupplierMapping позволяет конвертировать единицы (conversion_factor)

Эти модели являются «сердцем» бизнес‑логики SNAB.
"""

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator, DecimalValidator
from decimal import Decimal
from datetime import date, timedelta

from core.models import Unit
from catalog.models import Item
from projects.models import Project, ProjectStage, Task
from suppliers.models import Supplier


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

class PurchaseOrder(models.Model):
    """Заказ поставщику"""
    number = models.CharField("№ заказа", max_length=64, unique=True)
    quote = models.ForeignKey(
        'Quote',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders',
        verbose_name='КП'
    )
    purchase_request = models.ForeignKey(
        'PurchaseRequest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders',
        verbose_name='Заявка'
    )

    # Снимок реквизитов (Проект/Этап) на уровне заказа.
    # Важен для стабильного отображения и отчётности, даже если заявка/этап менялись.
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="purchase_orders",
        verbose_name="Проект",
    )
    project_stage = models.ForeignKey(
        ProjectStage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_orders",
        verbose_name="Этап проекта",
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="purchase_orders",
        verbose_name="Поставщик"
    )
    status = models.CharField("Статус", max_length=20, default="draft")

    # Дедлайны/доставка
    deadline = models.DateField("Дедлайн", null=True, blank=True)
    planned_delivery_date = models.DateField("Плановая дата поставки", null=True, blank=True)
    delivery_address = models.TextField("Адрес доставки", blank=True, default="")
    sent_at = models.DateTimeField("Отправлен", null=True, blank=True)

    
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
    is_blocked = models.BooleanField("Заблокировано", default=False)

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
    is_blocked = models.BooleanField("Исключено из закупки", default=False)

    class Meta:
        verbose_name = "Строка КП"
        verbose_name_plural = "Строки КП"

    def __str__(self):
        return f"{self.quote.id}:{self.item.sku}"
    

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
    is_blocked = models.BooleanField("Исключено из закупки", default=False)

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


# ============================================================================
# 1. SupplierPriceList — Метаданные прайс-листа
# ============================================================================

class SupplierPriceList(models.Model):
    """
    Прайс-лист поставщика.
    
    Содержит метаданные о прайс-листе:
    - Поставщик
    - Версия и дата действия
    - Статус активности
    - Валюта
    
    Пример:
        Поставщик: ООО "Стройсервис"
        Версия: 1.0
        Дата начала: 2026-01-15
        Дата окончания: 2026-06-30
        Статус: Active (есть позиции)
        Валюта: RUB
    """
    
    # Основные поля
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='price_lists',
        help_text='Поставщик, владеющий этим прайс-листом'
    )
    
    name = models.CharField(
        max_length=255,
        help_text='Название прайс-листа. Примеры: "Прайс-лист Q4 2025", "Основной каталог"'
    )
    
    version = models.CharField(
        max_length=50,
        help_text='Версия прайс-листа. Примеры: "1.0", "1.1", "2.0"'
    )
    
    # Дата и период
    effective_date = models.DateField(
        help_text='Дата начала действия прайс-листа'
    )
    
    expiry_date = models.DateField(
        null=True,
        blank=True,
        help_text='Дата окончания действия. NULL = бессрочно'
    )
    
    # Валюта и статус
    CURRENCY_CHOICES = [
        ('RUB', 'Российский рубль'),
        ('USD', 'Доллар США'),
        ('EUR', 'Евро'),
        ('CNY', 'Китайский юань'),
    ]
    
    currency = models.CharField(
        max_length=3,
        choices=CURRENCY_CHOICES,
        default='RUB',
        help_text='Валюта цен в прайс-листе'
    )
    
    is_active = models.BooleanField(
        default=True,
        help_text='Активен ли прайс-лист (используется ли в системе)'
    )
    
    # Метаданные
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text='Когда был загружен/создан прайс-лист'
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text='Когда была последняя модификация'
    )
    
    # Дополнительная информация
    description = models.TextField(
        blank=True,
        null=True,
        help_text='Описание прайс-листа (комментарии, условия, примечания)'
    )
    
    class Meta:
        verbose_name = 'Прайс-лист поставщика'
        verbose_name_plural = 'Прайс-листы поставщиков'
        ordering = ['-effective_date', '-created_at']
        indexes = [
            models.Index(fields=['supplier', 'is_active']),
            models.Index(fields=['effective_date', 'expiry_date']),
        ]
        unique_together = [('supplier', 'version')]  # У одного поставщика не может быть две версии 1.0
    
    def __str__(self):
        return f'{self.supplier.name} — {self.name} v{self.version}'
    
    def is_valid_today(self):
        """Проверить, действителен ли прайс-лист сегодня"""
        today = date.today()
        return (
            self.effective_date <= today
            and (self.expiry_date is None or today <= self.expiry_date)
            and self.is_active
        )
    
    def days_until_expiry(self):
        """Сколько дней до окончания прайс-листа"""
        if self.expiry_date is None:
            return None
        return (self.expiry_date - date.today()).days


# ============================================================================
# 2. SupplierPriceListLine — Позиции в прайс-листе
# ============================================================================

class SupplierPriceListLine(models.Model):
    """
    Позиция (строка) в прайс-листе поставщика.
    
    Содержит информацию о конкретном товаре/услуге:
    - Артикул поставщика (SKU)
    - Описание
    - Цена
    - Единица измерения
    - Условия заказа (МОК, кратность, сроки)
    
    Пример:
        Прайс-лист: ООО "Стройсервис" v1.0
        SKU: KR-001
        Описание: Кирпич красный полнотелый
        Unit: штука
        Цена: 15.00 RUB
        МОК: 1000 шт
        Lead time: 14 дней
    
    Связь с Item (внутренняя номенклатура) идёт через ItemSupplierMapping.
    Это позволяет одному Item'у иметь несколько поставщиков.
    """
    
    # FK на прайс-лист
    price_list = models.ForeignKey(
        SupplierPriceList,
        on_delete=models.CASCADE,
        related_name='lines',
        help_text='Прайс-лист, содержащий эту позицию'
    )
    
    # Идентификация товара
    supplier_sku = models.CharField(
        max_length=100,
        help_text='Артикул/SKU товара в системе поставщика. Примеры: "KR-001", "CEM-500", "UNV-1234"'
    )
    
    description = models.TextField(
        help_text='Описание товара из прайс-листа. Может отличаться от Item.name'
    )
    
    # Единица измерения и цена
    unit = models.ForeignKey(
        Unit,
        on_delete=models.PROTECT,
        help_text='Единица измерения (шт, кг, м³, упак и т.д.)'
    )
    
    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Цена за 1 единицу (без НДС, если не указано иное)'
    )
    
    # Условия заказа
    min_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=1,
        validators=[MinValueValidator(Decimal('0.0001'))],
        help_text='Минимальный заказ (МОК). Может быть в любых единицах (шт, кг, м³)'
    )
    
    min_order_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text='Минимальная сумма заказа в валюте прайс-листа. 0 = нет ограничения'
    )
    
    quantity_step = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=1,
        validators=[MinValueValidator(Decimal('0.0001'))],
        help_text='Кратность заказа (lot step). Заказ должен быть кратен этому значению'
    )
    
    # Упаковка
    package_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=1,
        validators=[MinValueValidator(Decimal('0.0001'))],
        help_text='Количество товара в стандартной упаковке поставщика'
    )
    
    # Сроки
    lead_time_days = models.IntegerField(
        default=14,
        validators=[MinValueValidator(1)],
        help_text='Время доставки в рабочих днях'
    )
    
    # НДС
    vat_included = models.BooleanField(
        default=False,
        help_text='Включена ли цена цена цены НДС (если False - цена без НДС)'
    )
    
    vat_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=20,
        validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('100'))],
        help_text='Ставка НДС в процентах (обычно 20, 10, 0)'
    )
    
    # Доставка
    delivery_cost_fixed = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text='Фиксированная стоимость доставки (0 = нет или рассчитывается отдельно)'
    )
    
    delivery_cost_per_unit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text='Стоимость доставки за единицу товара'
    )
    
    # Доп. информация
    notes = models.TextField(
        blank=True,
        null=True,
        help_text='Примечания по позиции (ограничения, сертификаты и т.д.)'
    )
    
    is_available = models.BooleanField(
        default=True,
        help_text='Доступен ли товар для заказа'
    )
    
    # Метаданные
    created_at = models.DateTimeField(
        auto_now_add=True
    )
    
    updated_at = models.DateTimeField(
        auto_now=True
    )
    
    class Meta:
        verbose_name = 'Позиция прайс-листа'
        verbose_name_plural = 'Позиции прайс-листов'
        ordering = ['price_list', 'supplier_sku']
        indexes = [
            models.Index(fields=['price_list', 'is_available']),
            models.Index(fields=['supplier_sku']),
        ]
        unique_together = [('price_list', 'supplier_sku')]  # В одном прайс-листе артикул уникален
    
    def __str__(self):
        return f'{self.supplier_sku} — {self.description[:50]}'
    
    @property
    def effective_price(self):
        """Эффективная цена с учётом доставки и НДС"""
        price_with_delivery = self.price + (
            self.delivery_cost_fixed / self.min_quantity if self.min_quantity > 0 else 0
        ) + self.delivery_cost_per_unit
        
        if not self.vat_included:
            price_with_delivery *= (1 + self.vat_rate / 100)
        
        return price_with_delivery
    
    def calculate_total_for_quantity(self, quantity):
        """
        Рассчитать общую стоимость для заданного количества
        
        Args:
            quantity: количество (в единицах, соответствующих unit)
        
        Returns:
            dict: {'valid': bool, 'total': Decimal, 'error': str}
        """
        # Проверка МОК
        if quantity < self.min_quantity:
            return {
                'valid': False,
                'error': f'Минимальный заказ {self.min_quantity} {self.unit.name}'
            }
        
        # Проверка кратности
        if self.quantity_step > 1:
            remainder = quantity % self.quantity_step
            if remainder != 0:
                return {
                    'valid': False,
                    'error': f'Количество должно быть кратно {self.quantity_step}'
                }
        
        # Расчёт суммы
        total = quantity * self.effective_price
        
        # Проверка мин. суммы заказа
        if self.min_order_amount > 0 and total < self.min_order_amount:
            return {
                'valid': False,
                'error': f'Минимальная сумма заказа {self.min_order_amount} {self.price_list.currency}'
            }
        
        return {
            'valid': True,
            'total': total
        }


# ============================================================================
# 3. ItemSupplierMapping — Сопоставление номенклатуры
# ============================================================================

class ItemSupplierMapping(models.Model):
    """
    Сопоставление внутреннего Item'а (номенклатура) с позицией поставщика.
    
    Позволяет:
    1. Связать Item из нашего каталога с SKU поставщика
    2. Конвертировать единицы (если поставщик отпускает в упаковках, а нам нужны штуки)
    3. Отметить предпочитаемого поставщика
    4. Автоматически генерировать КП
    
    Пример:
        Item: "Кирпич красный полнотелый" (у нас хранится в штуках)
        Supplier 1 (ООО Стройсервис): SKU "KR-001", отпускает в штуках, коэф=1.0, preferred=True
        Supplier 2 (АО Терпимев): SKU "KR-A1", отпускает в упаковках по 500 шт, коэф=500, preferred=False
        Supplier 3 (ИП Иванов): SKU "BRICK-RED", отпускает в штуках, коэф=1.0, preferred=False
    
    При автогенерации КП система:
    1. Ищет все ItemSupplierMapping для нужного Item'а
    2. Находит SupplierPriceListLine для каждого Supplier'а
    3. Рассчитывает количество с учётом conversion_factor
    4. Создаёт QuoteLine в Quote'е
    """
    
    # Основные связи
    item = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name='supplier_mappings',
        help_text='Внутренний Item из каталога'
    )
    
    price_list_line = models.ForeignKey(
        SupplierPriceListLine,
        on_delete=models.CASCADE,
        related_name='item_mappings',
        help_text='Позиция в прайс-листе поставщика'
    )
    
    # Коэффициент преобразования единиц
    conversion_factor = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=1,
        validators=[MinValueValidator(Decimal('0.0001'))],
        help_text='''
        Коэффициент преобразования между единицами Item и SupplierPriceListLine.
        
        Примеры:
        - Item в шт, Supplier в шт: коэф = 1.0
        - Item в шт, Supplier в упаковках по 500 шт: коэф = 500.0
        - Item в м³, Supplier в м³: коэф = 1.0
        - Item в кг, Supplier в тоннах: коэф = 1000.0
        
        При заказе: supplier_qty = item_qty * conversion_factor
        '''
    )
    
    # Предпочтения
    is_preferred = models.BooleanField(
        default=False,
        help_text='Предпочитаемый поставщик для этого Item (используется при сортировке)'
    )
    
    # Минимальный заказ в единицах Item'а (override поля из PriceListLine)
    min_quantity_override = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.0001'))],
        help_text='Переопределить МОК из прайс-листа (в единицах Item). NULL = использовать из прайс-листа'
    )
    
    # Примечания
    notes = models.TextField(
        blank=True,
        null=True,
        help_text='Специальные условия для этого сопоставления'
    )
    
    # Статусы
    is_active = models.BooleanField(
        default=True,
        help_text='Активно ли это сопоставление'
    )
    
    # Метаданные
    created_at = models.DateTimeField(
        auto_now_add=True
    )
    
    updated_at = models.DateTimeField(
        auto_now=True
    )
    
    class Meta:
        verbose_name = 'Сопоставление Item/Поставщик'
        verbose_name_plural = 'Сопоставления Item/Поставщик'
        ordering = ['-is_preferred', 'price_list_line__price']
        indexes = [
            models.Index(fields=['item', 'is_active']),
            models.Index(fields=['price_list_line']),
        ]
        unique_together = [('item', 'price_list_line')]  # Item не может быть связан с одной позицией дважды
    
    def __str__(self):
        return f'{self.item.name} ← {self.price_list_line.supplier_sku} ({self.price_list_line.price_list.supplier.name})'
    
    @property
    def supplier(self):
        """Convenience property для получения поставщика"""
        return self.price_list_line.price_list.supplier
    
    def get_effective_min_quantity(self):
        """
        Получить минимальное количество для заказа в единицах Item'а
        
        Возвращает переопределённое значение или рассчитывает из прайс-листа
        """
        if self.min_quantity_override is not None:
            return self.min_quantity_override
        
        # Рассчитать из price_list_line в единицах item
        return self.price_list_line.min_quantity / self.conversion_factor
    
    def convert_item_qty_to_supplier_qty(self, item_quantity):
        """
        Конвертировать количество из единиц Item'а в единицы поставщика
        
        Args:
            item_quantity: количество в единицах Item'а
        
        Returns:
            Decimal: количество в единицах поставщика
        """
        return item_quantity * self.conversion_factor
    
    def convert_supplier_qty_to_item_qty(self, supplier_quantity):
        """
        Конвертировать количество из единиц поставщика в единицы Item'а
        
        Args:
            supplier_quantity: количество в единицах поставщика
        
        Returns:
            Decimal: количество в единицах Item'а
        """
        return supplier_quantity / self.conversion_factor

# --- Shipments split (deliveries) ---
from .models_shipments import Shipment, ShipmentLine  # noqa: E402,F401
