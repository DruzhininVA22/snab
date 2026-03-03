"""
Тесты на compatibility-алиасы URL-ов, которые использует фронтенд как fallback.

Важно:
- эти маршруты НЕ меняют существующие контракты,
  а лишь предотвращают 404, если фронт пробует альтернативный URL.
- По умолчанию в SNAB включён IsAuthenticated (см. REST_FRAMEWORK),
  поэтому для большинства справочников требуется аутентификация.
"""

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from catalog.models import Category


class CompatRoutesTests(APITestCase):
    def setUp(self):
        # Минимальные данные, чтобы список не был пустым всегда
        self.root = Category.objects.create(name="Root", code="ROOT", parent=None)

        # В SNAB по умолчанию IsAuthenticated, поэтому тестируем как залогиненный пользователь
        User = get_user_model()
        self.user = User.objects.create_user(username="test", password="test12345")
        self.client.force_authenticate(user=self.user)

    def test_categories_aliases(self):
        for url in ("/api/categories/", "/api/core/categories/", "/api/catalog/categories/"):
            res = self.client.get(url)
            self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_catalog_units_alias(self):
        # Units в core разрешены AllowAny, но под auth тоже должны работать.
        res = self.client.get("/api/catalog/units/?page_size=1000")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
