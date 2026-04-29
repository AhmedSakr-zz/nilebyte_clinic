import frappe
from frappe.utils import nowdate, nowtime

@frappe.whitelist()
def get_lab_dashboard():
    return {
        "stats": get_stats(),
        "tests": get_lab_tests(),
    }

def has_field(doctype, fieldname):
    return frappe.db.has_column(doctype, fieldname)

def get_stats():
    stats = {"requested": 0, "collected": 0, "completed_today": 0}
    if not frappe.db.exists("DocType", "Lab Test"):
        return stats
        
    stats["requested"] = frappe.db.count("Lab Test", {"status": "Requested"})
    stats["collected"] = frappe.db.count("Lab Test", {"status": "Sample Collected"})
    
    # Defensive check for completed today
    filters = {"status": "Completed"}
    for f in ["result_date", "posting_date", "date", "creation"]:
        if has_field("Lab Test", f):
            if f == "creation":
                filters[f] = [">", nowdate()]
            else:
                filters[f] = nowdate()
            break
    stats["completed_today"] = frappe.db.count("Lab Test", filters)
    
    return stats

@frappe.whitelist()
def get_lab_tests():
    if not frappe.db.exists("DocType", "Lab Test"):
        return []
        
    fields = ["name", "patient", "patient_name", "status"]
    for f in ["lab_test_name", "request_date", "practitioner_name"]:
        if has_field("Lab Test", f):
            fields.append(f)
            
    return frappe.get_all(
        "Lab Test",
        filters={"status": ["in", ["Requested", "Sample Collected"]]},
        fields=fields,
        order_by="creation desc"
    )

@frappe.whitelist()
def collect_sample(test_id):
    test = frappe.get_doc("Lab Test", test_id)
    test.status = "Sample Collected"
    test.save(ignore_permissions=True)
    return {"message": "Sample marked as collected"}

@frappe.whitelist()
def submit_result(test_id, result_data):
    result_data = frappe.parse_json(result_data)
    test = frappe.get_doc("Lab Test", test_id)
    
    if has_field("Lab Test", "result_date"):
        test.result_date = nowdate()
    if has_field("Lab Test", "result_time"):
        test.result_time = nowtime()
        
    test.status = "Completed"
    
    # Simple result entry if no child table is used or for custom fields
    if hasattr(test, "result_value"):
        test.result_value = result_data.get("value")
    
    # If the user provided a summary/note
    if result_data.get("notes"):
        if hasattr(test, "lab_test_comment"):
            test.lab_test_comment = result_data.get("notes")
        elif hasattr(test, "remarks"):
            test.remarks = result_data.get("notes")
        
    test.save(ignore_permissions=True)
    test.submit()
    return {"message": "Results submitted successfully"}
