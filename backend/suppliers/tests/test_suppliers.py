"""
Тесты для модуля suppliers.

Проверяем:
- создание поставщика (POST /api/suppliers/suppliers/),
- частичное обновление (PATCH /api/suppliers/suppliers/{id}/),
- фильтрацию/поиск (GET /api/suppliers/suppliers/?...).
"""

from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from suppliers.models import Supplier, SupplierContact, SupplierTerms


class SupplierAPITests(APITestCase):
    """
    Интеграционные тесты для SupplierViewSet.
    Базовый URL: /api/suppliers/suppliers/
    """

    def setUp(self):
        """
        Создаём пару поставщиков для тестов фильтрации/поиска.
        """
        self.supplier1 = Supplier.objects.create(
            name="ООО Альфа",
            inn="7700000001",
            activity="Металлопрокат",
            address="Москва",
            status="preferred",
            rating=5,
            is_active=True,
        )
        self.supplier2 = Supplier.objects.create(
            name="ООО Бета",
            inn="7800000002",
            activity="Сухие смеси",
            address="Санкт-Петербург",
            status="regular",
            rating=3,
            is_active=True,
        )

        # Условия для supplier1, чтобы проверить terms в деталке
        self.terms1 = SupplierTerms.objects.create(
            supplier=self.supplier1,
            payment_terms="Предоплата 50%",
            min_order_amount="от 100 000 ₽",
            lead_time_days=7,
            delivery_regions="Москва, МО",
            delivery_notes="Доставка собственным транспортом",
        )

        # Контакт для supplier1, чтобы проверить contacts в деталке
        self.contact1 = SupplierContact.objects.create(
            supplier=self.supplier1,
            person_name="Иван Иванов",
            position="Менеджер",
            phone="+7 900 000-00-01",
            email="ivanov@example.com",
            comment="Основной контакт",
        )

    def test_create_supplier(self):
        """
        Создание нового поставщика (POST).

        Ожидаем:
        - 200/201 (в зависимости от реализации create),
        - что поставщик создался с нужными полями,
        - что terms и contacts при создании пока не обрабатываются (делаем отдельно).
        """
        url = reverse("supplier-list")

        payload = {
            "name": "ООО Гамма",
            "inn": "7700000003",
            "activity": "Крепёж и метизы",
            "address": "Москва, ул. Строителей, 1",
            "status": "regular",
            "rating": 4,
            "is_active": True,
            "notes": "Новый поставщик по крепежу",
        }

        response = self.client.post(url, payload, format="json")
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))

        data = response.json()
        self.assertEqual(data["name"], "ООО Гамма")
        self.assertEqual(data["inn"], "7700000003")
        self.assertEqual(data["status"], "regular")
        self.assertEqual(data["rating"], 4)
        self.assertTrue(data["is_active"])

        # Проверяем, что в БД реально появился новый поставщик
        self.assertTrue(Supplier.objects.filter(name="ООО Гамма").exists())

    def test_partial_update_supplier(self):
        """
        Частичное обновление поставщика (PATCH).

        Проверяем:
        - смену статуса и рейтинга,
        - изменение основных полей (адрес, заметки).
        """
        url = reverse("supplier-detail", args=[self.supplier1.id])

        payload = {
            "status": "blocked",
            "rating": 1,
            "address": "Москва, ул. Новая, 10",
            "notes": "Проблемы с отгрузками, временно заблокирован",
        }

        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.supplier1.refresh_from_db()
        self.assertEqual(self.supplier1.status, "blocked")
        self.assertEqual(self.supplier1.rating, 1)
        self.assertEqual(self.supplier1.address, "Москва, ул. Новая, 10")
        self.assertEqual(
            self.supplier1.notes,
            "Проблемы с отгрузками, временно заблокирован",
        )

    def test_filter_and_search_suppliers(self):
        """
        Фильтрация и поиск поставщиков:

        - ?status=preferred — должен вернуть только supplier1,
        - ?search=Металлопрокат — должен найти supplier1 по activity.
        """
        url = reverse("supplier-list")

        # Фильтр по статусу
        resp_status = self.client.get(url, {"status": "preferred"})
        self.assertEqual(resp_status.status_code, status.HTTP_200_OK)

        data_status = resp_status.json()
        # поддерживаем оба варианта: с пагинацией (results) и без неё
        results_status = data_status.get("results", data_status)
        ids_status = {s["id"] for s in results_status}

        self.assertIn(self.supplier1.id, ids_status)
        self.assertNotIn(self.supplier2.id, ids_status)

        # Поиск по activity
        resp_search = self.client.get(url, {"search": "Металлопрокат"})
        self.assertEqual(resp_search.status_code, status.HTTP_200_OK)

        data_search = resp_search.json()
        results_search = data_search.get("results", data_search)
        ids_search = {s["id"] for s in results_search}

        self.assertIn(self.supplier1.id, ids_search)
        self.assertNotIn(self.supplier2.id, ids_search)

