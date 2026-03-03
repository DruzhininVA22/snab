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
        """
        Правила:
        - `is_leaf=True` только у категорий без детей.
        - При создании/перемещении дочерней категории родитель автоматически становится `is_leaf=False`.
        - `level` и `path` вычисляются детерминированно по иерархии.
        - При изменении `code` или `parent` пересчитываем `path/level` для всей подветки.
        """

        old_parent_id = None
        old_code = None

        if self.pk:
            old = Category.objects.filter(pk=self.pk).values("parent_id", "code").first()
            if old:
                old_parent_id = old.get("parent_id")
                old_code = old.get("code")

        # Вычисляем parent данные безопасно (не полагаемся на загруженность self.parent)
        parent = None
        if self.parent_id:
            if getattr(self, "parent", None) is not None and self.parent.pk == self.parent_id:
                parent = self.parent
            else:
                parent = Category.objects.only("id", "level", "path").get(pk=self.parent_id)

            self.level = (parent.level or 0) + 1
            self.path = (parent.path or "") + self.code + "/"
        else:
            self.level = 0
            self.path = self.code + "/"

        # Листовая категория = нет детей
        self.is_leaf = True
        if self.pk and Category.objects.filter(parent_id=self.pk).exists():
            self.is_leaf = False

        super().save(*args, **kwargs)

        # Текущий родитель больше не лист
        if self.parent_id:
            Category.objects.filter(pk=self.parent_id, is_leaf=True).update(is_leaf=False)

        # Если переместили из одного родителя в другого — старый родитель мог стать листом
        if old_parent_id and old_parent_id != self.parent_id:
            if not Category.objects.filter(parent_id=old_parent_id).exists():
                Category.objects.filter(pk=old_parent_id).update(is_leaf=True)

        # Если изменили `code` или `parent` — надо пересчитать подветку
        if old_code is not None and (old_code != self.code or old_parent_id != self.parent_id):
            self._rebuild_subtree_paths_levels()

    def delete(self, *args, **kwargs):
        """При удалении категории может измениться `is_leaf` у родителя."""
        parent_id = self.parent_id
        super().delete(*args, **kwargs)
        if parent_id and not Category.objects.filter(parent_id=parent_id).exists():
            Category.objects.filter(pk=parent_id).update(is_leaf=True)

    def _rebuild_subtree_paths_levels(self):
        """
        Пересчитывает `path/level` для всех потомков, исходя из текущей `path/level` узла.
        Выполняется через queryset.update (без вызова save), чтобы избежать рекурсивных сайд‑эффектов.
        """
        queue = [(self.id, self.level, self.path)]
        visited = set()

        while queue:
            parent_id, parent_level, parent_path = queue.pop(0)
            if parent_id in visited:
                continue
            visited.add(parent_id)

            children = list(
                Category.objects.filter(parent_id=parent_id).values("id", "code")
            )

            for ch in children:
                ch_id = ch["id"]
                ch_code = ch["code"]

                new_level = parent_level + 1
                new_path = parent_path + ch_code + "/"

                Category.objects.filter(pk=ch_id).update(level=new_level, path=new_path)
                queue.append((ch_id, new_level, new_path))

        
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