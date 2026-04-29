// Final robust version matching shorter Workspace names
frappe.router.on('change', () => {
    const route = frappe.get_route();
    
    if (route) {
        const route_str = route.join('/');
        
        // Match the new shorter Workspace routes
        if (route_str === 'Workspace/Doctor' || route_str === 'doctor') {
            frappe.set_route('doctor-workspace');
        } 
        else if (route_str === 'Workspace/Reception' || route_str === 'reception') {
            frappe.set_route('reception-workspace');
        } 
        else if (route_str === 'Workspace/Clinic Admin' || route_str === 'clinic-admin') {
            frappe.set_route('clinic-admin-dashboard');
        }
    }
});

// Sidebar Click Backup
$(document).ready(function() {
    $(document).on('click', '.sidebar-item-container, .standard-sidebar-item', function(e) {
        const label = $(this).text().trim();
        
        if (label === 'Doctor') {
            e.preventDefault();
            frappe.set_route('doctor-workspace');
            return false;
        }
        if (label === 'Reception') {
            e.preventDefault();
            frappe.set_route('reception-workspace');
            return false;
        }
        if (label === 'Clinic Admin') {
            e.preventDefault();
            frappe.set_route('clinic-admin-dashboard');
            return false;
        }
    });
});
