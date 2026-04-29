console.log("NileByte Workspace Redirects V2 Loaded");

frappe.router.on('change', () => {
    const route = frappe.get_route();
    if (!route) return;

    const route_str = route.join('/').toLowerCase();
    console.log("Checking route_str:", route_str);
    
    let target = null;

    // Doctor
    if (route_str.includes('doctor') && !route_str.includes('doctor-workspace')) {
        if (route_str === 'doctor' || route_str.includes('workspace')) {
             target = 'doctor-workspace';
        }
    } 
    
    // Reception
    if (route_str.includes('reception') && !route_str.includes('reception-workspace')) {
        if (route_str === 'reception' || route_str.includes('workspace')) {
            target = 'reception-workspace';
        }
    }

    // Clinic Admin
    if (route_str.includes('clinic') && route_str.includes('admin') && !route_str.includes('clinic-admin-dashboard')) {
        if (route_str.includes('workspace') || route_str.includes('dashboard')) {
            target = 'clinic-admin-dashboard';
        }
    }

    // Nursing Station
    if (route_str.includes('nursing') && !route_str.includes('nursing-station')) {
        target = 'nursing-station';
    }

    // Laboratory
    if (route_str.includes('lab') && !route_str.includes('lab-dashboard')) {
        if (route_str === 'lab' || route_str === 'laboratory' || route_str.includes('workspace') || route_str.includes('dashboard')) {
            target = 'lab-dashboard';
        }
    }

    // Pharmacy
    if (route_str.includes('pharmacy') && !route_str.includes('pharmacy-dashboard')) {
        target = 'pharmacy-dashboard';
    }

    if (target) {
        console.log(`>>> NileByte Redirecting: ${route_str} -> ${target}`);
        setTimeout(() => {
            frappe.set_route(target);
        }, 100);
    }
});

$(document).ready(function() {
    console.log("Sidebar Click Listener V2 Initialized");
    $(document).on('click', '.sidebar-item-container, .standard-sidebar-item, .desk-sidebar-item', function(e) {
        const label = $(this).text().trim().toLowerCase();
        
        let target = null;
        if (label.includes('doctor')) target = 'doctor-workspace';
        if (label.includes('reception')) target = 'reception-workspace';
        if (label.includes('clinic') && label.includes('admin')) target = 'clinic-admin-dashboard';
        if (label.includes('nursing') || label.includes('nurse')) target = 'nursing-station';
        if (label.includes('laboratory') || label.includes('lab')) target = 'lab-dashboard';
        if (label.includes('pharmacy')) target = 'pharmacy-dashboard';

        if (target) {
            e.preventDefault();
            frappe.set_route(target);
            return false;
        }
    });
});
