from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Unit
from catalog.models import Category, Item
from suppliers.models import Supplier
from procurement.importers._resolver import resolve_item_id_by_supplier_context
from procurement.models import ItemSupplierMapping, SupplierPriceListLine


class SupplierMapStubTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="u", password="p")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.unit = Unit.objects.create(code="PCS", name="шт")
        self.cat = Category.objects.create(code="C1", name="Leaf", parent=None, is_leaf=True, level=0, path="C1")
        self.item = Item.objects.create(sku="SKU-001", name="Test Item", unit=self.unit, category=self.cat)
        self.supplier = Supplier.objects.create(name="ООО Поставщик")

    def test_upsert_creates_mapping_used_by_resolver(self):
        payload = {
            "rows": [
                {
                    "supplier": self.supplier.name,
                    "supplier_sku": "SUP-ABC",
                    "item_id": self.item.id,
                }
            ]
        }
        res = self.client.post("/api/procurement/supplier-map/upsert/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data.get("upserted"), 1)

        # mapping exists
        self.assertTrue(ItemSupplierMapping.objects.exists())
        self.assertTrue(SupplierPriceListLine.objects.filter(supplier_sku="SUP-ABC").exists())

        # resolver can now resolve supplier sku
        item_id, conf = resolve_item_id_by_supplier_context(self.supplier.name, "SUP-ABC")
        self.assertEqual(item_id, self.item.id)
        self.assertGreaterEqual(conf, 1.0)
