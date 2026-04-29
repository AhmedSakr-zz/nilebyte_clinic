# Copyright (c) 2026, NileByte
# For license information, please see license.txt

"""Reception Workspace backend for the NileByte Clinic Frappe Desk Page.

Route: /app/reception-workspace

This controller intentionally keeps the page self-contained. It wraps the
existing nilebyte_clinic.api.reception methods where they already exist and adds
billing/payment helpers required by the merged Reception + Cashier dashboard.
"""

import frappe
from frappe.utils import nowdate, nowtime, getdate

from nilebyte_clinic.api import reception as reception_api


ALLOWED_ROLES = ("Receptionist", "Cashier", "Clinic Admin", "System Manager")
RECEPTION_ROLES = ("Receptionist", "Clinic Admin", "System Manager")
BILLING_ROLES = ("Cashier", "Clinic Admin", "System Manager")


def get_context(context):
    _ensure_page_access()
    context.no_cache = 1
    context.title = "Reception Workspace"


def _roles():
    if frappe.session.user == "Administrator":
        return {"Administrator", "System Manager", "Clinic Admin", "Receptionist", "Cashier"}
    return set(frappe.get_roles(frappe.session.user))


def _ensure_any(allowed, message):
    if frappe.session.user == "Administrator":
        return
    if not _roles().intersection(set(allowed)):
        frappe.throw(message, frappe.PermissionError)


def _ensure_page_access():
    _ensure_any(ALLOWED_ROLES, "You do not have permission to access Reception Workspace.")


def _ensure_reception_or_admin():
    _ensure_any(RECEPTION_ROLES, "Reception permission required.")


def _ensure_billing_or_admin():
    _ensure_any(BILLING_ROLES, "Cashier permission required.")


def has_doctype(doctype):
    return frappe.db.exists("DocType", doctype)


def has_field(doctype, fieldname):
    return frappe.db.has_column(doctype, fieldname)


@frappe.whitelist()
def get_reception_dashboard(filter="all"):
    """One payload for initial dashboard load."""
    _ensure_page_access()
    return {
        "stats": get_dashboard_stats(),
        "queue": get_today_queue(filter=filter),
        "doctors": get_doctor_status(),
        "alerts": get_alerts(),
        "billing": get_billing_summary(),
    }


@frappe.whitelist()
def get_dashboard_stats():
    _ensure_page_access()
    return reception_api.get_dashboard_stats()


@frappe.whitelist()
def get_today_queue(filter="all"):
    _ensure_page_access()
    return reception_api.get_today_queue(filter=filter)


@frappe.whitelist()
def search_patient(query):
    _ensure_page_access()
    return reception_api.search_patient(query=query)


@frappe.whitelist()
def create_patient(patient_name=None, mobile=None, sex=None, dob=None, data=None):
    _ensure_reception_or_admin()
    if isinstance(data, str):
        data = frappe.parse_json(data)
    data = data or {}
    patient_name = patient_name or data.get("patient_name") or data.get("full_name") or data.get("name")
    mobile = mobile or data.get("mobile") or data.get("phone")
    sex = sex or data.get("sex") or data.get("gender")
    dob = dob or data.get("dob") or data.get("date_of_birth")
    if not patient_name:
        frappe.throw("Patient name is required.")
    return reception_api.create_patient(patient_name=patient_name, mobile=mobile, sex=sex, dob=dob)


@frappe.whitelist()
def book_appointment(patient, practitioner, appointment_date, appointment_time, notes=None):
    _ensure_reception_or_admin()
    return reception_api.book_appointment(
        patient=patient,
        practitioner=practitioner,
        appointment_date=appointment_date,
        appointment_time=appointment_time,
        notes=notes,
    )


@frappe.whitelist()
def add_walk_in(patient, practitioner, notes=None):
    _ensure_reception_or_admin()
    return reception_api.add_walk_in(patient=patient, practitioner=practitioner, notes=notes)


@frappe.whitelist()
def check_in_patient(appointment):
    _ensure_reception_or_admin()
    return reception_api.check_in_patient(appointment=appointment)


@frappe.whitelist()
def mark_arrived(appointment):
    _ensure_reception_or_admin()
    return reception_api.check_in_patient(appointment=appointment)


@frappe.whitelist()
def send_to_doctor(appointment):
    _ensure_reception_or_admin()
    return reception_api.send_to_doctor(appointment=appointment)


@frappe.whitelist()
def complete_visit(appointment):
    _ensure_reception_or_admin()
    return reception_api.complete_visit(appointment=appointment)


@frappe.whitelist()
def create_invoice(appointment):
    _ensure_billing_or_admin()
    return reception_api.create_invoice(appointment=appointment)


@frappe.whitelist()
def get_doctor_status():
    _ensure_page_access()
    return reception_api.get_doctor_status()


@frappe.whitelist()
def get_alerts():
    _ensure_page_access()
    alerts = reception_api.get_alerts() or []
    # Add direct routes so frontend alerts/cards can be clickable.
    for alert in alerts:
        if alert.get("invoice"):
            alert["route"] = f"/app/sales-invoice/{alert.get('invoice')}"
        elif alert.get("patient"):
            alert["route"] = f"/app/patient/{alert.get('patient')}"
    return alerts


@frappe.whitelist()
def get_pending_bills():
    _ensure_page_access()
    rows = []
    if not has_doctype("Sales Invoice"):
        return rows

    invoices = frappe.get_all(
        "Sales Invoice",
        filters={"docstatus": ["!=", 2], "outstanding_amount": [">", 0]},
        fields=["name", "patient", "customer", "posting_date", "grand_total", "outstanding_amount", "docstatus"],
        order_by="modified desc",
        limit=25,
    )
    for inv in invoices:
        patient_name = inv.patient
        if inv.patient and has_doctype("Patient"):
            patient_name = frappe.db.get_value("Patient", inv.patient, "patient_name") or inv.patient
        rows.append({
            "invoice": inv.name,
            "patient": inv.patient,
            "patient_name": patient_name or inv.customer,
            "posting_date": inv.posting_date,
            "grand_total": inv.grand_total,
            "outstanding_amount": inv.outstanding_amount,
            "status": "Draft Invoice" if inv.docstatus == 0 else "Unpaid",
            "invoice_route": ["Form", "Sales Invoice", inv.name],
        })
    return rows


@frappe.whitelist()
def get_paid_today():
    _ensure_page_access()
    if not has_doctype("Sales Invoice"):
        return []
    rows = frappe.get_all(
        "Sales Invoice",
        filters={"posting_date": nowdate(), "docstatus": 1, "outstanding_amount": ["=", 0]},
        fields=["name", "patient", "customer", "grand_total", "rounded_total", "posting_date"],
        order_by="modified desc",
        limit=25,
    )
    for row in rows:
        row["amount"] = row.rounded_total or row.grand_total or 0
    return rows


@frappe.whitelist()
def get_billing_summary():
    _ensure_page_access()
    summary = {
        "pending_count": 0,
        "pending_amount": 0,
        "paid_today_count": 0,
        "paid_today_amount": 0,
        "draft_count": 0,
        "cash_collected": 0,
    }
    if not has_doctype("Sales Invoice"):
        return summary

    pending = frappe.db.sql(
        """
        SELECT COUNT(*) AS count, COALESCE(SUM(outstanding_amount), 0) AS amount
        FROM `tabSales Invoice`
        WHERE docstatus = 1 AND outstanding_amount > 0
        """,
        as_dict=True,
    )[0]
    draft = frappe.db.count("Sales Invoice", {"docstatus": 0})
    paid = frappe.db.sql(
        """
        SELECT COUNT(*) AS count, COALESCE(SUM(grand_total), 0) AS amount
        FROM `tabSales Invoice`
        WHERE docstatus = 1 AND posting_date = %s AND outstanding_amount = 0
        """,
        (nowdate(),),
        as_dict=True,
    )[0]
    summary.update({
        "pending_count": pending.count or 0,
        "pending_amount": pending.amount or 0,
        "paid_today_count": paid.count or 0,
        "paid_today_amount": paid.amount or 0,
        "draft_count": draft or 0,
    })

    if has_doctype("Payment Entry"):
        cash = frappe.db.sql(
            """
            SELECT COALESCE(SUM(paid_amount), 0)
            FROM `tabPayment Entry`
            WHERE docstatus = 1 AND posting_date = %s
            """,
            (nowdate(),),
        )[0][0]
        summary["cash_collected"] = cash or 0
    return summary


@frappe.whitelist()
def collect_payment(invoice, mode_of_payment=None, amount=None, reference=None):
    """Create and submit a Payment Entry for a Sales Invoice.

    This uses ERPNext's standard Payment Entry reference table. It keeps the
    implementation conservative and fails loudly if mandatory company/account
    configuration is missing.
    """
    _ensure_billing_or_admin()
    if not invoice:
        frappe.throw("Invoice is required.")
    if not has_doctype("Payment Entry"):
        frappe.throw("Payment Entry DocType is not installed on this site.")

    inv = frappe.get_doc("Sales Invoice", invoice)
    if inv.docstatus == 0:
        inv.submit()
    if inv.docstatus != 1:
        frappe.throw("Only submitted Sales Invoices can be paid.")

    outstanding = inv.outstanding_amount or inv.grand_total or 0
    amount = float(amount or outstanding)
    if amount <= 0:
        frappe.throw("Payment amount must be greater than zero.")

    company = inv.company or frappe.defaults.get_user_default("Company")
    mode_of_payment = mode_of_payment or frappe.db.get_single_value("NileByte Clinic Settings", "default_mode_of_payment") if has_doctype("NileByte Clinic Settings") else mode_of_payment

    pe = frappe.new_doc("Payment Entry")
    pe.payment_type = "Receive"
    pe.posting_date = nowdate()
    pe.company = company
    pe.party_type = "Customer"
    pe.party = inv.customer
    pe.mode_of_payment = mode_of_payment
    pe.paid_amount = amount
    pe.received_amount = amount
    pe.reference_no = reference or invoice
    pe.reference_date = nowdate()

    # Let ERPNext set most accounts when possible.
    try:
        pe.setup_party_account_field()
        pe.set_missing_values()
    except Exception:
        pass

    pe.append("references", {
        "reference_doctype": "Sales Invoice",
        "reference_name": inv.name,
        "total_amount": inv.grand_total,
        "outstanding_amount": outstanding,
        "allocated_amount": min(amount, outstanding),
    })

    pe.insert(ignore_permissions=True)
    pe.submit()
    frappe.db.commit()

    return {
        "message": f"Payment collected for {invoice}",
        "payment_entry": pe.name,
        "payment_route": ["Form", "Payment Entry", pe.name],
        "invoice": inv.name,
    }
