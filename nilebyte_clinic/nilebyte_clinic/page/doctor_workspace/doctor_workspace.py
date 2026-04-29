# Copyright (c) 2026, NileByte
# For license information, please see license.txt

"""Doctor Workspace backend for the NileByte Clinic Frappe Desk Page.

Route: /app/doctor-workspace

This module is intentionally defensive because Healthcare/Marley field names can
vary between installs. It checks DocTypes and fields before using them and keeps
all write actions behind role checks.
"""

import frappe
from frappe.utils import nowdate, now_datetime, get_datetime, getdate, flt


ALLOWED_ROLES = ("Doctor", "Clinic Admin", "System Manager")
DOCTOR_ROLES = ("Doctor", "Clinic Admin", "System Manager")


def get_context(context):
    _ensure_page_access()
    context.no_cache = 1
    context.title = "Doctor Workspace"


def _roles():
    if frappe.session.user == "Administrator":
        return {"Administrator", "System Manager", "Clinic Admin", "Doctor"}
    return set(frappe.get_roles(frappe.session.user))


def _ensure_any(allowed, message="Permission denied"):
    if frappe.session.user == "Administrator":
        return
    if not _roles().intersection(set(allowed)):
        frappe.throw(message, frappe.PermissionError)


def _ensure_page_access():
    _ensure_any(ALLOWED_ROLES, "You do not have permission to access Doctor Workspace.")


def _ensure_doctor_or_admin():
    _ensure_any(DOCTOR_ROLES, "Doctor permission required.")


def has_doctype(doctype):
    return bool(frappe.db.exists("DocType", doctype))


def has_field(doctype, fieldname):
    return bool(has_doctype(doctype) and frappe.db.has_column(doctype, fieldname))


def _get_allowed_status(doctype, fieldname, preferred):
    if not has_doctype(doctype):
        return preferred[0]
    meta = frappe.get_meta(doctype)
    field = meta.get_field(fieldname)
    if not field or not field.options:
        return preferred[0]
    allowed = [x.strip() for x in field.options.split("\n") if x.strip()]
    for status in preferred:
        if status in allowed:
            return status
    return allowed[0] if allowed else preferred[0]


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


def _doctor_for_user():
    """Resolve the Healthcare Practitioner linked to the current user if possible."""
    if not has_doctype("Healthcare Practitioner"):
        return None

    user = frappe.session.user
    for field in ("user_id", "user", "email"):
        if has_field("Healthcare Practitioner", field):
            value = frappe.db.get_value("Healthcare Practitioner", {field: user}, "name")
            if value:
                return value
    return None


def _can_view_practitioner(practitioner=None):
    if frappe.session.user == "Administrator":
        return True
    if _roles().intersection({"Clinic Admin", "System Manager"}):
        return True
    linked = _doctor_for_user()
    return not practitioner or not linked or practitioner == linked


def _get_patient_display(patient):
    if not patient or not has_doctype("Patient"):
        return {}
    fields = ["name"]
    for f in ["patient_name", "first_name", "mobile", "phone", "sex", "dob"]:
        if has_field("Patient", f):
            fields.append(f)
    row = frappe.db.get_value("Patient", patient, fields, as_dict=True) or {}
    row["display_name"] = row.get("patient_name") or row.get("first_name") or row.get("name") or patient
    row["mobile"] = row.get("mobile") or row.get("phone") or ""
    row["age_gender"] = _age_gender(row)
    return row


def _age_gender(patient_row):
    parts = []
    dob = patient_row.get("dob")
    if dob:
        try:
            today = getdate(nowdate())
            born = getdate(dob)
            years = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
            if years >= 0:
                parts.append(f"{years} Years")
        except Exception:
            pass
    if patient_row.get("sex"):
        parts.append(patient_row.get("sex"))
    return ", ".join(parts)


def _payment_status(patient, appointment_date=None):
    if not patient or not has_doctype("Sales Invoice") or not has_field("Sales Invoice", "patient"):
        return "Not Invoiced"
    filters = {"patient": patient, "docstatus": ["!=", 2]}
    if appointment_date and has_field("Sales Invoice", "posting_date"):
        filters["posting_date"] = appointment_date
    invoices = frappe.get_all(
        "Sales Invoice",
        filters=filters,
        fields=["name", "docstatus", "outstanding_amount", "grand_total"],
        order_by="creation desc",
        limit=1,
    )
    if not invoices:
        return "Not Invoiced"
    inv = invoices[0]
    if inv.docstatus == 0:
        return "Draft Invoice"
    if flt(inv.outstanding_amount) > 0:
        return "Unpaid"
    return "Paid"


def _queue_status_for_appointment(appointment):
    if not appointment or not has_doctype("Clinic Queue"):
        return None
    if not has_field("Clinic Queue", "appointment"):
        return None
    row = frappe.get_all(
        "Clinic Queue",
        filters={"appointment": appointment},
        fields=["name", "status", "queue_number", "arrived_time", "consultation_start_time", "consultation_end_time"],
        order_by="creation desc",
        limit=1,
    )
    return row[0] if row else None


def _appointment_fields():
    fields = ["name"]
    for f in [
        "patient", "patient_name", "practitioner", "practitioner_name",
        "appointment_date", "appointment_time", "status", "appointment_type",
        "department", "service_unit",
    ]:
        if has_field("Patient Appointment", f):
            fields.append(f)
    return fields


@frappe.whitelist()
def get_doctor_dashboard(practitioner=None):
    _ensure_page_access()
    if practitioner and not _can_view_practitioner(practitioner):
        frappe.throw("You cannot view another doctor's queue.", frappe.PermissionError)
    practitioner = practitioner or _doctor_for_user()
    queue = get_today_queue(practitioner=practitioner)
    selected = queue[0] if queue else None
    patient_summary = get_patient_summary(selected.get("patient")) if selected else None
    return {
        "stats": get_stats(practitioner=practitioner),
        "queue": queue,
        "patient_summary": patient_summary,
        "tasks": get_my_tasks(),
        "notes": get_quick_notes(),
        "practitioner": practitioner,
    }


@frappe.whitelist()
def get_stats(practitioner=None):
    _ensure_page_access()
    practitioner = practitioner or _doctor_for_user()
    if practitioner and not _can_view_practitioner(practitioner):
        frappe.throw("You cannot view another doctor's stats.", frappe.PermissionError)

    if not has_doctype("Patient Appointment"):
        return {"waiting": 0, "with_doctor": 0, "completed": 0, "followups": 0, "pending_labs": 0, "unpaid": 0, "patients_seen": 0}

    filters = {"appointment_date": nowdate()}
    if practitioner:
        filters["practitioner"] = practitioner

    rows = frappe.get_all("Patient Appointment", filters=filters, fields=["name", "patient", "status", "appointment_date"])
    mapped = [_normalize_status(r.status) for r in rows]
    unpaid = 0
    for row in rows:
        if _payment_status(row.patient, row.appointment_date) == "Unpaid":
            unpaid += 1

    return {
        "waiting": mapped.count("Waiting"),
        "with_doctor": mapped.count("With Doctor"),
        "completed": mapped.count("Completed"),
        "followups": _count_followups(practitioner),
        "pending_labs": _count_pending_labs(practitioner),
        "unpaid": unpaid,
        "patients_seen": mapped.count("Completed"),
    }


def _count_followups(practitioner=None):
    if not has_doctype("Patient Appointment"):
        return 0
    filters = {"appointment_date": nowdate()}
    if practitioner:
        filters["practitioner"] = practitioner
    if has_field("Patient Appointment", "appointment_type"):
        filters["appointment_type"] = ["like", "%Follow%"]
    return frappe.db.count("Patient Appointment", filters)


def _count_pending_labs(practitioner=None):
    for dt in ("Lab Test", "Lab Test Request"):
        if has_doctype(dt):
            filters = {}
            if has_field(dt, "practitioner") and practitioner:
                filters["practitioner"] = practitioner
            if has_field(dt, "status"):
                filters["status"] = ["in", ["Draft", "Open", "Pending", "Ordered"]]
            return frappe.db.count(dt, filters)
    return 0


@frappe.whitelist()
def get_today_queue(practitioner=None):
    _ensure_page_access()
    practitioner = practitioner or _doctor_for_user()
    if practitioner and not _can_view_practitioner(practitioner):
        frappe.throw("You cannot view another doctor's queue.", frappe.PermissionError)

    if not has_doctype("Patient Appointment"):
        return []

    filters = {"appointment_date": nowdate()}
    if practitioner:
        filters["practitioner"] = practitioner

    rows = frappe.get_all(
        "Patient Appointment",
        filters=filters,
        fields=_appointment_fields(),
        order_by="appointment_time asc, creation asc",
        limit=100,
    )

    output = []
    for row in rows:
        patient = _get_patient_display(row.get("patient"))
        q = _queue_status_for_appointment(row.name)
        status = _normalize_status(q.get("status") if q else row.get("status"))
        output.append({
            "name": row.name,
            "appointment": row.name,
            "patient": row.get("patient"),
            "patient_name": row.get("patient_name") or patient.get("display_name"),
            "age_gender": patient.get("age_gender"),
            "practitioner": row.get("practitioner"),
            "practitioner_name": row.get("practitioner_name") or row.get("practitioner"),
            "appointment_type": row.get("appointment_type") or "Consultation",
            "time": str(row.get("appointment_time") or ""),
            "status": status,
            "raw_status": row.get("status"),
            "queue": q.get("name") if q else None,
            "queue_number": q.get("queue_number") if q else None,
            "payment_status": _payment_status(row.get("patient"), row.get("appointment_date")),
        })
    return output


@frappe.whitelist()
def get_patient_summary(patient):
    _ensure_page_access()
    if not patient:
        return None
    p = _get_patient_display(patient)
    if not p:
        return None

    last_visit = _last_visit(patient)
    last_diagnosis = _last_diagnosis(patient)
    last_prescription = _last_prescription(patient)
    allergies = _patient_field(patient, ["allergies", "allergy", "drug_allergies"])
    chronic = _patient_field(patient, ["chronic_diseases", "medical_history", "history"])

    return {
        "name": p.get("name"),
        "patient_name": p.get("display_name"),
        "mobile": p.get("mobile"),
        "age_gender": p.get("age_gender"),
        "allergies": allergies or "Not recorded",
        "chronic_diseases": chronic or "Not recorded",
        "last_visit_date": last_visit.get("date"),
        "last_diagnosis": last_diagnosis or "No diagnosis found",
        "last_prescriptions": last_prescription or "No prescription found",
        "recent_encounters": _recent_encounters(patient),
        "payment_status": _payment_status(patient),
    }


def _patient_field(patient, fieldnames):
    for fieldname in fieldnames:
        if has_field("Patient", fieldname):
            value = frappe.db.get_value("Patient", patient, fieldname)
            if value:
                return value
    return None


def _last_visit(patient):
    if has_doctype("Patient Appointment"):
        filters = {"patient": patient}
        fields = ["name"]
        if has_field("Patient Appointment", "appointment_date"):
            fields.append("appointment_date")
        row = frappe.get_all("Patient Appointment", filters=filters, fields=fields, order_by="appointment_date desc, creation desc", limit=1)
        if row:
            return {"name": row[0].name, "date": str(row[0].get("appointment_date") or "")}
    return {}


def _last_diagnosis(patient):
    if has_doctype("Patient Encounter"):
        fields = ["name"]
        for f in ["diagnosis", "diagnosis_notes", "medical_diagnosis", "assessment"]:
            if has_field("Patient Encounter", f):
                fields.append(f)
        row = frappe.get_all("Patient Encounter", filters={"patient": patient}, fields=fields, order_by="creation desc", limit=1)
        if row:
            for f in fields:
                if f != "name" and row[0].get(f):
                    return row[0].get(f)
    return None


def _last_prescription(patient):
    for dt in ("Drug Prescription", "Medication", "Patient Medication"):
        if has_doctype(dt) and has_field(dt, "patient"):
            row = frappe.get_all(dt, filters={"patient": patient}, fields=["name"], order_by="creation desc", limit=1)
            if row:
                return row[0].name
    return None


def _recent_encounters(patient):
    if not has_doctype("Patient Encounter"):
        return []
    fields = ["name", "creation"]
    for f in ["encounter_date", "practitioner", "practitioner_name", "diagnosis", "diagnosis_notes"]:
        if has_field("Patient Encounter", f):
            fields.append(f)
    rows = frappe.get_all("Patient Encounter", filters={"patient": patient}, fields=fields, order_by="creation desc", limit=5)
    return rows


@frappe.whitelist()
def start_visit(appointment):
    _ensure_doctor_or_admin()
    if not appointment:
        frappe.throw("Appointment is required.")
    appt = frappe.get_doc("Patient Appointment", appointment)
    if appt.get("practitioner") and not _can_view_practitioner(appt.get("practitioner")):
        frappe.throw("You cannot start another doctor's visit.", frappe.PermissionError)

    new_status = _get_allowed_status("Patient Appointment", "status", ["In Progress", "Checked In", "Open", "Scheduled"])
    if has_field("Patient Appointment", "status"):
        appt.status = new_status
        appt.save(ignore_permissions=True)

    queue_name = _ensure_queue(appt, status="With Doctor")
    encounter = _get_or_create_encounter(appt)
    frappe.db.commit()
    return {
        "message": "Visit started",
        "status": _normalize_status(new_status),
        "queue": queue_name,
        "encounter": encounter,
        "patient": appt.get("patient"),
    }


def _ensure_queue(appt, status="With Doctor"):
    if not has_doctype("Clinic Queue"):
        return None
    existing = None
    if has_field("Clinic Queue", "appointment"):
        existing = frappe.db.get_value("Clinic Queue", {"appointment": appt.name}, "name")
    if existing:
        q = frappe.get_doc("Clinic Queue", existing)
    else:
        q = frappe.new_doc("Clinic Queue")
        if has_field("Clinic Queue", "appointment"):
            q.appointment = appt.name
        if has_field("Clinic Queue", "patient"):
            q.patient = appt.get("patient")
        if has_field("Clinic Queue", "practitioner"):
            q.practitioner = appt.get("practitioner")
        if has_field("Clinic Queue", "queue_date"):
            q.queue_date = nowdate()
        if has_field("Clinic Queue", "queue_number"):
            q.queue_number = _next_queue_number()
    if has_field("Clinic Queue", "status"):
        q.status = status
    if has_field("Clinic Queue", "consultation_start_time") and status == "With Doctor" and not q.get("consultation_start_time"):
        q.consultation_start_time = now_datetime()
    if q.is_new():
        q.insert(ignore_permissions=True)
    else:
        q.save(ignore_permissions=True)
    return q.name


def _next_queue_number():
    if not has_doctype("Clinic Queue") or not has_field("Clinic Queue", "queue_number"):
        return None
    filters = {}
    if has_field("Clinic Queue", "queue_date"):
        filters["queue_date"] = nowdate()
    count = frappe.db.count("Clinic Queue", filters)
    return count + 1


def _get_or_create_encounter(appt):
    if not has_doctype("Patient Encounter"):
        return None
    filters = {}
    if has_field("Patient Encounter", "appointment"):
        filters["appointment"] = appt.name
    elif has_field("Patient Encounter", "patient"):
        filters["patient"] = appt.get("patient")
    else:
        return None
    existing = frappe.db.get_value("Patient Encounter", filters, "name")
    if existing:
        return existing

    doc = frappe.new_doc("Patient Encounter")
    if has_field("Patient Encounter", "patient"):
        doc.patient = appt.get("patient")
    if has_field("Patient Encounter", "patient_name"):
        doc.patient_name = appt.get("patient_name")
    if has_field("Patient Encounter", "practitioner"):
        doc.practitioner = appt.get("practitioner")
    if has_field("Patient Encounter", "appointment"):
        doc.appointment = appt.name
    if has_field("Patient Encounter", "encounter_date"):
        doc.encounter_date = nowdate()
    if has_field("Patient Encounter", "encounter_time"):
        doc.encounter_time = frappe.utils.nowtime()
    doc.insert(ignore_permissions=True)
    return doc.name


@frappe.whitelist()
def save_visit_draft(data=None):
    _ensure_doctor_or_admin()
    if isinstance(data, str):
        data = frappe.parse_json(data)
    data = data or {}
    appointment = data.get("appointment")
    encounter = data.get("encounter")
    if appointment and not encounter:
        appt = frappe.get_doc("Patient Appointment", appointment)
        encounter = _get_or_create_encounter(appt)
    if encounter and has_doctype("Patient Encounter"):
        _update_encounter(encounter, data)
    if data.get("vitals"):
        _save_vitals(data)
    frappe.db.commit()
    return {"message": "Visit draft saved", "encounter": encounter}


def _update_encounter(encounter, data):
    doc = frappe.get_doc("Patient Encounter", encounter)
    field_map = {
        "chief_complaint": ["chief_complaint", "complaint"],
        "history": ["history", "history_of_present_illness"],
        "doctor_notes": ["notes", "doctor_notes", "clinical_notes"],
        "diagnosis": ["diagnosis", "medical_diagnosis"],
        "diagnosis_notes": ["diagnosis_notes", "assessment"],
        "followup_date": ["follow_up_date", "followup_date"],
    }
    for source, candidates in field_map.items():
        value = data.get(source)
        if value is None:
            continue
        for fieldname in candidates:
            if has_field("Patient Encounter", fieldname):
                doc.set(fieldname, value)
                break
    doc.save(ignore_permissions=True)


def _save_vitals(data):
    if not has_doctype("Vital Signs"):
        return None
    patient = data.get("patient")
    vitals = data.get("vitals") or {}
    if not patient:
        return None
    doc = frappe.new_doc("Vital Signs")
    if has_field("Vital Signs", "patient"):
        doc.patient = patient
    for source, candidates in {
        "bp": ["bp", "blood_pressure"],
        "pulse": ["pulse"],
        "temperature": ["temperature"],
        "weight": ["weight"],
        "height": ["height"],
        "spo2": ["spo2", "oxygen_saturation"],
        "notes": ["notes"],
    }.items():
        value = vitals.get(source)
        if value in (None, ""):
            continue
        for fieldname in candidates:
            if has_field("Vital Signs", fieldname):
                doc.set(fieldname, value)
                break
    doc.insert(ignore_permissions=True)
    return doc.name


@frappe.whitelist()
def finish_visit(data=None):
    _ensure_doctor_or_admin()
    if isinstance(data, str):
        data = frappe.parse_json(data)
    data = data or {}
    appointment = data.get("appointment")
    if not appointment:
        frappe.throw("Appointment is required.")

    save_visit_draft(data)
    appt = frappe.get_doc("Patient Appointment", appointment)
    if has_field("Patient Appointment", "status"):
        appt.status = _get_allowed_status("Patient Appointment", "status", ["Closed", "Completed"])
        appt.save(ignore_permissions=True)

    if has_doctype("Clinic Queue") and has_field("Clinic Queue", "appointment"):
        queue_name = frappe.db.get_value("Clinic Queue", {"appointment": appointment}, "name")
        if queue_name:
            q = frappe.get_doc("Clinic Queue", queue_name)
            if has_field("Clinic Queue", "status"):
                q.status = "Sent to Cashier" if _settings_value("auto_create_invoice_on_finish_visit") else "Completed"
            if has_field("Clinic Queue", "consultation_end_time"):
                q.consultation_end_time = now_datetime()
            q.save(ignore_permissions=True)

    invoice = None
    if _settings_value("auto_create_invoice_on_finish_visit"):
        invoice = _create_draft_invoice(appt)

    frappe.db.commit()
    return {"message": "Visit finished", "invoice": invoice, "patient": appt.get("patient")}


def _settings_value(fieldname):
    if has_doctype("NileByte Clinic Settings") and has_field("NileByte Clinic Settings", fieldname):
        try:
            return frappe.db.get_single_value("NileByte Clinic Settings", fieldname)
        except Exception:
            return None
    return None


def _create_draft_invoice(appt):
    if not has_doctype("Sales Invoice"):
        return None
    if has_field("Sales Invoice", "patient"):
        existing = frappe.db.get_value("Sales Invoice", {"patient": appt.get("patient"), "posting_date": nowdate(), "docstatus": ["!=", 2]}, "name")
        if existing:
            return existing
    invoice = frappe.new_doc("Sales Invoice")
    if has_field("Sales Invoice", "patient"):
        invoice.patient = appt.get("patient")
    if has_field("Sales Invoice", "customer"):
        invoice.customer = _customer_from_patient(appt.get("patient"))
    if has_field("Sales Invoice", "posting_date"):
        invoice.posting_date = nowdate()
    if has_field("Sales Invoice", "due_date"):
        invoice.due_date = nowdate()
    item = _settings_value("consultation_item") or _get_or_create_consultation_item()
    rate = flt(_settings_value("consultation_fee"))
    invoice.append("items", {"item_code": item, "qty": 1, "rate": rate})
    invoice.insert(ignore_permissions=True)
    return invoice.name


def _customer_from_patient(patient):
    if not patient or not has_doctype("Patient"):
        return None
    p = frappe.get_doc("Patient", patient)
    if has_field("Patient", "customer") and p.get("customer"):
        return p.get("customer")
    if not has_doctype("Customer"):
        return None
    customer = frappe.new_doc("Customer")
    customer.customer_name = p.get("patient_name") or p.get("first_name") or patient
    customer.customer_type = "Individual"
    if has_field("Customer", "customer_group"):
        customer.customer_group = frappe.db.get_single_value("Selling Settings", "customer_group") or "Individual"
    if has_field("Customer", "territory"):
        customer.territory = frappe.db.get_single_value("Selling Settings", "territory") or "All Territories"
    customer.insert(ignore_permissions=True)
    if has_field("Patient", "customer"):
        frappe.db.set_value("Patient", patient, "customer", customer.name)
    return customer.name


def _get_or_create_consultation_item():
    if not has_doctype("Item"):
        return None
    item = frappe.db.get_value("Item", {"item_name": "Consultation"}, "name")
    if item:
        return item
    doc = frappe.new_doc("Item")
    doc.item_code = "Consultation"
    doc.item_name = "Consultation"
    if has_field("Item", "item_group"):
        doc.item_group = frappe.db.get_value("Item Group", {"is_group": 0}, "name") or "Services"
    if has_field("Item", "stock_uom"):
        doc.stock_uom = "Nos"
    if has_field("Item", "is_stock_item"):
        doc.is_stock_item = 0
    doc.insert(ignore_permissions=True)
    return doc.name


@frappe.whitelist()
def create_followup_appointment(data=None):
    _ensure_doctor_or_admin()
    if isinstance(data, str):
        data = frappe.parse_json(data)
    data = data or {}
    patient = data.get("patient")
    practitioner = data.get("practitioner") or _doctor_for_user()
    date = data.get("followup_date") or data.get("appointment_date")
    time = data.get("appointment_time") or "09:00:00"
    if not patient or not practitioner or not date:
        frappe.throw("Patient, practitioner, and follow-up date are required.")
    doc = frappe.new_doc("Patient Appointment")
    doc.patient = patient
    p = _get_patient_display(patient)
    if has_field("Patient Appointment", "patient_name"):
        doc.patient_name = p.get("display_name")
    if has_field("Patient Appointment", "practitioner"):
        doc.practitioner = practitioner
    if has_field("Patient Appointment", "appointment_date"):
        doc.appointment_date = date
    if has_field("Patient Appointment", "appointment_time"):
        doc.appointment_time = time
    if has_field("Patient Appointment", "status"):
        doc.status = _get_allowed_status("Patient Appointment", "status", ["Scheduled", "Open", "Waiting"])
    if has_field("Patient Appointment", "appointment_type"):
        doc.appointment_type = data.get("appointment_type") or "Follow-Up"
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"message": "Follow-up appointment created", "appointment": doc.name}


@frappe.whitelist()
def get_consultation_templates():
    _ensure_page_access()
    if not has_doctype("Consultation Template"):
        return []
    fields = ["name"]
    for f in ["template_name", "chief_complaint", "diagnosis", "notes", "followup_days"]:
        if has_field("Consultation Template", f):
            fields.append(f)
    filters = {}
    if has_field("Consultation Template", "is_active"):
        filters["is_active"] = 1
    return frappe.get_all("Consultation Template", filters=filters, fields=fields, order_by="modified desc", limit=100)


@frappe.whitelist()
def get_favorite_medications():
    _ensure_page_access()
    if not has_doctype("Doctor Favorite Medication"):
        return []
    fields = ["name"]
    for f in ["medicine_name", "item", "dosage", "frequency", "duration", "instructions"]:
        if has_field("Doctor Favorite Medication", f):
            fields.append(f)
    filters = {}
    practitioner = _doctor_for_user()
    if practitioner and has_field("Doctor Favorite Medication", "practitioner"):
        filters["practitioner"] = practitioner
    if has_field("Doctor Favorite Medication", "is_active"):
        filters["is_active"] = 1
    return frappe.get_all("Doctor Favorite Medication", filters=filters, fields=fields, order_by="modified desc", limit=100)


@frappe.whitelist()
def get_my_tasks():
    _ensure_page_access()
    tasks = []
    if has_doctype("ToDo"):
        rows = frappe.get_all(
            "ToDo",
            filters={"allocated_to": frappe.session.user, "status": ["!=", "Closed"]},
            fields=["name", "description", "priority", "date"],
            order_by="date asc, modified desc",
            limit=5,
        )
        for row in rows:
            tasks.append({"title": row.description or row.name, "status": row.priority or "Open", "date": str(row.date or "")})
    if tasks:
        return tasks
    return [
        {"title": "Review patient results", "status": "Due Soon", "date": ""},
        {"title": "Sign discharge summary", "status": "Pending", "date": ""},
        {"title": "Respond to patient message", "status": "New", "date": ""},
    ]


@frappe.whitelist()
def get_quick_notes():
    _ensure_page_access()
    return [
        {"note": "Update selected patient's medication"},
        {"note": "Call patient for test results"},
    ]
