# Copyright (c) 2026, NileByte
# For license information, please see license.txt

"""Clinic Admin Dashboard backend for NileByte Clinic.

Route: /app/clinic-admin-dashboard

The implementation is defensive so it works across ERPNext Healthcare/Marley
variants. Every public method checks role access and every optional DocType or
field is inspected before use.
"""

import frappe
from frappe.utils import nowdate, add_days, getdate, flt, cint, date_diff

ALLOWED_ROLES = ("Clinic Admin", "System Manager")


def get_context(context):
    _ensure_page_access()
    context.no_cache = 1
    context.title = "Clinic Admin Dashboard"


def _roles():
    if frappe.session.user == "Administrator":
        return {"Administrator", "System Manager", "Clinic Admin"}
    return set(frappe.get_roles(frappe.session.user))


def _ensure_page_access():
    if frappe.session.user == "Administrator":
        return
    if not _roles().intersection(set(ALLOWED_ROLES)):
        frappe.throw("You do not have permission to access Clinic Admin Dashboard.", frappe.PermissionError)


def has_doctype(doctype):
    return bool(frappe.db.exists("DocType", doctype))


def has_field(doctype, fieldname):
    return bool(has_doctype(doctype) and frappe.db.has_column(doctype, fieldname))


def _money(value):
    return flt(value or 0, 2)


def _date_range(days=30):
    return add_days(nowdate(), -abs(cint(days)) + 1), nowdate()


def _normalize_status(status):
    if status in ["Scheduled", "Open", "Waiting"]:
        return "Waiting"
    if status in ["Checked In", "In Progress", "With Doctor"]:
        return "With Doctor"
    if status in ["Closed", "Completed"]:
        return "Completed"
    if status in ["Cancelled"]:
        return "Cancelled"
    if status in ["No Show", "No-show"]:
        return "No Show"
    return status or "Waiting"


@frappe.whitelist()
def get_admin_dashboard(days=30):
    _ensure_page_access()
    return {
        "kpis": get_kpis(days),
        "chart": get_chart_data(days),
        "facility": get_facility_stats(),
        "tasks": get_admin_tasks(),
        "recent_activities": get_recent_activities(),
        "settings": get_settings_overview(),
        "reports": get_report_cards(),
        "quick_cards": get_quick_cards(),
    }


@frappe.whitelist()
def get_kpis(days=30):
    _ensure_page_access()
    start, end = _date_range(days)
    today = nowdate()

    total_patients = frappe.db.count("Patient") if has_doctype("Patient") else 0

    monthly_revenue = 0
    revenue_today = 0
    unpaid_count = 0
    unpaid_amount = 0
    if has_doctype("Sales Invoice"):
        monthly_revenue = frappe.db.sql(
            """
            SELECT COALESCE(SUM(base_grand_total), SUM(grand_total), 0)
            FROM `tabSales Invoice`
            WHERE docstatus = 1 AND posting_date BETWEEN %s AND %s
            """,
            (start, end),
        )[0][0] or 0
        revenue_today = frappe.db.sql(
            """
            SELECT COALESCE(SUM(base_grand_total), SUM(grand_total), 0)
            FROM `tabSales Invoice`
            WHERE docstatus = 1 AND posting_date = %s
            """,
            today,
        )[0][0] or 0
        unpaid = frappe.db.sql(
            """
            SELECT COUNT(*), COALESCE(SUM(outstanding_amount), 0)
            FROM `tabSales Invoice`
            WHERE docstatus = 1 AND outstanding_amount > 0
            """
        )[0]
        unpaid_count = unpaid[0] or 0
        unpaid_amount = unpaid[1] or 0

    pending_appointments = 0
    completed_today = 0
    no_show_today = 0
    appointments_today = 0
    if has_doctype("Patient Appointment"):
        rows = frappe.get_all(
            "Patient Appointment",
            filters={"appointment_date": today},
            fields=["status"],
        )
        appointments_today = len(rows)
        mapped = [_normalize_status(r.status) for r in rows]
        pending_appointments = mapped.count("Waiting") + mapped.count("With Doctor")
        completed_today = mapped.count("Completed")
        no_show_today = mapped.count("No Show")

    active_doctors = frappe.db.count("Healthcare Practitioner") if has_doctype("Healthcare Practitioner") else 0
    no_show_rate = round((no_show_today / appointments_today) * 100, 1) if appointments_today else 0

    low_stock_items = 0
    if has_doctype("Bin"):
        low_stock_items = frappe.db.sql(
            """
            SELECT COUNT(DISTINCT item_code)
            FROM `tabBin`
            WHERE actual_qty <= 0
            """
        )[0][0] or 0

    return {
        "total_patients": total_patients,
        "monthly_revenue": _money(monthly_revenue),
        "revenue_today": _money(revenue_today),
        "pending_appointments": pending_appointments,
        "low_stock_items": low_stock_items,
        "appointments_today": appointments_today,
        "completed_today": completed_today,
        "unpaid_invoices": unpaid_count,
        "unpaid_amount": _money(unpaid_amount),
        "active_doctors": active_doctors,
        "no_show_rate": no_show_rate,
    }


@frappe.whitelist()
def get_chart_data(days=7):
    _ensure_page_access()
    start, end = _date_range(days)
    labels = []
    revenue = []
    expenses = []

    current = getdate(start)
    end_date = getdate(end)
    while current <= end_date:
        label = current.strftime("%d %b")
        day = current.isoformat()
        labels.append(label)
        revenue.append(_money(_invoice_total(day)))
        expenses.append(_money(_expense_total(day)))
        current = getdate(add_days(current, 1))

    return {"labels": labels, "revenue": revenue, "expenses": expenses}


def _invoice_total(day):
    if not has_doctype("Sales Invoice"):
        return 0
    return frappe.db.sql(
        """
        SELECT COALESCE(SUM(base_grand_total), SUM(grand_total), 0)
        FROM `tabSales Invoice`
        WHERE docstatus = 1 AND posting_date = %s
        """,
        day,
    )[0][0] or 0


def _expense_total(day):
    if not has_doctype("Purchase Invoice"):
        return 0
    return frappe.db.sql(
        """
        SELECT COALESCE(SUM(base_grand_total), SUM(grand_total), 0)
        FROM `tabPurchase Invoice`
        WHERE docstatus = 1 AND posting_date = %s
        """,
        day,
    )[0][0] or 0


@frappe.whitelist()
def get_facility_stats():
    _ensure_page_access()
    patient = _recent_patient()
    return {
        "patient": patient,
        "active_doctors": frappe.db.count("Healthcare Practitioner") if has_doctype("Healthcare Practitioner") else 0,
        "rooms": frappe.db.count("Healthcare Service Unit") if has_doctype("Healthcare Service Unit") else 0,
        "today_admissions": frappe.db.count("Inpatient Record", {"admission_date": nowdate()}) if has_doctype("Inpatient Record") and has_field("Inpatient Record", "admission_date") else 0,
    }


def _recent_patient():
    if not has_doctype("Patient"):
        return None
    fields = ["name"]
    for field in ["patient_name", "first_name", "sex", "dob", "mobile", "phone"]:
        if has_field("Patient", field):
            fields.append(field)
    rows = frappe.get_all("Patient", fields=fields, order_by="modified desc", limit=1)
    if not rows:
        return None
    row = rows[0]
    name = row.get("patient_name") or row.get("first_name") or row.get("name")
    row["display_name"] = name
    row["age_gender"] = _age_gender(row)
    row["conditions"] = _patient_conditions(row.get("name"))
    return row


def _age_gender(row):
    parts = []
    if row.get("dob"):
        try:
            today = getdate(nowdate())
            born = getdate(row.get("dob"))
            years = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
            if years >= 0:
                parts.append(f"{years} Years")
        except Exception:
            pass
    if row.get("sex"):
        parts.append(row.get("sex"))
    return ", ".join(parts)


def _patient_conditions(patient):
    if not patient:
        return ""
    if has_doctype("Patient Medical Record") and has_field("Patient Medical Record", "patient"):
        rows = frappe.get_all(
            "Patient Medical Record",
            filters={"patient": patient},
            fields=["subject" if has_field("Patient Medical Record", "subject") else "name"],
            limit=2,
            order_by="creation desc",
        )
        values = [r.get("subject") or r.get("name") for r in rows]
        return ", ".join([v for v in values if v])
    return ""


@frappe.whitelist()
def get_admin_tasks():
    _ensure_page_access()
    tasks = []
    if has_doctype("ToDo"):
        rows = frappe.get_all(
            "ToDo",
            filters={"allocated_to": frappe.session.user, "status": ["!=", "Closed"]},
            fields=["name", "description", "priority", "date"],
            order_by="modified desc",
            limit=5,
        )
        for row in rows:
            tasks.append({
                "label": row.description or row.name,
                "status": row.priority or "Open",
                "route": ["Form", "ToDo", row.name],
            })
    if not tasks:
        tasks = [
            {"label": "Review unpaid invoices", "status": "Due Soon", "route": ["List", "Sales Invoice"]},
            {"label": "Review pending appointments", "status": "Open", "route": ["List", "Patient Appointment"]},
            {"label": "Check user roles", "status": "Admin", "route": ["List", "User"]},
        ]
    return tasks


@frappe.whitelist()
def get_recent_activities():
    _ensure_page_access()
    activities = []
    if has_doctype("Version"):
        rows = frappe.get_all(
            "Version",
            fields=["ref_doctype", "docname", "owner", "modified"],
            order_by="modified desc",
            limit=5,
        )
        for row in rows:
            activities.append({
                "title": f"{row.owner} updated {row.ref_doctype}",
                "subtitle": row.docname,
                "time": str(row.modified),
                "route": ["Form", row.ref_doctype, row.docname],
            })
    if not activities:
        activities = [
            {"title": "System ready", "subtitle": "No recent activity found", "time": "Now", "route": ["clinic-admin-dashboard"]},
        ]
    return activities


@frappe.whitelist()
def get_settings_overview():
    _ensure_page_access()
    return [
        {"label": "User Roles", "icon": "👥", "route": ["List", "Role"]},
        {"label": "Clinic Settings", "icon": "🏥", "route": _settings_route()},
        {"label": "Billing Setup", "icon": "💳", "route": ["List", "Mode of Payment"]},
        {"label": "Services & Prices", "icon": "🏷", "route": ["List", "Item"]},
        {"label": "Backup Data", "icon": "☁", "route": ["List", "Data Export"]},
    ]


def _settings_route():
    if has_doctype("NileByte Clinic Settings"):
        # Single DocType route is usually Form/Single DocType/Single DocType name.
        return ["Form", "NileByte Clinic Settings", "NileByte Clinic Settings"]
    return ["List", "System Settings"]


@frappe.whitelist()
def get_report_cards():
    _ensure_page_access()
    reports = [
        {"label": "Revenue Reports", "icon": "💹", "route": ["query-report", "Clinic Revenue Summary"]},
        {"label": "Appointment Reports", "icon": "📅", "route": ["query-report", "Appointment Status Report"]},
        {"label": "Unpaid Invoices", "icon": "🧾", "route": ["query-report", "Unpaid Invoices Report"]},
        {"label": "Doctor Performance", "icon": "👨‍⚕️", "route": ["query-report", "Doctor Performance Report"]},
        {"label": "Patient Visit History", "icon": "📁", "route": ["query-report", "Patient Visit History"]},
    ]
    return reports


@frappe.whitelist()
def get_quick_cards():
    _ensure_page_access()
    return [
        {"label": "Revenue", "value": "Open report", "button": "Revenue", "route": ["query-report", "Clinic Revenue Summary"]},
        {"label": "Active Doctors", "value": frappe.db.count("Healthcare Practitioner") if has_doctype("Healthcare Practitioner") else 0, "button": "Manage Doctors", "route": ["List", "Healthcare Practitioner"]},
        {"label": "Inpatient Admissions", "value": frappe.db.count("Inpatient Record") if has_doctype("Inpatient Record") else 0, "button": "Open Admissions", "route": ["List", "Inpatient Record"]},
    ]


@frappe.whitelist()
def search_global(query):
    _ensure_page_access()
    query = (query or "").strip()
    if len(query) < 2:
        return []
    results = []

    if has_doctype("Patient"):
        conditions = []
        params = {"q": f"%{query}%"}
        for field in ["name", "patient_name", "first_name", "mobile", "phone"]:
            if has_field("Patient", field):
                conditions.append(f"{field} LIKE %(q)s")
        if conditions:
            optional_fields = [field for field in ["patient_name", "first_name", "mobile", "phone"] if has_field("Patient", field)]
            select_fields = ["name"] + optional_fields
            sql = "SELECT {0} FROM `tabPatient` WHERE {1} ORDER BY modified DESC LIMIT 8".format(", ".join(select_fields), " OR ".join(conditions))
            rows = frappe.db.sql(sql, params, as_dict=True)
            for row in rows:
                results.append({
                    "type": "Patient",
                    "name": row.name,
                    "title": row.get("patient_name") or row.get("first_name") or row.name,
                    "subtitle": row.get("mobile") or row.get("phone") or row.name,
                    "route": ["Form", "Patient", row.name],
                })

    if has_doctype("Sales Invoice"):
        invs = frappe.get_all(
            "Sales Invoice",
            filters={"name": ["like", f"%{query}%"]},
            fields=["name", "customer", "grand_total", "outstanding_amount"],
            limit=5,
            order_by="modified desc",
        )
        for row in invs:
            results.append({
                "type": "Invoice",
                "name": row.name,
                "title": row.name,
                "subtitle": f"{row.customer or ''} • Outstanding {flt(row.outstanding_amount or 0, 2)}",
                "route": ["Form", "Sales Invoice", row.name],
            })
    return results[:12]
