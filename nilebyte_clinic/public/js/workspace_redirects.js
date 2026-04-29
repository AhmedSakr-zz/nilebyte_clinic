console.log("NileByte Workspace Redirects Script Loaded");

frappe.router.on('change', () => {
    const route = frappe.get_route();
    console.log("Current Route:", route);
    
    if (route) {
        const route_str = route.join('/');
        
        if (route_str === 'Workspace/Doctor' || route_str === 'doctor') {
            console.log("Redirecting to Doctor Workspace Page...");
            frappe.set_route('doctor-workspace');
        } 
        else if (route_str === 'Workspace/Reception' || route_str === 'reception') {
            console.log("Redirecting to Reception Workspace Page...");
            frappe.set_route('reception-workspace');
        } 
        else if (route_str === 'Workspace/Clinic Admin' || route_str === 'clinic-admin') {
            console.log("Redirecting to Clinic Admin Dashboard Page...");
            frappe.set_route('clinic-admin-dashboard');
        }
    }
});

$(document).ready(function() {
    console.log("Sidebar Click Listener Initialized");
    $(document).on('click', '.sidebar-item-container, .standard-sidebar-item, .desk-sidebar-item', function(e) {
        const label = $(this).text().trim();
        console.log("Clicked Sidebar Item:", label);
        
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
