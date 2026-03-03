# backend/procurement/migrations/0003_block2_supplier_price_list.py
"""
Миграция для Блока 2: Модели управления прайс-листами поставщиков

Создаёт 3 новые таблицы:
1. SupplierPriceList — метаданные прайс-листов
2. SupplierPriceListLine — позиции в прайс-листах
3. ItemSupplierMapping — сопоставления Item ↔ SKU поставщика

Не удаляет существующие модели (PriceRecord, Quote и т.д.)
"""

from django.db import migrations, models
import django.db.models.deletion
import django.core.validators
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('procurement',  '0001_initial'),  
        ('suppliers', '0001_initial'),  
        ('catalog', '0001_initial'),    
        ('core', '0001_initial'),
    ]

    operations = [
        # ====================================================================
        # 1. SupplierPriceList
        # ====================================================================
        migrations.CreateModel(
            name='SupplierPriceList',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                
                ('name', models.CharField(
                    help_text='Название прайс-листа. Примеры: "Прайс-лист Q4 2025", "Основной каталог"',
                    max_length=255
                )),
                
                ('version', models.CharField(
                    help_text='Версия прайс-листа. Примеры: "1.0", "1.1", "2.0"',
                    max_length=50
                )),
                
                ('effective_date', models.DateField(
                    help_text='Дата начала действия прайс-листа'
                )),
                
                ('expiry_date', models.DateField(
                    blank=True,
                    null=True,
                    help_text='Дата окончания действия. NULL = бессрочно'
                )),
                
                ('currency', models.CharField(
                    choices=[('RUB', 'Российский рубль'), ('USD', 'Доллар США'), ('EUR', 'Евро'), ('CNY', 'Китайский юань')],
                    default='RUB',
                    help_text='Валюта цен в прайс-листе',
                    max_length=3
                )),
                
                ('is_active', models.BooleanField(
                    default=True,
                    help_text='Активен ли прайс-лист (используется ли в системе)'
                )),
                
                ('created_at', models.DateTimeField(
                    auto_now_add=True,
                    help_text='Когда был загружен/создан прайс-лист'
                )),
                
                ('updated_at', models.DateTimeField(
                    auto_now=True,
                    help_text='Когда была последняя модификация'
                )),
                
                ('description', models.TextField(
                    blank=True,
                    null=True,
                    help_text='Описание прайс-листа (комментарии, условия, примечания)'
                )),
                
                ('supplier', models.ForeignKey(
                    help_text='Поставщик, владеющий этим прайс-листом',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='price_lists',
                    to='suppliers.supplier'
                )),
            ],
            options={
                'verbose_name': 'Прайс-лист поставщика',
                'verbose_name_plural': 'Прайс-листы поставщиков',
                'ordering': ['-effective_date', '-created_at'],
            },
        ),
        
        # ====================================================================
        # 2. SupplierPriceListLine
        # ====================================================================
        migrations.CreateModel(
            name='SupplierPriceListLine',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                
                ('supplier_sku', models.CharField(
                    help_text='Артикул/SKU товара в системе поставщика. Примеры: "KR-001", "CEM-500", "UNV-1234"',
                    max_length=100
                )),
                
                ('description', models.TextField(
                    help_text='Описание товара из прайс-листа. Может отличаться от Item.name'
                )),
                
                ('price', models.DecimalField(
                    decimal_places=2,
                    help_text='Цена за 1 единицу (без НДС, если не указано иное)',
                    max_digits=12,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.01'))]
                )),
                
                ('min_quantity', models.DecimalField(
                    decimal_places=4,
                    default=1,
                    help_text='Минимальный заказ (МОК). Может быть в любых единицах (шт, кг, м³)',
                    max_digits=12,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.0001'))]
                )),
                
                ('min_order_amount', models.DecimalField(
                    decimal_places=2,
                    default=0,
                    help_text='Минимальная сумма заказа в валюте прайс-листа. 0 = нет ограничения',
                    max_digits=12,
                    validators=[django.core.validators.MinValueValidator(Decimal('0'))]
                )),
                
                ('quantity_step', models.DecimalField(
                    decimal_places=4,
                    default=1,
                    help_text='Кратность заказа (lot step). Заказ должен быть кратен этому значению',
                    max_digits=12,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.0001'))]
                )),
                
                ('package_quantity', models.DecimalField(
                    decimal_places=4,
                    default=1,
                    help_text='Количество товара в стандартной упаковке поставщика',
                    max_digits=12,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.0001'))]
                )),
                
                ('lead_time_days', models.IntegerField(
                    default=14,
                    help_text='Время доставки в рабочих днях',
                    validators=[django.core.validators.MinValueValidator(1)]
                )),
                
                ('vat_included', models.BooleanField(
                    default=False,
                    help_text='Включена ли цена цены НДС (если False - цена без НДС)'
                )),
                
                ('vat_rate', models.DecimalField(
                    decimal_places=2,
                    default=20,
                    help_text='Ставка НДС в процентах (обычно 20, 10, 0)',
                    max_digits=5,
                    validators=[
                        django.core.validators.MinValueValidator(Decimal('0')),
                        django.core.validators.MaxValueValidator(Decimal('100'))
                    ]
                )),
                
                ('delivery_cost_fixed', models.DecimalField(
                    decimal_places=2,
                    default=0,
                    help_text='Фиксированная стоимость доставки (0 = нет или рассчитывается отдельно)',
                    max_digits=12,
                    validators=[django.core.validators.MinValueValidator(Decimal('0'))]
                )),
                
                ('delivery_cost_per_unit', models.DecimalField(
                    decimal_places=2,
                    default=0,
                    help_text='Стоимость доставки за единицу товара',
                    max_digits=12,
                    validators=[django.core.validators.MinValueValidator(Decimal('0'))]
                )),
                
                ('notes', models.TextField(
                    blank=True,
                    null=True,
                    help_text='Примечания по позиции (ограничения, сертификаты и т.д.)'
                )),
                
                ('is_available', models.BooleanField(
                    default=True,
                    help_text='Доступен ли товар для заказа'
                )),
                
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                
                ('price_list', models.ForeignKey(
                    help_text='Прайс-лист, содержащий эту позицию',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='lines',
                    to='procurement.supplierpricelist'
                )),
                
                ('unit', models.ForeignKey(
                    help_text='Единица измерения (шт, кг, м³, упак и т.д.)',
                    on_delete=django.db.models.deletion.PROTECT,
                    to='core.unit'
                )),
            ],
            options={
                'verbose_name': 'Позиция прайс-листа',
                'verbose_name_plural': 'Позиции прайс-листов',
                'ordering': ['price_list', 'supplier_sku'],
            },
        ),
        
        # ====================================================================
        # 3. ItemSupplierMapping
        # ====================================================================
        migrations.CreateModel(
            name='ItemSupplierMapping',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                
                ('conversion_factor', models.DecimalField(
                    decimal_places=4,
                    default=1,
                    help_text='Коэффициент преобразования между единицами Item и SupplierPriceListLine',
                    max_digits=12,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.0001'))]
                )),
                
                ('is_preferred', models.BooleanField(
                    default=False,
                    help_text='Предпочитаемый поставщик для этого Item'
                )),
                
                ('min_quantity_override', models.DecimalField(
                    blank=True,
                    decimal_places=4,
                    help_text='Переопределить МОК из прайс-листа',
                    max_digits=12,
                    null=True,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.0001'))]
                )),
                
                ('notes', models.TextField(
                    blank=True,
                    null=True,
                    help_text='Специальные условия для этого сопоставления'
                )),
                
                ('is_active', models.BooleanField(
                    default=True,
                    help_text='Активно ли это сопоставление'
                )),
                
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                
                ('item', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='supplier_mappings',
                    to='catalog.item'
                )),
                
                ('price_list_line', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='item_mappings',
                    to='procurement.supplierpricelistline'
                )),
            ],
            options={
                'verbose_name': 'Сопоставление Item/Поставщик',
                'verbose_name_plural': 'Сопоставления Item/Поставщик',
                'ordering': ['-is_preferred', 'price_list_line__price'],
            },
        ),
        
        # ====================================================================
        # Индексы (для оптимизации запросов)
        # ====================================================================
        migrations.AddIndex(
            model_name='supplierpricelist',
            index=models.Index(fields=['supplier', 'is_active'], name='procurement_supplier_active_idx'),
        ),
        
        migrations.AddIndex(
            model_name='supplierpricelist',
            index=models.Index(fields=['effective_date', 'expiry_date'], name='procurement_effective_expiry_idx'),
        ),
        
        migrations.AddIndex(
            model_name='supplierpricelistline',
            index=models.Index(fields=['price_list', 'is_available'], name='procurement_pricelist_available_idx'),
        ),
        
        migrations.AddIndex(
            model_name='supplierpricelistline',
            index=models.Index(fields=['supplier_sku'], name='procurement_supplier_sku_idx'),
        ),
        
        migrations.AddIndex(
            model_name='itemsuppliermapping',
            index=models.Index(fields=['item', 'is_active'], name='procurement_item_active_idx'),
        ),
        
        migrations.AddIndex(
            model_name='itemsuppliermapping',
            index=models.Index(fields=['price_list_line'], name='procurement_pricelist_line_idx'),
        ),
        
        # ====================================================================
        # Ограничения уникальности (unique_together)
        # ====================================================================
        migrations.AlterUniqueTogether(
            name='supplierpricelist',
            unique_together={('supplier', 'version')},
        ),
        
        migrations.AlterUniqueTogether(
            name='supplierpricelistline',
            unique_together={('price_list', 'supplier_sku')},
        ),
        
        migrations.AlterUniqueTogether(
            name='itemsuppliermapping',
            unique_together={('item', 'price_list_line')},
        ),
    ]
