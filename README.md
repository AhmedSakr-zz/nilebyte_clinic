### NileByte Clinic

NileByte clinic-specific features for ClinicWiser tenants. 

**About this App:**
This is a custom Frappe app used to add specific business functionality and features to our Frappe server. By maintaining these custom features in this app, we can easily install it on any newly created site (e.g., new ClinicWiser tenants) to instantly provision our business logic and extensions.

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app nilebyte_clinic
```

### UI & UX Architecture

The application uses a **Unified Premium Design System** to provide a consistent, SaaS-like experience across all clinic workspaces.

#### 1. Centralized Styling
- **CSS Source**: `nilebyte_clinic/public/css/nb_clinic_ui.css`
- **Injection**: Loaded globally via `app_include_css` in `hooks.py`.
- **Typography**: Uses **Outfit** for headings and **Inter** for body/UI text.
- **Design Tokens**: Standardized variables for colors (`--nb-primary`, `--nb-danger`, `--nb-success`), spacing, and shadows.

#### 2. Custom Workspaces (SPA Pages)
The application provides a full suite of specialized clinical dashboards built as Frappe Page components:
- **Doctor Workspace**: `/doctor-workspace` (Clinical notes, prescriptions, labs)
- **Reception Workspace**: `/reception-workspace` (Appointments, walk-ins, billing)
- **Nursing Station**: `/nursing-station` (Triage & Vital Signs collection)
- **Laboratory Dashboard**: `/lab-dashboard` (Sample tracking & test result entry)
- **Pharmacy Dashboard**: `/pharmacy-dashboard` (Medication dispensing & stock tracking)
- **Admin Dashboard**: `/clinic-admin-dashboard` (Financial KPIs & system overview)

All pages follow a standard HTML shell (`nb-clinic-app`) which includes a unified sidebar (`nb-sidebar`) and topbar (`nb-topbar`).

#### 3. Workspace Redirection Logic
To ensure users are always directed to the modern clinic UI instead of standard Frappe workspaces:
- **Redirection Script**: `nilebyte_clinic/public/js/nb_redirects_v2.js`
- **Logic**: Automatically intercepts routes and redirects based on user roles:
    - **Doctor** -> Doctor Workspace
    - **Receptionist / Cashier** -> Reception Workspace
    - **Nurse** -> Nursing Station
    - **Lab Technician** -> Lab Dashboard
    - **Pharmacist** -> Pharmacy Dashboard
    - **Clinic Admin** -> Admin Dashboard

#### 4. Developer Guidelines
When adding new features or workspaces:
- **Do NOT** use inline styles or `add_styles()` in JS files.
- **DO** use the shared classes defined in `nb_clinic_ui.css` (e.g., `.nb-card`, `.nb-btn`, `.nb-badge`).
- **Layout**: Maintain the grid-based architecture (`.nb-grid`) to ensure responsiveness.
- **Backend**: Place backend logic in the `.py` file of the corresponding page to keep the dashboard self-contained.

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/nilebyte_clinic
pre-commit install
```

Pre-commit is configured to use the following tools:
- ruff
- eslint
- prettier
- pyupgrade

### License

mit
