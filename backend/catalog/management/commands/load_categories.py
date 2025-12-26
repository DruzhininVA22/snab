from django.core.management.base import BaseCommand
from django.db import transaction
from pathlib import Path
import json, re
from catalog.models import Category

def split_border(excludes: str):
    if not excludes:
        return '', ''
    txt = excludes.strip()
    m = re.search(r'(?:^|\s)Пограничное:\s*(.*)$', txt, flags=re.I)
    if m:
        notes = m.group(1).strip()
        excl = txt[:m.start()].strip().rstrip(' .;')
        return excl, notes
    return txt, ''

class Command(BaseCommand):
    help = "Загружает/обновляет дерево категорий (Hxx/Sxx) с подсказками и 'borderline' из JSON."

    def add_arguments(self, parser):
        parser.add_argument("--file", type=str, default="catalog/fixtures/categories_seed.json",
                            help="Путь к JSON с ключами families/leaves")

    @transaction.atomic
    def handle(self, *args, **opts):
        path = Path(opts["file"])
        if not path.exists():
            raise SystemExit(f"Файл не найден: {path}")
        data = json.loads(path.read_text(encoding="utf-8"))
        families = data.get("families") or []
        leaves = data.get("leaves") or []

        parents = {}
        for f in families:
            code = f["code"].strip()
            name = f["name"].strip()
            excludes = f.get("excludes", "")
            borderline = f.get("borderline", "")
            if not borderline and excludes and "Пограничное:" in excludes:
                excludes, borderline = split_border(excludes)

            obj, _ = Category.objects.update_or_create(
                code=code,
                defaults=dict(
                    name=name,
                    description=(f.get("description") or "").strip(),
                    includes=(f.get("includes") or "").strip(),
                    excludes=excludes.strip(),
                    borderline=borderline.strip(),
                    parent=None, is_leaf=False, level=1, path=code,
                )
            )
            parents[code] = obj

        for s in leaves:
            code = s["code"].strip()
            name = s["name"].strip()
            pcode = s["parent_code"].strip()
            p = parents.get(pcode)
            if not p:
                raise SystemExit(f"Не найдено семейство {pcode} для листа {code}")

            excludes = s.get("excludes", "")
            borderline = s.get("borderline", "")
            if not borderline and excludes and "Пограничное:" in excludes:
                excludes, borderline = split_border(excludes)

            Category.objects.update_or_create(
                code=code,
                defaults=dict(
                    name=name,
                    description=(s.get("description") or "").strip(),
                    includes=(s.get("includes") or "").strip(),
                    excludes=excludes.strip(),
                    borderline=borderline.strip(),
                    parent=p, is_leaf=True, level=2, path=f"{p.code}/{code}",
                )
            )
        self.stdout.write(self.style.SUCCESS(f"Категории загружены/обновлены: H={len(parents)} S={len(leaves)}"))
