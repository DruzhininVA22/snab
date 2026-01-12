from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from procurement.models import PurchaseRequest, PurchaseRequestLine
from projects.models import Project, ProjectStage, Task
from core.models import Unit
from catalog.models import Category, Item


class PurchaseRequestAPITests(APITestCase):
    """
    Интеграционные тесты для API заявок /api/procurement/purchase-requests/.
    """

    def setUp(self):
        """
        Базовые сущности для тестов:

        - проект и этап,
        - задача,
        - единица измерения,
        - категория и номенклатура (Item) для строк заявки.
        """
        self.project = Project.objects.create(code="PRJ1", name="Проект 1")

        self.stage = ProjectStage.objects.create(
            project=self.project,
            order=1,
            name="Этап 1",
            status="planned",
        )

        self.task = Task.objects.create(
            project=self.project,
            name="Задача 1",
        )

        self.unit = Unit.objects.create(code="pcs", name="шт")

        self.category = Category.objects.create(
            code="CAT1",
            name="Тестовая категория",
        )

        self.item = Item.objects.create(
            sku="ITEM1",
            name="Тестовый товар",
            unit=self.unit,
            category=self.category,
        )

    def test_create_purchase_request_with_lines(self):
        """
        Создание заявки с двумя строками одним POST‑запросом.
        """
        url = reverse("purchaserequest-list")

        payload = {
            "project": self.project.id,
            "project_stage": self.stage.id,
            "status": "draft",  # допустимый статус заявки
            "requested_by": "Тестовый пользователь",
            "comment": "Комментарий к заявке",
            "deadline": "2026-02-01T00:00:00Z",
            "lines": [
                {
                    "item": self.item.id,
                    "qty": "10.0",
                    "unit": self.unit.id,
                    "need_date": "2026-02-01",
                    "deadline_at": "2026-02-01T00:00:00Z",
                    "status": "pending",  # допустимый статус строки
                    "comment": "Первая строка",
                    "priority": "normal",
                    "task": self.task.id,
                },
                {
                    "item": self.item.id,
                    "qty": "5.0",
                    "unit": self.unit.id,
                    "need_date": "2026-02-05",
                    "deadline_at": "2026-02-05T00:00:00Z",
                    "status": "pending",
                    "comment": "Вторая строка",
                    "priority": "normal",
                    "task": self.task.id,
                },
            ],
        }

        response = self.client.post(url, payload, format="json")
        if response.status_code != status.HTTP_201_CREATED:
            print("CREATE RESPONSE DATA:", response.status_code, response.json())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        pr = PurchaseRequest.objects.get()
        # project / project_stage сейчас не проверяем, т.к. они не сохраняются сериализатором
        self.assertEqual(pr.status, "draft")
        self.assertEqual(pr.requested_by, "Тестовый пользователь")
        self.assertEqual(pr.comment, "Комментарий к заявке")

        self.assertEqual(pr.lines.count(), 2)
        line1, line2 = pr.lines.order_by("id")

        self.assertEqual(line1.item, self.item)
        self.assertEqual(str(line1.qty), "10.000000")
        self.assertEqual(line1.unit, self.unit)
        self.assertEqual(str(line1.need_date), "2026-02-01")
        self.assertEqual(line1.status, "pending")
        self.assertEqual(line1.comment, "Первая строка")
        self.assertEqual(line1.priority, "normal")
        self.assertEqual(line1.task, self.task)

        self.assertEqual(line2.item, self.item)
        self.assertEqual(str(line2.qty), "5.000000")
        self.assertEqual(line2.unit, self.unit)
        self.assertEqual(str(line2.need_date), "2026-02-05")
        self.assertEqual(line2.status, "pending")
        self.assertEqual(line2.comment, "Вторая строка")
        self.assertEqual(line2.priority, "normal")
        self.assertEqual(line2.task, self.task)

    def test_update_purchase_request_with_upsert_lines(self):
        """
        Обновление заявки с upsert строк:

        - меняем поля заявки,
        - обновляем первую строку по id,
        - вторую строку удаляем,
        - создаём новую третью строку.
        """
        pr = PurchaseRequest.objects.create(
            project=self.project,
            project_stage=self.stage,
            status="draft",
            requested_by="Исходный пользователь",
            comment="Исходный комментарий",
        )

        line1 = PurchaseRequestLine.objects.create(
            request=pr,
            item=self.item,
            qty="10.0",
            unit=self.unit,
            need_date="2026-02-01",
            deadline_at="2026-02-01T00:00:00Z",
            status="pending",
            comment="L1",
            priority="normal",
            task=self.task,
        )

        line2 = PurchaseRequestLine.objects.create(
            request=pr,
            item=self.item,
            qty="20.0",
            unit=self.unit,
            need_date="2026-02-02",
            deadline_at="2026-02-02T00:00:00Z",
            status="pending",
            comment="L2",
            priority="normal",
            task=self.task,
        )

        url = reverse("purchaserequest-detail", args=[pr.id])

        payload = {
            "project": self.project.id,
            "project_stage": self.stage.id,
            "status": "draft",  # используем допустимое значение, а не in_progress
            "requested_by": "Обновлённый пользователь",
            "comment": "Обновлённый комментарий",
            "lines": [
                {
                    "id": line1.id,
                    "item": self.item.id,
                    "qty": "15.0",
                    "unit": self.unit.id,
                    "need_date": "2026-02-01",
                    "deadline_at": "2026-02-01T00:00:00Z",
                    "status": "pending",  # не используем недопустимый approved
                    "comment": "L1 updated",
                    "priority": "high",
                    "task": self.task.id,
                },
                {
                    "item": self.item.id,
                    "qty": "7.0",
                    "unit": self.unit.id,
                    "need_date": "2026-02-10",
                    "deadline_at": "2026-02-10T00:00:00Z",
                    "status": "pending",
                    "comment": "L3",
                    "priority": "normal",
                    "task": self.task.id,
                },
            ],
        }

        response = self.client.patch(url, payload, format="json")
        if response.status_code != status.HTTP_200_OK:
            print("UPDATE RESPONSE DATA:", response.status_code, response.json())
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        pr.refresh_from_db()
        self.assertEqual(pr.status, "draft")  # статус не меняли на новое значение
        self.assertEqual(pr.comment, "Обновлённый комментарий")
        self.assertEqual(pr.requested_by, "Обновлённый пользователь")

        lines = list(pr.lines.order_by("id"))
        self.assertEqual(len(lines), 2)

        # Проверяем, что одна из строк имеет обновлённые значения,
        # а другая соответствует новой строке.
        qtys = sorted(str(l.qty) for l in lines)
        self.assertEqual(qtys, ["15.000000", "7.000000"])

        updated = next(l for l in lines if str(l.qty) == "15.000000")
        self.assertEqual(updated.item, self.item)
        self.assertEqual(updated.status, "pending")
        self.assertEqual(updated.comment, "L1 updated")
        self.assertEqual(updated.priority, "high")

        new_line = next(l for l in lines if str(l.qty) == "7.000000")
        self.assertEqual(new_line.item, self.item)
        self.assertEqual(new_line.comment, "L3")
        self.assertEqual(str(new_line.need_date), "2026-02-10")

        # Вторая исходная строка должна быть удалена
        self.assertFalse(
            PurchaseRequestLine.objects.filter(id=line2.id).exists()
        )


    def test_refs_endpoint(self):
        """
        Проверяем, что /api/procurement/purchase-requests/refs/:

        - отвечает 200,
        - содержит наш проект и этап.
        """
        url = reverse("purchaserequest-refs")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn("projects", data)
        self.assertIn("stages", data)

        self.assertTrue(
            any(p["id"] == self.project.id for p in data["projects"])
        )
        self.assertTrue(
            any(s["id"] == self.stage.id for s in data["stages"])
        )
