import frappe
from frappe.utils import nowdate, nowtime

@frappe.whitelist()
def get_lab_dashboard():
    return {
        "stats": get_stats(),
        "tests": get_lab_tests(),
    }

def get_stats():
    return {
        "requested": frappe.db.count("Lab Test", {"status": "Requested"}),
        "collected": frappe.db.count("Lab Test", {"status": "Sample Collected"}),
        "completed_today": frappe.db.count("Lab Test", {"status": "Completed", "result_date": nowdate()}),
    }

@frappe.whitelist()
def get_lab_tests():
    return frappe.get_all(
        "Lab Test",
        filters={"status": ["in", ["Requested", "Sample Collected"]]},
        fields=["name", "patient", "patient_name", "lab_test_name", "status", "request_date", "practitioner_name"],
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
    
    # In standard Frappe Health, Lab Test has a child table 'normal_values' 
    # where results are stored. We'll try to update it or the main result field.
    test.result_date = nowdate()
    test.result_time = nowtime()
    test.status = "Completed"
    
    # Simple result entry if no child table is used or for custom fields
    if hasattr(test, "result_value"):
        test.result_value = result_data.get("value")
    
    # If the user provided a summary/note
    if result_data.get("notes"):
        test.lab_test_comment = result_data.get("notes")
        
    test.save(ignore_permissions=True)
    test.submit()
    return {"message": "Results submitted successfully"}
