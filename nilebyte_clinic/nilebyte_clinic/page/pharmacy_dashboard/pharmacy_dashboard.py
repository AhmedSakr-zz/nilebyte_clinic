import frappe
from frappe.utils import nowdate, nowtime

@frappe.whitelist()
def get_pharmacy_dashboard():
    return {
        "stats": get_stats(),
        "prescriptions": get_pending_prescriptions(),
    }

def get_stats():
    return {
        "pending": frappe.db.count("Drug Prescription", {"status": "Pending"}),
        "dispensed_today": frappe.db.count("Drug Prescription", {"status": "Dispensed", "modified": [">", nowdate()]}),
    }

@frappe.whitelist()
def get_pending_prescriptions():
    # Fetch pending prescriptions from encounters
    # Note: In Frappe Health, prescriptions are child table entries of Patient Encounter.
    # We might need to fetch the child records directly or through the parent.
    if frappe.db.exists("DocType", "Drug Prescription"):
        return frappe.get_all(
            "Drug Prescription",
            filters={"status": "Pending"},
            fields=["name", "parent as encounter", "patient", "patient_name", "drug_code", "drug_name", "dosage", "period", "status"],
            order_by="creation desc"
        )
    return []

@frappe.whitelist()
def dispense_drug(prescription_id):
    if not frappe.db.exists("Drug Prescription", prescription_id):
        frappe.throw("Prescription not found")
        
    doc = frappe.get_doc("Drug Prescription", prescription_id)
    doc.status = "Dispensed"
    doc.save(ignore_permissions=True)
    
    # Optional: Log a stock entry here if required by standard clinic inventory flow
    return {"message": f"Medication {doc.drug_name} marked as dispensed."}

@frappe.whitelist()
def get_drug_info(drug_code):
    # Fetch stock level from Item/Bin
    stock = 0
    if frappe.db.exists("Bin", {"item_code": drug_code}):
        stock = frappe.db.get_value("Bin", {"item_code": drug_code}, "actual_qty") or 0
    return {"stock": stock}
