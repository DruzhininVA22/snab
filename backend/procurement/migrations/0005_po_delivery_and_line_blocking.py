from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0004_purchaseorder_deadline"),
    ]

    operations = [
        migrations.AddField(
            model_name="purchaseorder",
            name="planned_delivery_date",
            field=models.DateField(blank=True, null=True, verbose_name="Плановая дата поставки"),
        ),
        migrations.AddField(
            model_name="purchaseorder",
            name="delivery_address",
            field=models.TextField(blank=True, default="", verbose_name="Адрес доставки"),
        ),
        migrations.AddField(
            model_name="purchaseorder",
            name="sent_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="Отправлен"),
        ),
        migrations.AddField(
            model_name="purchaseorderline",
            name="is_blocked",
            field=models.BooleanField(default=False, verbose_name="Заблокировано"),
        ),
    ]
