from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from django.apps import apps
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


THRESHOLD_DAYS = 3

DONE_STATUSES = {
    "pr": {"closed", "cancelled", "canceled", "done"},
    "quote": {"rejected", "closed", "cancelled", "canceled"},
    "po": {"closed", "cancelled", "canceled"},
    "shipment": {"delivered", "closed", "cancelled", "canceled"},
}

DEADLINE_FIELDS = {
    "pr": ["deadline", "deadline_at", "due_date", "required_by", "needed_by", "need_by", "target_date"],
    "quote": ["deadline", "deadline_at", "valid_until", "due_date", "target_date"],
    "po": ["expected_delivery_date", "delivery_date", "eta", "eta_date", "due_date", "target_date"],
    "shipment": ["eta", "eta_date", "delivery_date", "delivered_at", "due_date", "target_date"],
}


def _norm(s: Any) -> str:
    return str(s or "").strip()


def _to_iso(d: Any) -> Optional[str]:
    if d is None:
        return None
    if isinstance(d, datetime):
        return d.isoformat()
    if isinstance(d, date):
        return d.isoformat()
    s = _norm(d)
    return s or None


def _safe_model(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except Exception:
        return None


def _get_deadline_iso(obj: Any, kind: str) -> Optional[str]:
    for f in DEADLINE_FIELDS.get(kind, []):
        if hasattr(obj, f):
            iso = _to_iso(getattr(obj, f, None))
            if iso:
                return iso

    meta = getattr(obj, "meta", None) or getattr(obj, "metadata", None)
    if isinstance(meta, dict):
        for f in DEADLINE_FIELDS.get(kind, []):
            iso = _to_iso(meta.get(f))
            if iso:
                return iso

    return None


def _calc_severity(deadline_iso: Optional[str]) -> Tuple[str, Optional[int]]:
    if not deadline_iso:
        return "ok", None

    dt: Optional[datetime] = None
    try:
        dt = datetime.fromisoformat(deadline_iso.replace("Z", "+00:00"))
    except Exception:
        try:
            dt = datetime.strptime(deadline_iso[:10], "%Y-%m-%d")
            dt = timezone.make_aware(dt)
        except Exception:
            dt = None

    if dt is None:
        return "ok", None

    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt)

    # Calendar days: simple and predictable for users.
    # IMPORTANT: compare *dates*, not datetimes, otherwise the UI will show off-by-one near midnight
    # (e.g. deadline == today might become -1 when deadline stored as 00:00 and "now" is later).
    today = timezone.localdate()
    deadline_date = timezone.localdate(dt)

    days_left = (deadline_date - today).days
    if days_left < 0:
        return "overdue", days_left
    if days_left <= THRESHOLD_DAYS:
        return "due_soon", days_left
    return "ok", days_left


def _status(obj: Any) -> str:
    return _norm(getattr(obj, "status", "") or getattr(obj, "state", "")) or "—"


def _title(kind: str, obj: Any) -> str:
    oid = getattr(obj, "id", None)
    if kind == "pr":
        return _norm(getattr(obj, "title", "") or getattr(obj, "name", "") or getattr(obj, "number", "") or f"Заявка #{oid}")
    if kind == "quote":
        return _norm(getattr(obj, "supplier_name", "") or f"КП #{oid}")
    if kind == "po":
        return _norm(getattr(obj, "number", "") or f"PO #{oid}")
    if kind == "shipment":
        return _norm(getattr(obj, "number", "") or f"Доставка #{oid}")
    return f"#{oid}"


def _party_for_pr(pr: Any) -> str:
    parts: List[str] = []

    proj = getattr(pr, "project", None)
    if proj is not None and hasattr(proj, "_meta"):
        code = _norm(getattr(proj, "code", ""))
        name = _norm(getattr(proj, "name", ""))
        if code and name:
            parts.append(f"{code} — {name}")
        elif name:
            parts.append(name)
    else:
        pid = getattr(pr, "project_id", None) or getattr(pr, "project", None)
        if pid:
            parts.append(f"Проект #{pid}")

    st = getattr(pr, "project_stage", None) or getattr(pr, "stage", None)
    if st is not None and hasattr(st, "_meta"):
        sname = _norm(getattr(st, "name", ""))
        if sname:
            parts.append(sname)
    else:
        sid = getattr(pr, "project_stage_id", None) or getattr(pr, "stage_id", None)
        if sid:
            parts.append(f"Этап #{sid}")

    return " / ".join([p for p in parts if p]) or ""


def _party(kind: str, obj: Any) -> str:
    if kind == "pr":
        return _party_for_pr(obj)
    if kind in ("quote", "po"):
        return _norm(getattr(obj, "supplier_name", "") or getattr(obj, "supplier", ""))
    if kind == "shipment":
        return _norm(getattr(obj, "supplier_name", "") or getattr(obj, "supplier", "") or getattr(obj, "carrier", ""))
    return ""


def _frontend_url(kind: str, oid: int) -> str:
    if kind == "pr":
        return f"/pr/{oid}/edit"
    if kind == "quote":
        return f"/quotes?quote_id={oid}"
    if kind == "po":
        return "/purchase-orders"
    if kind == "shipment":
        return "/shipments"
    return "/"


def _iter_rows(kind: str, qs, include_done: bool = False) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for obj in qs[:200]:
        oid = getattr(obj, "id", None)
        if not oid:
            continue

        st = _status(obj).lower()
        if (not include_done) and st in DONE_STATUSES.get(kind, set()):
            continue

        deadline_iso = _get_deadline_iso(obj, kind)
        severity, days_left = _calc_severity(deadline_iso)

        out.append(
            {
                "type": kind,
                "id": int(oid),
                "title": _title(kind, obj),
                "party": _party(kind, obj),
                "status": _status(obj),
                "deadlineIso": deadline_iso,
                "daysLeft": days_left,
                "severity": severity,
                "frontend_url": _frontend_url(kind, int(oid)),
            }
        )

    def rank(sev: str) -> int:
        return 0 if sev == "overdue" else 1 if sev == "due_soon" else 2

    out.sort(key=lambda r: (rank(r["severity"]), r["daysLeft"] if r["daysLeft"] is not None else 999999, r["id"]))
    return out


def _counts(rows: List[Dict[str, Any]]) -> Dict[str, int]:
    c = {"overdue": 0, "due_soon": 0, "ok": 0, "total": 0}
    for r in rows:
        sev = r.get("severity")
        if sev in ("overdue", "due_soon", "ok"):
            c[sev] += 1
            c["total"] += 1
    return c


class DashboardOpsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        errors: Dict[str, str] = {}
        groups: Dict[str, Dict[str, Any]] = {}

        include_done = str(request.query_params.get("include_done", "")).lower() in ("1", "true", "yes", "y", "on")

        PR = _safe_model("procurement", "PurchaseRequest")
        Quote = _safe_model("procurement", "Quote")
        PO = _safe_model("procurement", "PurchaseOrder")
        Shipment = _safe_model("procurement", "Shipment")

        if PR is None:
            errors["pr"] = "Model not found"
            pr_rows = []
        else:
            qs = PR.objects.all().order_by("-id")
            try:
                qs = qs.select_related("project", "project_stage")
            except Exception:
                try:
                    qs = qs.select_related("project")
                except Exception:
                    pass
            pr_rows = _iter_rows("pr", qs, include_done=include_done)

        if Quote is None:
            errors["quote"] = "Model not found"
            quote_rows = []
        else:
            quote_rows = _iter_rows("quote", Quote.objects.all().order_by("-id"), include_done=include_done)

        if PO is None:
            errors["po"] = "Model not found"
            po_rows = []
        else:
            po_rows = _iter_rows("po", PO.objects.all().order_by("-id"), include_done=include_done)

        if Shipment is None:
            shipment_rows = []
        else:
            shipment_rows = _iter_rows("shipment", Shipment.objects.all().order_by("-id"), include_done=include_done)

        groups["pr"] = {"label": "Заявки", "counts": _counts(pr_rows), "rows": pr_rows}
        groups["quote"] = {"label": "КП", "counts": _counts(quote_rows), "rows": quote_rows}
        groups["po"] = {"label": "Заказы", "counts": _counts(po_rows), "rows": po_rows}
        groups["shipment"] = {"label": "Доставки", "counts": _counts(shipment_rows), "rows": shipment_rows}

        return Response(
            {
                "generated_at": timezone.now().isoformat(),
                "threshold_days": THRESHOLD_DAYS,
                "groups": groups,
                "errors": errors,
            }
        )
