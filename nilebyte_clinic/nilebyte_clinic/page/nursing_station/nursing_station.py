import frappe
from frappe.utils import nowdate, nowtime

@frappe.whitelist()
def get_nursing_dashboard():
    return {
        "stats": get_stats(),
        "queue": get_triage_queue(),
    }

def get_stats():
    return {
        "waiting": frappe.db.count("Patient Appointment", {"status": "Arrived", "appointment_date": nowdate()}),
        "completed": frappe.db.count("Vital Signs", {"docstatus": 1, "posting_date": nowdate()}),
    }

@frappe.whitelist()
def get_triage_queue():
    # Fetch patients who have arrived but haven't seen the doctor yet
    appointments = frappe.get_all(
        "Patient Appointment",
        filters={
            "appointment_date": nowdate(),
            "status": ["in", ["Arrived", "Waiting"]],
        },
        fields=["name", "patient", "patient_name", "appointment_time", "status", "practitioner_name"],
        order_by="appointment_time asc"
    )
    return appointments

@frappe.whitelist()
def save_vitals(appointment, patient, vitals):
    vitals = frappe.parse_json(vitals)
    
    # Create Vital Signs record if the DocType exists
    if frappe.db.exists("DocType", "Vital Signs"):
        vs = frappe.new_doc("Vital Signs")
        vs.patient = patient
        vs.appointment = appointment
        vs.posting_date = nowdate()
        vs.posting_time = nowtime()
        
        # Map fields
        vs.bp = vitals.get("bp")
        vs.pulse = vitals.get("pulse")
        vs.temperature = vitals.get("temperature")
        vs.weight = vitals.get("weight")
        vs.height = vitals.get("height")
        vs.spo2 = vitals.get("spo2")
        vs.bmi = vitals.get("bmi")
        
        vs.insert(ignore_permissions=True)
        vs.submit()
        
        # Optional: Mark appointment as "Triage Completed" if such status exists
        # For now, we'll just return success
        return {"message": "Vitals saved and submitted", "name": vs.name}
    else:
        # Fallback: Save to a note or a custom field if Vital Signs is missing
        return {"message": "Vital Signs DocType not found. Vitals not saved."}

@frappe.whitelist()
def search_patient(query):
    return frappe.get_all(
        "Patient",
        filters=["or", [["patient_name", "like", f"%{query}%"]], [["name", "like", f"%{query}%"]]],
        fields=["name", "patient_name", "mobile", "gender", "dob"],
        limit=10
    )
