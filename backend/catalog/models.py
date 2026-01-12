"""
Модели приложения catalog (номенклатура).

Каталог — это центральный справочник материалов/позиций, которые могут быть запрошены и закуплены.
Содержит категории и элементы номенклатуры (Item) с артикулом (SKU) и единицей измерения.
"""

from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone


class Category(models.Model):
    """Иерархия категорий материалов (H/S система)"""
    code = models.CharField('Код', max_length=64, unique=True)
    name = models.CharField('Название', max_length=255)
    description = models.TextField('Описание', blank=True, default='')
    
    parent = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='children',
        verbose_name='Родительская категория'
    )
    
    # Hints для ручной коррекции границ
    includes = models.TextField('Входит', blank=True, default='', help_text='Строки, которые точно входят')
    excludes = models.TextField('Не входит', blank=True, default='', help_text='Строки, которые точно НЕ входят')
    borderline = models.TextField('Граница', blank=True, default='', help_text='Пограничные строки')
    
    # Техническое
    is_leaf = models.BooleanField('Листовая категория', default=True, db_index=True)
    level = models.PositiveIntegerField('Уровень иерархии', default=0, db_index=True)
    path = models.CharField('Путь', max_length=500, default='', blank=True, db_index=True)
    
    created_at = models.DateTimeField('Создана', default=timezone.now)
    updated_at = models.DateTimeField('Обновлена', auto_now=True)
    
    class Meta:
        verbose_name = 'Категория'
        verbose_name_plural = 'Категории'
        ordering = ['code', 'id']
        indexes = [
            models.Index(fields=['is_leaf', 'level']),
            models.Index(fields=['path']),
        ]
    
    def __str__(self):
        return f"{self.code} — {self.name}"
    
    def save(self, *args, **kwargs):
        if self.parent:
            self.is_leaf = False
            self.level = (self.parent.level or 0) + 1
            self.path = (self.parent.path or '') + self.code + '/'
        else:
            self.is_leaf = True
            self.level = 0
            self.path = self.code + '/'

        # Валидация: если есть дети — is_leaf = False.
        # self.children требует, чтобы у объекта уже был первичный ключ.
        if self.pk is not None and self.children.exists():
            self.is_leaf = False

        super().save(*args, **kwargs)

    
    def clean(self):
        if self.parent and self.parent.id == self.id:
            raise ValidationError('Категория не может быть родителем сама себе')
        if self.parent and self.parent.parent_id and self.id == self.parent.parent_id:
            raise ValidationError('Циклическая ссылка на категорию')



class Item(models.Model):
    """Номенклатура (единый реестр материалов)"""
    sku = models.CharField('Артикул', max_length=64, unique=True)
    name = models.CharField('Наименование', max_length=255)
    description = models.TextField('Описание', blank=True, default='')
    
    unit = models.ForeignKey(
        'core.Unit',
        on_delete=models.PROTECT,
        verbose_name='Единица измерения',
        related_name='items'
    )
    
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        verbose_name='Категория',
        limit_choices_to={'is_leaf': True},
        related_name='items'
    )
    
    created_at = models.DateTimeField('Создана', default=timezone.now)
    updated_at = models.DateTimeField('Обновлена', auto_now=True)
    
    class Meta:
        verbose_name = 'Номенклатура'
        verbose_name_plural = 'Номенклатура'
        ordering = ['sku']
        indexes = [
            models.Index(fields=['sku']),
            models.Index(fields=['category']),
        ]
    
    def __str__(self):
        return f"{self.sku} — {self.name}"