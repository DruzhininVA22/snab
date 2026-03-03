from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0003_quote_block_and_po_links"),
    ]

    operations = [
        migrations.AddField(
            model_name="purchaseorder",
            name="deadline",
            field=models.DateField(blank=True, null=True, verbose_name="Дедлайн"),
        ),
    ]
