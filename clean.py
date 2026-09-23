"""Clean FDE_Assignment_Shipment_Dataset.xlsx -> shipments_clean.json + cleaning_log.md.
Stdlib only. Every rule is counted so the log is generated, not hand-written."""
import collections, datetime as dt, json, re, zipfile
import xml.etree.ElementTree as ET

SRC = "FDE_Assignment_Shipment_Dataset.xlsx"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

STATUS = {
    "delivered": "Delivered", "delivered_ok": "Delivered",
    "failed delivery": "Failed", "failed_delivery": "Failed", "failed": "Failed",
    "undelivered": "Failed", "failed - customer not available": "Failed",
    "in transit": "InTransit", "transit": "InTransit", "in-transit": "InTransit",
    "out for delivery": "OutForDelivery",
    "scheduled for redelivery": "RedeliveryScheduled",
    "re-delivery scheduled": "RedeliveryScheduled", "redelivery": "RedeliveryScheduled",
    "returned to sender": "ReturnedToSender", "rts": "ReturnedToSender",
    "return to sender": "ReturnedToSender",
}

log = collections.Counter()
examples = collections.defaultdict(list)


def note(key, example=None):
    log[key] += 1
    if example is not None and len(examples[key]) < 3:
        examples[key].append(example)


def read_rows():
    with zipfile.ZipFile(SRC) as z:
        root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows = []
    for row in root.find("m:sheetData", NS):
        cells = {}
        for c in row:
            col = re.match(r"[A-Z]+", c.get("r")).group()
            t = c.find(".//m:t", NS)
            v = c.find("m:v", NS)
            cells[col] = (t.text if t is not None else v.text if v is not None else "") or ""
        rows.append(cells)
    cols = sorted(rows[0])
    header = [rows[0][c] for c in cols]
    return [dict(zip(header, (r.get(c, "") for c in cols))) for r in rows[1:]]


def parse_date(s, field):
    """Return (iso_or_None, ambiguous_flag). Rules come from unambiguous rows, see log."""
    s = s.strip()
    if not s:
        return None, False
    if re.fullmatch(r"\d{4}-\d\d-\d\d", s):
        return s, False
    if re.fullmatch(r"\d{5}", s):  # Excel serial date
        note(f"{field}: Excel serial number", s)
        return (dt.date(1899, 12, 30) + dt.timedelta(int(s))).isoformat(), False
    m = re.fullmatch(r"(\d\d)[/.](\d\d)[/.](\d{4})", s)  # dd/mm/yyyy, dd.mm.yyyy
    if m:
        d, mo, y = map(int, m.groups())
        note(f"{field}: dd/mm/yyyy or dd.mm.yyyy", s)
        return dt.date(y, mo, d).isoformat(), d <= 12
    m = re.fullmatch(r"(\d\d)-(\d\d)-(\d\d)", s)  # mm-dd-yy
    if m:
        mo, d, y = map(int, m.groups())
        note(f"{field}: mm-dd-yy", s)
        return dt.date(2000 + y, mo, d).isoformat(), d <= 12
    try:
        note(f"{field}: dd Mon yyyy", s)
        return dt.datetime.strptime(s, "%d %b %Y").date().isoformat(), False
    except ValueError:
        raise ValueError(f"unknown date format in {field}: {s!r}")


def check_format_direction(raw):
    """Prove the day/month order of each format from rows where one part is > 12."""
    out = {}
    for name, rx, day_pos in [("dd/mm/yyyy or dd.mm.yyyy", r"(\d\d)[/.](\d\d)[/.]\d{4}", 0),
                              ("mm-dd-yy", r"(\d\d)-(\d\d)-\d\d", 1)]:
        agree = contra = 0
        for s in raw:
            m = re.fullmatch(rx, s.strip())
            if not m:
                continue
            a = [int(x) for x in m.groups()]
            if a[day_pos] > 12:
                agree += 1
            if a[1 - day_pos] > 12:
                contra += 1
        out[name] = (agree, contra)
    return out


def main():
    raw = read_rows()
    log["rows read"] = len(raw)
    all_dates = [r["shipment_date"] for r in raw] + [r["last_attempt_date"] for r in raw]
    direction = check_format_direction(all_dates)

    clean = []
    for r in raw:
        if r["tracking_number"].startswith("TEST") or r["status"].strip() == "TEST" \
                or r["notes"] == "test record":
            note("dropped: test record", r["tracking_number"])
            continue
        flags = []
        name = " ".join(r["customer_name"].split())
        if name != r["customer_name"]:
            note("fixed: name whitespace", repr(r["customer_name"]))

        st_raw = r["status"]
        st = STATUS.get(st_raw.strip().lower())
        if st is None:
            raise ValueError(f"unmapped status {st_raw!r}")
        if st_raw != st:
            note(f"status mapped: {st_raw!r} -> {st}")

        phone = r["phone"].strip()
        if not phone or set(phone) <= {"0"}:
            note("flag: no valid phone (cannot verify)", phone or "(blank)")
            flags.append("no_phone")
            phone = None

        addr = r["delivery_address"].strip()
        if not re.search(r"[,،]", addr) or not re.search(r"\d", addr):
            note("flag: junk address", addr)
            flags.append("junk_address")
        elif re.search(r"[؀-ۿ]", addr):
            note("info: mixed Arabic/English address (kept)", addr)

        cod_s = r["cod_amount_aed"].replace("AED", "").strip()
        if cod_s != r["cod_amount_aed"]:
            note("fixed: COD 'AED' prefix", r["cod_amount_aed"])
        cod = round(float(cod_s), 2)
        if str(cod) != cod_s and not cod_s.endswith("0") and "." in cod_s:
            note("fixed: COD float noise", cod_s)

        weight = float(r["weight_kg"])
        if weight <= 0:
            note("flag: non-positive weight", r["weight_kg"])
            flags.append("bad_weight")

        ship, amb1 = parse_date(r["shipment_date"], "shipment_date")
        last, amb2 = parse_date(r["last_attempt_date"], "last_attempt_date")
        if amb1 or amb2:
            note("info: date where day <= 12 (order taken from format rule)")
        if ship and last and last < ship:
            note("flag: last attempt before shipment date", f"{ship} > {last}")
            flags.append("attempt_before_ship")

        attempts = int(r["delivery_attempts"])
        if st == "Delivered" and attempts == 0:
            note("flag: Delivered with 0 attempts", r["tracking_number"])
            flags.append("delivered_no_attempt")
        if st == "InTransit" and last:
            note("info: In Transit but has attempt date (kept)", r["tracking_number"])

        clean.append({
            "tracking_number": r["tracking_number"].strip(), "customer_name": name,
            "phone": phone, "delivery_address": addr, "emirate": r["emirate"].strip(),
            "service_type": r["service_type"].strip(), "shipment_date": ship,
            "last_attempt_date": last, "status": st, "status_raw": st_raw,
            "delivery_attempts": attempts, "cod_amount_aed": cod, "weight_kg": weight,
            "notes": r["notes"].strip() or None, "flags": flags,
        })

    # Duplicates: keep the most recent event, flag the conflict for a human.
    groups = collections.defaultdict(list)
    for s in clean:
        groups[s["tracking_number"]].append(s)
    out = []
    for tn, g in groups.items():
        if len(g) > 1:
            note("flag: duplicate tracking number (kept latest attempt)",
                 f"{tn}: " + " / ".join(x["status"] for x in g))
            g.sort(key=lambda x: x["last_attempt_date"] or "")
            keep = g[-1]
            keep["flags"].append("data_conflict")
            keep["conflict_statuses"] = [x["status"] for x in g]
            log["dropped: duplicate rows"] += len(g) - 1
            out.append(keep)
        else:
            out.append(g[0])

    with open("shipments_clean.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    flagged = sum(1 for s in out if s["flags"])
    ships = sorted(s["shipment_date"] for s in out)
    lines = ["# Cleaning log", "", "Generated by `clean.py`. All counts are computed from the file.", "",
             f"- Rows read: {log['rows read']}",
             f"- Rows out: {len(out)} (flagged for human handoff: {flagged})",
             f"- Shipment date range after cleaning: {ships[0]} to {ships[-1]}",
             "- Final status mix: " + ", ".join(f"{k} {v}" for k, v in
                                               collections.Counter(s["status"] for s in out).most_common()),
             "", "## Date order rule", "",
             "The day/month order of each format comes from rows where one part is above 12.", "",
             "| Format | Rows proving the rule | Rows contradicting it |", "|---|---|---|"]
    lines += [f"| {k} | {a} | {c} |" for k, (a, c) in direction.items()]
    lines += ["", "## Rules applied", "", "| Rule | Count | Examples |", "|---|---|---|"]
    for k in sorted(log):
        if k == "rows read":
            continue
        lines.append(f"| {k} | {log[k]} | {'; '.join(map(str, examples[k]))} |")
    lines += ["", "## Flag policy", "",
              "A flagged shipment gets no automated action. The agent hands it to a human.",
              "Flags: no_phone, junk_address, bad_weight, attempt_before_ship, delivered_no_attempt, data_conflict."]
    with open("cleaning_log.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"{log['rows read']} rows in, {len(out)} out, {flagged} flagged")


if __name__ == "__main__":
    main()
