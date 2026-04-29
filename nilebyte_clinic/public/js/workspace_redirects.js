$(document).ready(function() {
    // Intercept clicks on the sidebar items to instantly redirect to our Custom Pages
    // instead of loading the empty Workspace.
    $(document).on('click', '.standard-sidebar-item, .sidebar-item-container, .desk-sidebar-item', function(e) {
        let item_label = $(this).text().trim();
        
        if (item_label === 'Doctor Workspace') {
            e.preventDefault();
            e.stopPropagation();
            frappe.set_route('doctor-workspace');
            return false;
        }
        else if (item_label === 'Reception Workspace') {
            e.preventDefault();
            e.stopPropagation();
            frappe.set_route('reception-workspace');
            return false;
        }
        else if (item_label === 'Clinic Admin Dashboard') {
            e.preventDefault();
            e.stopPropagation();
            frappe.set_route('clinic-admin-dashboard');
            return false;
        }
    });
});
