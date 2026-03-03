from django.core.management.base import BaseCommand
from catalog.models import Category


class Command(BaseCommand):
    help = "Rebuild catalog.Category tree fields: is_leaf, level, path (based on parent_id)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Don't write changes, only show what would be updated.",
        )

    def handle(self, *args, **options):
        dry_run = bool(options.get("dry_run"))

        rows = list(Category.objects.all().values("id", "code", "parent_id"))
        if not rows:
            self.stdout.write(self.style.WARNING("No categories found."))
            return

        by_id = {r["id"]: r for r in rows}
        children_map = {}
        for r in rows:
            pid = r["parent_id"]
            if pid not in children_map:
                children_map[pid] = []
            children_map[pid].append(r["id"])

        # roots: parent_id is None
        roots = children_map.get(None, [])
        if not roots:
            self.stdout.write(self.style.ERROR("No root categories (parent_id is NULL). Possible cycle/corrupt data."))
            return

        # deterministic order: by code, then id
        roots.sort(key=lambda cid: (by_id[cid]["code"], cid))
        for pid in list(children_map.keys()):
            if pid is None:
                continue
            children_map[pid].sort(key=lambda cid: (by_id[cid]["code"], cid))

        computed = {}
        visited = set()

        queue = []
        for rid in roots:
            queue.append((rid, 0, f"{by_id[rid]['code']}/"))

        while queue:
            cid, level, path = queue.pop(0)
            if cid in visited:
                continue
            visited.add(cid)

            child_ids = children_map.get(cid, [])
            is_leaf = len(child_ids) == 0

            computed[cid] = {"level": level, "path": path, "is_leaf": is_leaf}

            for ch_id in child_ids:
                ch_code = by_id[ch_id]["code"]
                queue.append((ch_id, level + 1, f"{path}{ch_code}/"))

        # Anything not visited is suspicious (cycles or disconnected nodes)
        missing = [cid for cid in by_id.keys() if cid not in visited]
        if missing:
            self.stdout.write(self.style.WARNING(
                f"Unreachable categories (cycle/disconnected?): {len(missing)} ids. Example: {missing[:10]}"
            ))

        # Apply updates
        objs = list(Category.objects.filter(id__in=computed.keys()))
        upd = 0
        for obj in objs:
            c = computed[obj.id]
            if (obj.level != c["level"]) or (obj.path != c["path"]) or (obj.is_leaf != c["is_leaf"]):
                obj.level = c["level"]
                obj.path = c["path"]
                obj.is_leaf = c["is_leaf"]
                upd += 1

        self.stdout.write(f"Categories total: {len(rows)}")
        self.stdout.write(f"Categories to update: {upd}")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run enabled: no changes written."))
            return

        if upd:
            Category.objects.bulk_update(objs, ["level", "path", "is_leaf"])
            self.stdout.write(self.style.SUCCESS("Rebuild completed."))
        else:
            self.stdout.write(self.style.SUCCESS("Nothing to update."))
