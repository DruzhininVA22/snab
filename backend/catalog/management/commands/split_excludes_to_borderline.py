from django.core.management.base import BaseCommand
import re
from catalog.models import Category

class Command(BaseCommand):
    help = "Переносит часть из Category.excludes после 'Пограничное:' в Category.borderline (однократный запуск)."

    def handle(self, *args, **opts):
        moved = 0
        for c in Category.objects.all():
            excludes = (c.excludes or '').strip()
            if not excludes or (c.borderline or '').strip():
                continue
            m = re.search(r'(?:^|\s)Пограничное:\s*(.*)$', excludes, flags=re.I)
            if not m:
                continue
            c.borderline = m.group(1).strip()
            c.excludes = excludes[:m.start()].strip().rstrip(' .;')
            c.save(update_fields=['excludes', 'borderline'])
            moved += 1
        self.stdout.write(self.style.SUCCESS(f'Перенесено записей: {moved}'))
