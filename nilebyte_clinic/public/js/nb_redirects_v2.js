console.log("NileByte Workspace Redirects V2 Loaded");

frappe.router.on('change', () => {
    const route = frappe.get_route();
    if (!route) return;

    const route_str = route.join('/').toLowerCase();
    console.log("Checking route_str:", route_str);
    
    // Doctor
    if (route_str.includes('doctor') && !route_str.includes('doctor-workspace')) {
        if (route_str === 'doctor' || route_str.includes('workspace')) {
             frappe.set_route('doctor-workspace');
        }
    } 
    
    // Reception
    if (route_str.includes('reception') && !route_str.includes('reception-workspace')) {
        if (route_str === 'reception' || route_str.includes('workspace')) {
            frappe.set_route('reception-workspace');
        }
    }

    // Clinic Admin
    if (route_str.includes('clinic') && route_str.includes('admin') && !route_str.includes('clinic-admin-dashboard')) {
        if (route_str.includes('workspace') || route_str.includes('dashboard')) {
            frappe.set_route('clinic-admin-dashboard');
        }
    }

    // Nursing Station
    if (route_str.includes('nursing') && !route_str.includes('nursing-station')) {
        // Any route starting with nursing or nursing/something that isn't the station
        frappe.set_route('nursing-station');
    }

    // Laboratory
    if (route_str.includes('lab') && !route_str.includes('lab-dashboard')) {
        // Covers 'lab', 'laboratory', and 'workspaces/lab'
        if (route_str.includes('lab') || route_str.includes('laboratory')) {
            // Only redirect if it's the base route or a workspace/dashboard container
            if (route_str === 'lab' || route_str === 'laboratory' || route_str.includes('workspace') || route_str.includes('dashboard')) {
                frappe.set_route('lab-dashboard');
            }
        }
    }

    // Pharmacy
    if (route_str.includes('pharmacy') && !route_str.includes('pharmacy-dashboard')) {
        frappe.set_route('pharmacy-dashboard');
    }
});

$(document).ready(function() {
    console.log("Sidebar Click Listener V2 Initialized");
    $(document).on('click', '.sidebar-item-container, .standard-sidebar-item, .desk-sidebar-item', function(e) {
        const label = $(this).text().trim().toLowerCase();
        
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
        if (label.includes('nursing') || label.includes('nurse')) {
            e.preventDefault();
            frappe.set_route('nursing-station');
            return false;
        }
        if (label.includes('laboratory') || label.includes('lab')) {
            e.preventDefault();
            frappe.set_route('lab-dashboard');
            return false;
        }
        if (label.includes('pharmacy')) {
            e.preventDefault();
            frappe.set_route('pharmacy-dashboard');
            return false;
        }
    });
});
