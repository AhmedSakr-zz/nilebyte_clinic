import frappe
from frappe.utils import nowdate, nowtime

@frappe.whitelist()
def get_nursing_dashboard():
    return {
        "stats": get_stats(),
        "queue": get_triage_queue(),
    }

def has_field(doctype, fieldname):
    return frappe.db.has_column(doctype, fieldname)

def get_stats():
    stats = {
        "waiting": frappe.db.count("Patient Appointment", {"status": "Arrived", "appointment_date": nowdate()}),
        "completed": 0
    }
    
    # Defensive check for Vital Signs stats
    if frappe.db.exists("DocType", "Vital Signs"):
        filters = {"docstatus": 1}
        # Try different date fields
        for f in ["posting_date", "date", "creation"]:
            if has_field("Vital Signs", f):
                if f == "creation":
                    filters[f] = [">", nowdate()]
                else:
                    filters[f] = nowdate()
                break
        stats["completed"] = frappe.db.count("Vital Signs", filters)
        
    return stats

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
        if has_field("Vital Signs", "appointment"):
            vs.appointment = appointment
            
        if has_field("Vital Signs", "posting_date"):
            vs.posting_date = nowdate()
        elif has_field("Vital Signs", "date"):
            vs.date = nowdate()
            
        if has_field("Vital Signs", "posting_time"):
            vs.posting_time = nowtime()
        
        # Map fields
        field_map = {
            "bp": ["bp", "blood_pressure"],
            "pulse": ["pulse"],
            "temperature": ["temperature", "temp"],
            "weight": ["weight"],
            "height": ["height"],
            "spo2": ["spo2"],
            "bmi": ["bmi"]
        }
        
        for key, targets in field_map.items():
            val = vitals.get(key)
            if val:
                for t in targets:
                    if has_field("Vital Signs", t):
                        vs.set(t, val)
                        break
        
        vs.insert(ignore_permissions=True)
        vs.submit()
        
        return {"message": "Vitals saved and submitted", "name": vs.name}
    else:
        return {"message": "Vital Signs DocType not found. Vitals not saved."}

@frappe.whitelist()
def search_patient(query):
    return frappe.get_all(
        "Patient",
        filters=["or", [["patient_name", "like", f"%{query}%"]], [["name", "like", f"%{query}%"]]],
        fields=["name", "patient_name", "mobile", "gender", "dob"],
        limit=10
    )
