"""
serializers.py — сериализаторы для модуля закупок (procurement).

Фокус:
- PriceRecord — чтение истории цен,
- PurchaseRequest — заявка на закупку,
- PurchaseRequestLine — строки заявки с nested‑созданием/редактированием.
"""

from rest_framework import serializers

from .models import (
    PriceRecord,
    PurchaseRequest,
    PurchaseRequestLine,
    PurchaseOrder,
    PurchaseOrderLine,
    Quote,
    QuoteLine,
)
from projects.models import Project, ProjectStage


# ============================================================
# PriceRecord — история цен (read‑only)
# ============================================================

class PriceRecordSerializer(serializers.ModelSerializer):
    """Read‑сериализатор для записей о ценах."""

    supplier_name = serializers.CharField(
        source="supplier.name", read_only=True, allow_null=True
    )
    item_name = serializers.CharField(
        source="item.name", read_only=True, allow_null=True
    )

    class Meta:
        model = PriceRecord
        fields = [
            "id",
            "dt",
            "supplier",
            "supplier_name",
            "item",
            "item_name",
            "price",
            "currency",
            "lead_days",
            "note",
            "pack_qty",
            "moq_qty",
            "lot_step",
        ]


# ============================================================
# Строки заявки — read
# ============================================================

class PurchaseRequestLineSerializer(serializers.ModelSerializer):
    """
    Read‑сериализатор строки заявки.

    Модель PurchaseRequestLine:
    - request: FK на заявку,
    - item: FK на Item,
    - qty: количество,
    - unit: FK на Unit,
    - need_date, deadline_at, status, comment, priority, task и т.п.
    """

    item_name = serializers.CharField(
        source="item.name", read_only=True, allow_null=True
    )
    unit_name = serializers.CharField(
        source="unit.name", read_only=True, allow_null=True
    )

    class Meta:
        model = PurchaseRequestLine
        fields = [
            "id",
            "request",
            "item",
            "item_name",
            "qty",
            "unit",
            "unit_name",
            "need_date",
            "deadline_at",
            "status",
            "comment",
            "priority",
            "task",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["request", "created_at", "updated_at"]


# ============================================================
# Заявка — read
# ============================================================

class PurchaseRequestSerializer(serializers.ModelSerializer):
    """Read‑сериализатор заявки на закупку."""

    lines = PurchaseRequestLineSerializer(many=True, read_only=True)

    project_id = serializers.IntegerField(source="project.id", read_only=True)
    project_stage_id = serializers.IntegerField(
        source="project_stage.id", read_only=True, allow_null=True
    )

    class Meta:
        model = PurchaseRequest
        fields = [
            "id",
            "project_id",
            "project_stage_id",
            "status",
            "requested_by",
            "comment",
            "deadline",
            "created_at",
            "updated_at",
            "lines",
        ]


# ============================================================
# Строки заявки — write (nested)
# ============================================================

class PurchaseRequestLineWriteSerializer(serializers.ModelSerializer):
    """
    Write‑сериализатор строки заявки.

    Поля для записи:
    - id (опционально, если строка уже существует),
    - item,
    - qty,
    - unit,
    - need_date,
    - deadline_at,
    - status,
    - comment,
    - priority,
    - task.
    """

    class Meta:
        model = PurchaseRequestLine
        fields = [
            "id",
            "item",
            "qty",
            "unit",
            "need_date",
            "deadline_at",
            "status",
            "comment",
            "priority",
            "task",
        ]


# ============================================================
# Заявка — write (nested)
# ============================================================

class PurchaseRequestWriteSerializer(serializers.ModelSerializer):
    """
    Write‑сериализатор заявки на закупку.

    Модель PurchaseRequest:
    - project, project_stage, status, requested_by, comment, deadline.

    Принимает:
    - project_id / project_stage_id,
    - status,
    - requested_by,
    - comment (или note, если фронт шлёт по старому),
    - deadline,
    - lines: массив строк заявки.

    Логика по lines:
    - если ключ "lines" есть:
        * строки с id -> обновляются;
        * без id -> создаются;
        * существующие строки, которых нет в payload -> удаляются.
    - если ключа "lines" нет:
        * строки остаются без изменений.
    """

    project_id = serializers.PrimaryKeyRelatedField(
        source="project",
        queryset=Project.objects.all(),
        required=False,
        allow_null=True,
    )
    project_stage_id = serializers.PrimaryKeyRelatedField(
        source="project_stage",
        queryset=ProjectStage.objects.all(),
        required=False,
        allow_null=True,
    )

    # Алиас note -> comment, чтобы сгладить возможный старый контракт
    note = serializers.CharField(write_only=True, required=False, allow_blank=True)

    lines = PurchaseRequestLineWriteSerializer(many=True, required=False)

    class Meta:
        model = PurchaseRequest
        fields = [
            "id",
            "project_id",
            "project_stage_id",
            "status",
            "requested_by",
            "comment",
            "note",
            "deadline",
            "lines",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        note = attrs.pop("note", None)
        if note is not None and not attrs.get("comment"):
            attrs["comment"] = note
        return attrs

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", None)
        pr = PurchaseRequest.objects.create(**validated_data)
        if lines_data is not None:
            self._upsert_lines(pr, lines_data)
        return pr

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lines_data is not None:
            self._upsert_lines(instance, lines_data)

        return instance

    def _upsert_lines(self, request_obj, lines_data):
        """
        Upsert + delete‑missing для строк заявки.
        """
        existing = {line.id: line for line in request_obj.lines.all()}
        seen_ids = set()

        for payload in lines_data:
            line_id = payload.get("id")
            if line_id and line_id in existing:
                line = existing[line_id]
                for attr, value in payload.items():
                    if attr == "id":
                        continue
                    setattr(line, attr, value)
                line.request = request_obj
                line.save()
                seen_ids.add(line_id)
            else:
                PurchaseRequestLine.objects.create(
                    request=request_obj,
                    **{k: v for k, v in payload.items() if k != "id"},
                )

        to_delete = [obj for pk, obj in existing.items() if pk not in seen_ids]
        if to_delete:
            PurchaseRequestLine.objects.filter(
                id__in=[obj.id for obj in to_delete]
            ).delete()
