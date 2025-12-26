"""
DRF сериализаторы приложения suppliers.

Сериализаторы делятся на «краткое» и «детальное» представление поставщика.
Поддерживают отображение категорий, контактов и условий.
"""

from rest_framework import serializers
from .models import Supplier, SupplierContact, SupplierTerms, SupplierPriceList


class SupplierContactSerializer(serializers.ModelSerializer):
    """
    SupplierContactSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: SupplierContact.
    Поля ответа/запроса:
    - id
    - person_name
    - position
    - phone
    - email
    - comment
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    class Meta:
        model = SupplierContact
        fields = ['id', 'person_name', 'position', 'phone', 'email', 'comment']


class SupplierTermsSerializer(serializers.ModelSerializer):
    """
    SupplierTermsSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: SupplierTerms.
    Поля ответа/запроса:
    - id
    - payment_terms
    - min_order_amount
    - lead_time_days
    - delivery_regions
    - delivery_notes
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    class Meta:
        model = SupplierTerms
        fields = ['id', 'payment_terms', 'min_order_amount', 'lead_time_days', 'delivery_regions', 'delivery_notes']


class SupplierListSerializer(serializers.ModelSerializer):
    """
    SupplierListSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: Supplier.
    Поля ответа/запроса:
    - id
    - name
    - inn
    - activity
    - status
    - rating
    - is_active
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    class Meta:
        model = Supplier
        fields = ['id', 'name', 'inn', 'activity', 'status', 'rating', 'is_active']


class SupplierDetailSerializer(serializers.ModelSerializer):
    """
    SupplierDetailSerializer — DRF сериализатор для обмена данными между frontend и backend.
    Модель: Supplier.
    Поля ответа/запроса:
    - id
    - name
    - inn
    - activity
    - address
    - status
    - rating
    - is_active
    - notes
    - contacts
    - … ещё 3 полей
    Содержит только данные; валидация/бизнес‑правила находятся на уровне моделей/вью.
    """

    contacts = SupplierContactSerializer(many=True, read_only=True)
    terms = SupplierTermsSerializer(read_only=True)
    
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'inn', 'activity', 'address', 'status', 'rating', 'is_active', 'notes', 'contacts', 'terms', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']