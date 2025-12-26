from django.core.management.base import BaseCommand
from core.models import Unit

class Command(BaseCommand):
    help = 'Seed basic units'
    def handle(self, *args, **kwargs):
        for code,name in [('PCS','Шт'),('M','Метр'),('KG','Килограмм'),('M3','Куб м')]:
            Unit.objects.get_or_create(code=code, defaults={'name':name})
        self.stdout.write(self.style.SUCCESS('Seeded units'))
