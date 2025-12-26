"""
Модели приложения suppliers (поставщики).

Справочник поставщиков хранит карточку контрагента, контакты, условия и прайс‑листы.
Используется закупочным контуром (procurement) и при импорте прайсов.
"""

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class Supplier(models.Model):
    """Поставщик (перемещено из core)"""
    STATUS_CHOICES = [
        ('preferred', 'Предпочитаемый'),
        ('regular', 'Обычный'),
        ('blocked', 'Блокирован'),
    ]

    name = models.CharField('Название поставщика', max_length=255)
    inn = models.CharField('ИНН / рег. номер', max_length=64, blank=True, null=True)
    activity = models.CharField('Основная деятельность', max_length=255, blank=True, default='')
    address = models.CharField('Адрес', max_length=500, blank=True, default='')
    is_active = models.BooleanField('Активен', default=True)

    rating = models.PositiveSmallIntegerField(
        'Рейтинг',
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(5)],
        help_text='0..5 (5 = лучший)'
    )

    status = models.CharField(
        'Статус допуска',
        max_length=20,
        choices=STATUS_CHOICES,
        default='regular',
    )

    notes = models.TextField('Заметки', blank=True, default='')

    categories = models.ManyToManyField(
        'catalog.Category',
        related_name='suppliers',
        verbose_name='Категории поставляемых материалов',
        blank=True,
    )

    created_at = models.DateTimeField('Создано', auto_now_add=True)
    updated_at = models.DateTimeField('Изменено', auto_now=True)

    class Meta:
        verbose_name = 'Поставщик'
        verbose_name_plural = 'Поставщики'
        ordering = ['name']

    def __str__(self):
        return self.name or f'Поставщик #{self.pk}'


class SupplierContact(models.Model):
    """Контакт поставщика"""
    supplier = models.ForeignKey(
        Supplier,
        related_name='contacts',
        on_delete=models.CASCADE,
        verbose_name='Поставщик',
    )
    person_name = models.CharField('Контактное лицо', max_length=255)
    position = models.CharField('Должность / Роль', max_length=255, blank=True, default='')
    phone = models.CharField('Телефон', max_length=64, blank=True, default='')
    email = models.EmailField('Email', blank=True, null=True)
    comment = models.CharField('Комментарий', max_length=500, blank=True, default='')

    class Meta:
        verbose_name = 'Контакт поставщика'
        verbose_name_plural = 'Контакты поставщика'
        ordering = ['person_name', 'id']

    def __str__(self):
        return f'{self.person_name} ({self.supplier.name})'


class SupplierTerms(models.Model):
    """Условия поставки"""
    supplier = models.OneToOneField(
        Supplier,
        related_name='terms',
        on_delete=models.CASCADE,
        verbose_name='Поставщик',
    )
    payment_terms = models.CharField('Условия оплаты', max_length=255, blank=True, default='')
    min_order_amount = models.CharField('Минимальный заказ', max_length=255, blank=True, default='')
    lead_time_days = models.PositiveIntegerField(
        'Типовой срок поставки (дн.)',
        blank=True,
        null=True,
    )
    delivery_regions = models.CharField('Регионы поставки', max_length=255, blank=True, default='')
    delivery_notes = models.TextField('Логистика / Доставка', blank=True, default='')

    class Meta:
        verbose_name = 'Условия поставщика'
        verbose_name_plural = 'Условия поставщиков'

    def __str__(self):
        return f'Условия {self.supplier.name}'


class SupplierPriceList(models.Model):
    """Прайс-лист поставщика"""
    supplier = models.ForeignKey(
        Supplier,
        related_name='pricelists',
        on_delete=models.CASCADE,
        verbose_name='Поставщик',
    )
    title = models.CharField('Название прайса', max_length=255)
    valid_from = models.DateField('Актуально с', blank=True, null=True)
    currency = models.CharField('Валюта', max_length=10, default='RUB')
    comment = models.TextField('Комментарий', blank=True, default='')
    created_at = models.DateTimeField('Создано', auto_now_add=True)

    class Meta:
        verbose_name = 'Прайс-лист поставщика'
        verbose_name_plural = 'Прайс-листы поставщиков'
        ordering = ['supplier', '-valid_from', '-created_at']

    def __str__(self):
        return f'{self.supplier.name} — {self.title}'


class SupplierPriceLine(models.Model):
    """Строка прайс-листа"""
    pricelist = models.ForeignKey(
        SupplierPriceList,
        related_name='lines',
        on_delete=models.CASCADE,
        verbose_name='Прайс-лист',
    )

    item = models.ForeignKey(
        'catalog.Item',
        on_delete=models.PROTECT,
        verbose_name='Номенклатура'
    )

    supplier_sku = models.CharField('Артикул поставщика', max_length=255, blank=True, default='')

    unit = models.ForeignKey(
        'core.Unit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Единица',
    )

    price = models.DecimalField('Цена', max_digits=12, decimal_places=2)
    notes = models.CharField('Комментарий', max_length=500, blank=True, default='')

    class Meta:
        verbose_name = 'Строка прайса поставщика'
        verbose_name_plural = 'Строки прайса поставщика'
        ordering = ['pricelist', 'item']

    def __str__(self):
        return f'{self.item.sku} @ {self.price}'