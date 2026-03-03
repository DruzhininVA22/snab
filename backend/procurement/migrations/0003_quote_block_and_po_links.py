from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "migration_0002_block2"),
    ]

    operations = [
        migrations.AddField(
            model_name="purchaseorder",
            name="quote",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="purchase_orders",
                to="procurement.quote",
                verbose_name="КП",
            ),
        ),
        migrations.AddField(
            model_name="purchaseorder",
            name="purchase_request",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="purchase_orders",
                to="procurement.purchaserequest",
                verbose_name="Заявка",
            ),
        ),
        migrations.AddField(
            model_name="quoteline",
            name="is_blocked",
            field=models.BooleanField(default=False, verbose_name="Исключено из закупки"),
        ),
    ]
