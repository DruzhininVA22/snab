from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        # Допущение: у вас уже есть 0004_purchaseorder_deadline.
        # Если имя другое — замените на последнюю миграцию procurement.
        ("procurement", "0005_po_delivery_and_line_blocking"),
    ]

    operations = [
        migrations.CreateModel(
            name="Shipment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("number", models.CharField(blank=True, default="", max_length=64, verbose_name="№ доставки")),
                ("status", models.CharField(choices=[("planned", "Планируется"), ("in_transit", "В пути"), ("delivered", "Доставлено"), ("cancelled", "Отменено")], default="planned", max_length=20, verbose_name="Статус")),
                ("eta_date", models.DateField(blank=True, null=True, verbose_name="План. дата поставки")),
                ("delivered_at", models.DateField(blank=True, null=True, verbose_name="Факт. дата поставки")),
                ("address", models.CharField(blank=True, default="", max_length=500, verbose_name="Адрес доставки")),
                ("notes", models.TextField(blank=True, default="", verbose_name="Комментарий")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Создано")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Обновлено")),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="shipments", to="procurement.purchaseorder", verbose_name="Заказ поставщику")),
            ],
            options={"verbose_name": "Доставка", "verbose_name_plural": "Доставки", "ordering": ["-id"]},
        ),
        migrations.CreateModel(
            name="ShipmentLine",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("qty", models.DecimalField(decimal_places=2, max_digits=12, verbose_name="Количество")),
                ("order_line", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="shipment_lines", to="procurement.purchaseorderline", verbose_name="Строка заказа")),
                ("shipment", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lines", to="procurement.shipment", verbose_name="Доставка")),
            ],
            options={"verbose_name": "Строка доставки", "verbose_name_plural": "Строки доставки", "unique_together": {("shipment", "order_line")}},
        ),
    ]
