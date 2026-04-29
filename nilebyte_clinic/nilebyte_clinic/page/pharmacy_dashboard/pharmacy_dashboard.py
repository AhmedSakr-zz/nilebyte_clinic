import frappe
from frappe.utils import nowdate, nowtime

@frappe.whitelist()
def get_pharmacy_dashboard():
    return {
        "stats": get_stats(),
        "prescriptions": get_pending_prescriptions(),
    }

def has_field(doctype, fieldname):
    return frappe.db.has_column(doctype, fieldname)

def get_stats():
    stats = {"pending": 0, "dispensed_today": 0}
    if not frappe.db.exists("DocType", "Drug Prescription"):
        return stats
        
    stats["pending"] = frappe.db.count("Drug Prescription", {"status": "Pending"})
    
    filters = {"status": "Dispensed"}
    for f in ["modified", "creation"]:
        if has_field("Drug Prescription", f):
            filters[f] = [">", nowdate()]
            break
            
    stats["dispensed_today"] = frappe.db.count("Drug Prescription", filters)
    return stats

@frappe.whitelist()
def get_pending_prescriptions():
    if not frappe.db.exists("DocType", "Drug Prescription"):
        return []
        
    fields = ["name", "patient", "patient_name", "status"]
    for f in ["parent", "drug_code", "drug_name", "dosage", "period"]:
        if has_field("Drug Prescription", f):
            fields.append(f if f != "parent" else "parent as encounter")
            
    return frappe.get_all(
        "Drug Prescription",
        filters={"status": "Pending"},
        fields=fields,
        order_by="creation desc"
    )

@frappe.whitelist()
def dispense_drug(prescription_id):
    if not frappe.db.exists("Drug Prescription", prescription_id):
        frappe.throw("Prescription not found")
        
    doc = frappe.get_doc("Drug Prescription", prescription_id)
    doc.status = "Dispensed"
    doc.save(ignore_permissions=True)
    return {"message": f"Medication {doc.drug_name if hasattr(doc, 'drug_name') else doc.name} marked as dispensed."}

@frappe.whitelist()
def get_drug_info(drug_code):
    stock = 0
    if frappe.db.exists("Bin", {"item_code": drug_code}):
        stock = frappe.db.get_value("Bin", {"item_code": drug_code}, "actual_qty") or 0
    return {"stock": stock}
