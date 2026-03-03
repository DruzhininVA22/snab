from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0002_project_template"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="delivery_address",
            field=models.TextField(blank=True, default="", verbose_name="Адрес доставки"),
        ),
    ]
