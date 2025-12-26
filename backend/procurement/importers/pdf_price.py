
from typing import Dict, Any, List
from datetime import date
import io, re

try:
    from pdfminer.high_level import extract_text
except Exception:
    extract_text = None

LINE_RE = re.compile(r"^(?P<sku>[A-Za-z0-9_\-./]+)\s+(?P<name>[^0-9]+?)\s+(?P<price>\d+[.,]\d{2})\s*(?P<currency>RUB|RUR|₽|EUR|USD)?", re.I)

def parse_pdf(fileobj, *, supplier_name: str = "", default_currency: str = "RUB") -> Dict[str, Any]:
    if extract_text is None:
        return {"ok": False, "errors": ["pdfminer.six не установлен в окружении (добавьте в requirements)."]}
    # pdfminer требует bytes-like
    data = fileobj.read()
    text = extract_text(io.BytesIO(data))
    if not text:
        return {"ok": False, "errors": ["PDF пустой или не распознан."]}

    rows: List[Dict[str, Any]] = []
    errors: List[str] = []
    for ln_no, line in enumerate(text.splitlines(), start=1):
        line = line.strip()
        if not line or len(line) < 5:
            continue
        m = LINE_RE.match(line)
        if not m:
            continue
        sku = m.group("sku").strip()
        name = m.group("name").strip()
        price_raw = m.group("price").replace(",", ".")
        try:
            price = float(price_raw)
        except Exception:
            errors.append(f"Строка {ln_no}: не прочитана цена '{price_raw}'")
            continue
        currency = (m.group("currency") or default_currency).replace("₽","RUB").upper()
        rows.append({
            "row": ln_no,
            "valid": True,
            "item_sku": sku,
            "supplier": supplier_name,
            "name": name,
            "price": price,
            "currency": currency,
            "dt": str(date.today()),
        })
    return {"ok": True, "preview": True, "rows": rows, "errors": errors}
