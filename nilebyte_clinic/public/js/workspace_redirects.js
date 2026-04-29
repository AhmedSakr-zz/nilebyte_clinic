console.log("NileByte Workspace Redirects Script Loaded");

frappe.router.on('change', () => {
    const route = frappe.get_route();
    if (!route) return;

    const route_str = route.join('/').toLowerCase();
    console.log("Checking route_str:", route_str);
    
    // Flexible matching for variations of the names
    if (route_str.includes('doctor')) {
        // Only redirect if it's a Workspace route, not the Page route itself!
        if (route_str.includes('workspace') && !route_str.includes('doctor-workspace')) {
            console.log("Redirecting to Doctor Workspace Page...");
            frappe.set_route('doctor-workspace');
        }
        else if (route_str === 'workspaces/doctor' || route_str === 'workspace/doctor') {
            console.log("Redirecting to Doctor Workspace Page...");
            frappe.set_route('doctor-workspace');
        }
    } 
    
    if (route_str.includes('reception')) {
        if (route_str.includes('workspace') && !route_str.includes('reception-workspace')) {
            console.log("Redirecting to Reception Workspace Page...");
            frappe.set_route('reception-workspace');
        }
        else if (route_str === 'workspaces/reception' || route_str === 'workspace/reception') {
            console.log("Redirecting to Reception Workspace Page...");
            frappe.set_route('reception-workspace');
        }
    }

    if (route_str.includes('clinic') && route_str.includes('admin')) {
        if (route_str.includes('workspace') || route_str.includes('dashboard')) {
            if (!route_str.includes('clinic-admin-dashboard')) {
                console.log("Redirecting to Clinic Admin Dashboard Page...");
                frappe.set_route('clinic-admin-dashboard');
            }
        }
    }
});

$(document).ready(function() {
    console.log("Sidebar Click Listener Initialized");
    $(document).on('click', '.sidebar-item-container, .standard-sidebar-item, .desk-sidebar-item', function(e) {
        const label = $(this).text().trim().toLowerCase();
        console.log("Clicked Sidebar Item (lowercased):", label);
        
        if (label.includes('doctor')) {
            e.preventDefault();
            frappe.set_route('doctor-workspace');
            return false;
        }
        if (label.includes('reception')) {
            e.preventDefault();
            frappe.set_route('reception-workspace');
            return false;
        }
        if (label.includes('clinic') && label.includes('admin')) {
            e.preventDefault();
            frappe.set_route('clinic-admin-dashboard');
            return false;
        }
    });
});
