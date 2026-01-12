"""
DRF сериализаторы приложения suppliers.

Задачи:
- отдать список поставщиков (кратко),
- отдать детальную карточку поставщика (со всеми контактами и условиями),
- принимать данные с форм создания/редактирования, включая категории, контакты и условия.
"""

from rest_framework import serializers

from .models import (
    Supplier,
    SupplierContact,
    SupplierTerms,
    SupplierPriceList,
)

# ============================================================
# Контакты поставщика
# ============================================================


class SupplierContactSerializer(serializers.ModelSerializer):
    """
    Сериализатор контакта поставщика.

    Модель: SupplierContact.

    Поля:
    - id
    - person_name
    - position
    - phone
    - email
    - comment
    """

    class Meta:
        model = SupplierContact
        fields = [
            "id",
            "person_name",
            "position",
            "phone",
            "email",
            "comment",
        ]


# ============================================================
# Условия поставки
# ============================================================


class SupplierTermsSerializer(serializers.ModelSerializer):
    """
    Сериализатор условий поставки.

    Модель: SupplierTerms.

    Поля:
    - id
    - payment_terms
    - min_order_amount
    - lead_time_days
    - delivery_regions
    - delivery_notes
    """

    class Meta:
        model = SupplierTerms
        fields = [
            "id",
            "payment_terms",
            "min_order_amount",
            "lead_time_days",
            "delivery_regions",
            "delivery_notes",
        ]


# ============================================================
# Список поставщиков (краткое представление)
# ============================================================


class SupplierListSerializer(serializers.ModelSerializer):
    """
    Краткое представление поставщика для списков (левая колонка).

    Модель: Supplier.

    Поля:
    - id
    - name
    - inn
    - activity
    - status
    - rating
    - is_active
    - categories_short (строка с кратким перечнем категорий)
    """

    categories_short = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "inn",
            "activity",
            "status",
            "rating",
            "is_active",
            "categories_short",
        ]

    def get_categories_short(self, obj):
        """
        Возвращает человекочитаемую строку категорий,
        например: "H07 Отделка, H01 Бетон".
        """
        cats = obj.categories.all()
        parts: list[str] = []
        for c in cats:
            code = getattr(c, "code", None)
            name = getattr(c, "name", None) or getattr(c, "title", None) or ""
            label = f"{code} {name}".strip() if code else name
            if label:
                parts.append(label)
        return ", ".join(parts)


# ============================================================
# Детальная карточка поставщика (read)
# ============================================================


class SupplierDetailSerializer(serializers.ModelSerializer):
    """
    Детальная карточка поставщика.

    Модель: Supplier.

    Поля:
    - id
    - name
    - inn
    - activity
    - address
    - status
    - rating
    - is_active
    - notes
    - categories (список id категорий)
    - categories_short (строка с перечнем категорий)
    - contacts (список SupplierContactSerializer)
    - terms (SupplierTermsSerializer)
    - pricelists (сводка по прайс-листам, при необходимости)
    - created_at
    - updated_at
    """

    contacts = SupplierContactSerializer(many=True, read_only=True)
    terms = SupplierTermsSerializer(read_only=True)
    categories_short = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "inn",
            "activity",
            "address",
            "status",
            "rating",
            "is_active",
            "notes",
            "categories",        # список id
            "categories_short",  # готовая строка для UI
            "contacts",
            "terms",
            "pricelists",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_categories_short(self, obj):
        """
        Возвращает строку категорий, например: "H07 Отделка, H01 Бетон".
        """
        cats = obj.categories.all()
        parts: list[str] = []
        for c in cats:
            code = getattr(c, "code", None)
            name = getattr(c, "name", None) or getattr(c, "title", None) or ""
            label = f"{code} {name}".strip() if code else name
            if label:
                parts.append(label)
        return ", ".join(parts)


# ============================================================
# Форма создания/редактирования поставщика (write)
# ============================================================


class SupplierWriteSerializer(serializers.ModelSerializer):
    """
    Сериализатор для форм создания/редактирования поставщика.

    Поддерживает:
    - базовые поля модели Supplier,
    - categories (ManyToMany через список id),
    - contacts (список вложенных объектов SupplierContact),
    - terms (один вложенный объект SupplierTerms).

    Используется во viewset’е для:
    - POST /api/suppliers/
    - PATCH /api/suppliers/{id}/
    """

    # Вложенные данные делаем write-only: читать их будем через SupplierDetailSerializer.
    contacts = SupplierContactSerializer(many=True, required=False, write_only=True)
    terms = SupplierTermsSerializer(required=False, write_only=True)

    class Meta:
        model = Supplier
        fields = [
            "name",
            "inn",
            "activity",
            "address",
            "status",
            "rating",
            "is_active",
            "notes",
            "categories",
            "contacts",
            "terms",
        ]

    def _save_contacts(self, supplier: Supplier, contacts_data: list[dict]) -> None:
        """
        Сохранение контактов поставщика.

        Стратегия упрощённая:
        - при каждом вызове полностью очищаем список контактов
          и создаём заново по переданным данным.
        Это проще всего синхронизируется с фронтом.
        """
        SupplierContact.objects.filter(supplier=supplier).delete()
        for c in contacts_data:
            SupplierContact.objects.create(
                supplier=supplier,
                person_name=c.get("person_name", "").strip(),
                position=c.get("position", ""),
                phone=c.get("phone", ""),
                email=c.get("email"),
                comment=c.get("comment", ""),
            )

    def _save_terms(self, supplier: Supplier, terms_data: dict) -> None:
        """
        Сохранение условий поставки/оплаты (OneToOne SupplierTerms).

        - если объект ещё не создан — создаём,
        - если есть — обновляем поля.
        """
        if not terms_data:
            return
        terms, _created = SupplierTerms.objects.get_or_create(supplier=supplier)
        terms.payment_terms = terms_data.get("payment_terms", terms.payment_terms)
        terms.min_order_amount = terms_data.get(
            "min_order_amount", terms.min_order_amount
        )
        terms.lead_time_days = terms_data.get("lead_time_days", terms.lead_time_days)
        terms.delivery_regions = terms_data.get(
            "delivery_regions", terms.delivery_regions
        )
        terms.delivery_notes = terms_data.get(
            "delivery_notes", terms.delivery_notes
        )
        terms.save()

    def create(self, validated_data):
        """
        Создание поставщика вместе с категориями, контактами и условиями.
        """
        contacts_data = validated_data.pop("contacts", [])
        terms_data = validated_data.pop("terms", None)
        categories = validated_data.pop("categories", [])

        supplier = Supplier.objects.create(**validated_data)

        if categories:
            supplier.categories.set(categories)
        if contacts_data:
            self._save_contacts(supplier, contacts_data)
        if terms_data:
            self._save_terms(supplier, terms_data)

        return supplier

    def update(self, instance, validated_data):
        """
        Обновление поставщика вместе с категориями, контактами и условиями.
        """
        contacts_data = validated_data.pop("contacts", None)
        terms_data = validated_data.pop("terms", None)
        categories = validated_data.pop("categories", None)

        # Обновляем базовые поля Supplier
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        # Категории: если пришли в payload — заменяем список
        if categories is not None:
            instance.categories.set(categories)

        # Контакты: если поле присутствует — заменяем все контакты
        if contacts_data is not None:
            self._save_contacts(instance, contacts_data)

        # Условия: если блок присутствует — создаём/обновляем
        if terms_data is not None:
            self._save_terms(instance, terms_data)

        return instance


# ============================================================
# Прайс‑листы (read‑only обвязка на будущее)
# ============================================================


class SupplierPriceListSummarySerializer(serializers.ModelSerializer):
    """
    Краткое представление прайс‑листа поставщика.

    Модель: SupplierPriceList.

    Поля:
    - id
    - supplier
    - title
    - valid_from
    - currency
    """

    class Meta:
        model = SupplierPriceList
        fields = [
            "id",
            "supplier",
            "title",
            "valid_from",
            "currency",
        ]


class SupplierPriceListDetailSerializer(serializers.ModelSerializer):
    """
    Детальное представление прайс‑листа (если пригодится во фронте).
    Пока оставляем для полноты, фронт может им не пользоваться.
    """

    class Meta:
        model = SupplierPriceList
        fields = [
            "id",
            "supplier",
            "title",
            "valid_from",
            "currency",
            "comment",
            "created_at",
        ]
        read_only_fields = ["created_at"]
