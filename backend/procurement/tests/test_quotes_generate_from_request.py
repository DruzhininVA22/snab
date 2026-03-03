from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from core.models import Unit
from catalog.models import Category, Item
from projects.models import Project, ProjectStage
from suppliers.models import Supplier
from procurement.models import (
    PurchaseRequest, PurchaseRequestLine, Quote,
    SupplierPriceList, SupplierPriceListLine, ItemSupplierMapping,
)


class QuotesGenerateFromRequestTests(APITestCase):
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

    def test_generate_from_request_uses_mapping_fields(self):
        pl = SupplierPriceList.objects.create(
            supplier=self.supplier,
            name="AUTO_MAP",
            version="1",
            effective_date=date.today(),
            currency="RUB",
            is_active=True,
        )
        pll = SupplierPriceListLine.objects.create(
            price_list=pl,
            supplier_sku="SUP-1",
            description="Item from supplier",
            unit=self.unit,
            price=Decimal("5.00"),
            min_quantity=Decimal("1"),
            quantity_step=Decimal("1"),
            package_quantity=Decimal("1"),
            lead_time_days=7,
        )
        ItemSupplierMapping.objects.create(
            item=self.item,
            price_list_line=pll,
            conversion_factor=Decimal("1"),
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
        self.assertEqual(data.get("quotes_created"), 1)

        q = Quote.objects.order_by("-id").first()
        self.assertIsNotNone(q)
        self.assertEqual(q.lines.count(), 1)
        ln = q.lines.first()
        self.assertEqual(ln.vendor_sku, "SUP-1")
        self.assertEqual(str(ln.price), "5.00")
        self.assertEqual(ln.currency, "RUB")
        self.assertEqual(ln.lead_days, 7)
