// More robust version using Frappe's built-in Router events
frappe.router.on('change', () => {
    const route = frappe.get_route();
    
    // Check if we are landing on a Workspace that should be a Page
    // Frappe routes for Workspaces usually look like ["Workspace", "Doctor Workspace"] 
    // or just ["doctor-workspace"] depending on the version.
    
    if (route) {
        const route_str = route.join('/');
        
        // Match both the Workspace route and the direct slug
        if (route_str === 'Workspace/Doctor Workspace' || route_str === 'doctor-workspace-workspace') {
            frappe.set_route('doctor-workspace');
        } 
        else if (route_str === 'Workspace/Reception Workspace' || route_str === 'reception-workspace-workspace') {
            frappe.set_route('reception-workspace');
        } 
        else if (route_str === 'Workspace/Clinic Admin Dashboard' || route_str === 'clinic-admin-dashboard-workspace') {
            frappe.set_route('clinic-admin-dashboard');
        }
    }
});

// Also keep the click interceptor as a backup, but make it more flexible
$(document).ready(function() {
    $(document).on('click', '.sidebar-item-container, .standard-sidebar-item', function(e) {
        const label = $(this).text().trim();
        
        if (label.includes('Doctor Workspace')) {
            e.preventDefault();
            frappe.set_route('doctor-workspace');
            return false;
        }
        if (label.includes('Reception Workspace')) {
            e.preventDefault();
            frappe.set_route('reception-workspace');
            return false;
        }
        if (label.includes('Clinic Admin Dashboard')) {
            e.preventDefault();
            frappe.set_route('clinic-admin-dashboard');
            return false;
        }
    });
});
