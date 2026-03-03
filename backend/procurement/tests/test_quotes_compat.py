from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from core.models import Unit
from catalog.models import Category, Item
from projects.models import Project, ProjectStage
from suppliers.models import Supplier
from procurement.models import PurchaseRequest, PurchaseRequestLine, Quote, QuoteLine, PurchaseOrder
from decimal import Decimal


class QuotesCompatAPITests(APITestCase):
    """Smoke-тесты совместимого API КП (quotes).

    Цель: чтобы фронт мог работать, даже если в модели Quote ещё нет status/notes.
    """

    def setUp(self):
        self.client = APIClient()
        User = get_user_model()
        self.user = User.objects.create_user(username="u", password="p")
        self.client.force_authenticate(user=self.user)

        self.unit = Unit.objects.create(code="pcs", name="шт")
        self.cat = Category.objects.create(code="C", name="Cat")
        self.item = Item.objects.create(sku="I1", name="Item", unit=self.unit, category=self.cat)

        self.project = Project.objects.create(code="P", name="Project")
        self.stage = ProjectStage.objects.create(project=self.project, order=1, name="S", status="planned")

        self.supplier = Supplier.objects.create(name="Supp")

        self.pr = PurchaseRequest.objects.create(project=self.project, project_stage=self.stage, status="draft")
        PurchaseRequestLine.objects.create(
            request=self.pr,
            item=self.item,
            qty="10.0",
            unit=self.unit,
            status="pending",
            priority="normal",
        )

        self.quote = Quote.objects.create(supplier=self.supplier, purchase_request=self.pr)
        QuoteLine.objects.create(
            quote=self.quote,
            item=self.item,
            vendor_sku="SUP-1",
            name="Item",
            unit=self.unit,
            price="5.0",
            currency="RUB",
            lead_days=7,
        )

    def test_quotes_list_has_compat_fields(self):
        res = self.client.get("/api/procurement/quotes/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        # list может быть либо списком, либо пагинацией
        items = data if isinstance(data, list) else data.get("results") or []
        self.assertTrue(items)
        q = items[0]
        self.assertIn("status", q)
        self.assertIn("total_price", q)
        self.assertIn("currency", q)
        self.assertIn("delivery_days", q)

        # total_price = 10 * 5
        self.assertEqual(Decimal(str(q["total_price"])), Decimal("50"))

    def test_quote_patch_status_is_persisted_via_cache(self):
        res = self.client.patch(f"/api/procurement/quotes/{self.quote.id}/", {"status": "reviewed"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json().get("status"), "reviewed")

        res2 = self.client.get(f"/api/procurement/quotes/{self.quote.id}/")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.json().get("status"), "reviewed")

    def test_create_po_uses_pr_qty(self):
        res = self.client.post(f"/api/procurement/quotes/{self.quote.id}/create_po/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        po = PurchaseOrder.objects.get(number=f"PO-{self.quote.id}")
        self.assertEqual(po.lines.count(), 1)
        ln = po.lines.first()
        self.assertEqual(str(ln.qty), "10.00")
        self.assertEqual(str(ln.price), "5.00")

def test_generate_from_request_creates_quotes_and_lines(self):
    """Generate-from-request не должен падать (500) и должен уметь работать с mapping."""
    from datetime import date
    from procurement.models import SupplierPriceList, SupplierPriceListLine, ItemSupplierMapping

    pl = SupplierPriceList.objects.create(
        supplier=self.supplier,
        name="AUTO",
        version="1.0",
        effective_date=date.today(),
        currency="RUB",
        is_active=True,
    )
    pll = SupplierPriceListLine.objects.create(
        price_list=pl,
        supplier_sku="SUP-1",
        description="Item from price",
        unit=self.unit,
        price="7.50",
        min_quantity="2",
        quantity_step="1",
        package_quantity="10",
        lead_time_days=5,
        is_available=True,
    )
    ItemSupplierMapping.objects.create(
        item=self.item,
        price_list_line=pll,
        conversion_factor="1",
        is_preferred=True,
        is_active=True,
    )

    res = self.client.post(
        "/api/procurement/quotes/generate-from-request/",
        {"purchase_request_id": self.pr.id, "supplier_ids": [self.supplier.id]},
        format="json",
    )
    self.assertEqual(res.status_code, status.HTTP_201_CREATED)
    data = res.json()
    self.assertTrue(data.get("ok"))

    q = Quote.objects.filter(supplier=self.supplier, purchase_request=self.pr).order_by("-id").first()
    self.assertIsNotNone(q)
    self.assertEqual(q.lines.count(), 1)
    ln = q.lines.first()
    # из прайса подтягиваем цену/lead_days и параметры заказа
    self.assertEqual(str(ln.price), "7.50")
    self.assertEqual(ln.lead_days, 5)
    self.assertEqual(str(ln.moq_qty), "2.0000")
    self.assertEqual(str(ln.pack_qty), "10.0000")
    self.assertEqual(str(ln.lot_step), "1.0000")
