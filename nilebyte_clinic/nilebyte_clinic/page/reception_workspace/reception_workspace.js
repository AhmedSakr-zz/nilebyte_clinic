frappe.pages["reception-workspace"].on_page_load = function (wrapper) {
  new NBReceptionWorkspace(wrapper);
};

class NBReceptionWorkspace {
  constructor(wrapper) {
    this.wrapper = wrapper;
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: "Reception Workspace",
      single_column: true,
    });

    this.search_timer = null;
    this.active_filter = "all";
    this.queue_rows = [];
    this.billing_summary = {};
    this.selected_patient = null;

    this.render();
    this.setup_link_controls();
    this.bind_events();
    this.load_all();

    this.refresh_interval = setInterval(() => this.load_all(false), 30000);
  }

  render() {
    $(this.page.body).html(`
      <div class="nb-clinic-app">
        <aside class="nb-sidebar">
          <div class="nb-brand">
            <div class="nb-brand-logo">✦</div>
            <div class="nb-brand-text">
              <div class="nb-brand-title">ClinicWiser</div>
              <div class="nb-brand-sub">Reception Desk</div>
            </div>
          </div>
          <nav class="nb-nav">
            <button class="nb-nav-item active" data-nav="dashboard">
              <span class="nb-nav-icon">⌂</span>
              <span class="nb-nav-text">Dashboard</span>
            </button>
            <button class="nb-nav-item" data-nav="appointments">
              <span class="nb-nav-icon">📅</span>
              <span class="nb-nav-text">Appointments</span>
            </button>
            <button class="nb-nav-item" data-nav="patients">
              <span class="nb-nav-icon">👤</span>
              <span class="nb-nav-text">Patients</span>
            </button>
            <button class="nb-nav-item" data-nav="billing">
              <span class="nb-nav-icon">💳</span>
              <span class="nb-nav-text">Billing</span>
            </button>
            <button class="nb-nav-item" data-nav="reports">
              <span class="nb-nav-icon">▥</span>
              <span class="nb-nav-text">Reports</span>
            </button>
            <button class="nb-nav-item" data-nav="settings">
              <span class="nb-nav-icon">⚙</span>
              <span class="nb-nav-text">Settings</span>
            </button>
          </nav>
        </aside>

        <main class="nb-main">
          <header class="nb-topbar">
            <div class="nb-page-title">
              <h1>Reception Dashboard</h1>
              <p>Clinic Operations Overview</p>
            </div>
            <div class="nb-top-actions">
              <div class="nb-search-bar">
                <span class="nb-search-icon">⌕</span>
                <input id="nb-global-search" placeholder="Search patients or appointments..." autocomplete="off" />
                <div id="nb-global-results" class="nb-global-results"></div>
              </div>
              <div style="display:flex; gap:10px;">
                <button class="nb-btn nb-btn-secondary" id="nb-header-book">Book Appt</button>
                <button class="nb-btn nb-btn-primary" id="nb-new-patient">+ New Patient</button>
              </div>
              <div class="nb-user-profile">
                <div class="nb-avatar">${this.initials(frappe.session.user_fullname || "R")}</div>
              </div>
            </div>
          </header>

          <div class="nb-content nb-fade-in">
            <div id="nb-kpis" class="nb-kpis"></div>

            <div class="nb-grid nb-grid-2">
              <section class="nb-card">
                <div class="nb-card-header">
                  <h3>Today's Schedule</h3>
                  <button class="nb-btn nb-btn-secondary btn-xs" id="nb-open-calendar">Full Calendar</button>
                </div>
                <div id="nb-calendar" class="nb-rw-calendar" style="height: 350px;"></div>
              </section>

              <div class="nb-grid" style="gap: 20px;">
                <section class="nb-card" style="margin: 0;">
                  <div class="nb-card-header"><h3>Quick Patient Search</h3></div>
                  <div class="nb-search-bar" style="width: 100%; margin: 16px;">
                    <input id="nb-patient-search" placeholder="Search by name, phone, or ID..." autocomplete="off" />
                    <div id="nb-patient-results" class="nb-quick-results"></div>
                  </div>
                </section>
                <div id="nb-patient-preview">
                    <div class="nb-card" style="margin: 0; display: flex; align-items: center; justify-content: center; min-height: 180px; color: var(--nb-text-muted);">
                        Search for a patient to see details
                    </div>
                </div>
              </div>
            </div>

            <div class="nb-grid nb-grid-3">
              <section class="nb-card">
                <div class="nb-card-header"><h3>Register Walk-In</h3></div>
                <div class="nb-form-grid" style="padding: 16px;">
                  <div style="margin-bottom: 15px;">
                    <label style="display:block; margin-bottom: 5px; font-weight: 700;">Patient</label>
                    <div id="nb-walkin-patient"></div>
                  </div>
                  <div style="margin-bottom: 15px;">
                    <label style="display:block; margin-bottom: 5px; font-weight: 700;">Doctor</label>
                    <div id="nb-walkin-practitioner"></div>
                  </div>
                  <button class="nb-btn nb-btn-primary w-100" id="nb-register-walkin">Register Now</button>
                </div>
              </section>

              <section class="nb-card">
                <div class="nb-card-header">
                  <h3>Billing</h3>
                  <div class="nb-tabs" style="padding: 0;">
                    <button class="active" data-bill-tab="pending" style="font-size: 11px;">Pending</button>
                    <button data-bill-tab="paid" style="font-size: 11px;">Paid</button>
                  </div>
                </div>
                <div id="nb-billing-list" style="padding: 16px;"></div>
              </section>

              <section class="nb-card">
                <div class="nb-card-header"><h3>Today's Stats</h3></div>
                <div id="nb-today-stats" style="padding: 16px;"></div>
              </section>
            </div>

            <section class="nb-card">
              <div class="nb-card-header">
                <h3>Queue Management</h3>
                <div class="nb-filter-bar">
                  <button class="active" data-filter="all">All</button>
                  <button data-filter="waiting">Waiting</button>
                  <button data-filter="with_doctor">With Doctor</button>
                  <button data-filter="completed">Completed</button>
                </div>
              </div>
              <div id="nb-queue-table" class="nb-table-container"></div>
            </section>
          </div>
          <div class="nb-last-updated" style="margin-top: 32px; opacity: 0.6; text-align: center;">
            Last sync: <span id="nb-last-updated">--</span>
          </div>
        </main>
      </div>
    `);
  }

  setup_link_controls() {
    this.walkin_patient = frappe.ui.form.make_control({
      parent: $("#nb-walkin-patient"),
      df: { fieldtype: "Link", options: "Patient", fieldname: "walkin_patient", placeholder: "Select patient" },
      render_input: true,
    });
    this.walkin_practitioner = frappe.ui.form.make_control({
      parent: $("#nb-walkin-practitioner"),
      df: { fieldtype: "Link", options: "Healthcare Practitioner", fieldname: "walkin_practitioner", placeholder: "Select doctor" },
      render_input: true,
    });
  }

  bind_events() {
    $(this.wrapper).on("click", ".nb-nav-item", (e) => {
      const nav = $(e.currentTarget).data("nav");
      this.handle_sidebar_nav(nav);
    });

    $("#nb-global-search, #nb-patient-search").on("input", (e) => {
      clearTimeout(this.search_timer);
      const query = $(e.currentTarget).val().trim();
      this.search_timer = setTimeout(() => this.search_patients(query), 250);
    });

    $("#nb-open-calendar").on("click", () => frappe.set_route("List", "Patient Appointment"));
    $("#nb-header-book").on("click", () => this.book_appointment_dialog());
    $("#nb-register-walkin").on("click", () => this.register_walkin());
    $("#nb-new-patient").on("click", () => this.new_patient_dialog());

    $(".nb-tabs button").on("click", (e) => {
      $(".nb-tabs button").removeClass("active");
      $(e.currentTarget).addClass("active");
      this.render_billing($(e.currentTarget).data("bill-tab"));
    });

    $(".nb-filter-bar button").on("click", (e) => {
      $(".nb-filter-bar button").removeClass("active");
      $(e.currentTarget).addClass("active");
      this.active_filter = $(e.currentTarget).data("filter");
      this.load_queue(true);
    });

    $(document).on("click", (e) => {
      if (!$(e.target).closest(".nb-search-bar").length) {
        $("#nb-global-results,#nb-patient-results").hide();
      }
    });

    $(this.wrapper).on("click", "#nb-preview-book", () => {
      if (this.selected_patient) this.book_appointment_dialog(this.selected_patient.name);
    });
  }

  handle_sidebar_nav(nav) {
    if (!nav) return;
    $(".nb-nav-item").removeClass("active");
    $(`.nb-nav-item[data-nav='${nav}']`).addClass("active");

    if (nav === "dashboard") {
      this.load_all(false);
      return;
    }

    const routes = {
      appointments: ["List", "Patient Appointment"],
      patients: ["List", "Patient"],
      billing: ["List", "Sales Invoice"],
      reports: ["query-report", "Daily Clinic Summary"],
      settings: ["Form", "NileByte Clinic Settings", "NileByte Clinic Settings"],
    };

    if (routes[nav]) {
      frappe.set_route(...routes[nav]);
    }
  }

  load_all(show_loading = true) {
    this.load_billing_summary();
    this.load_queue(show_loading);
    this.set_updated();
  }

  call(method, args = {}, callback = null) {
    frappe.call({
      method: "nilebyte_clinic.nilebyte_clinic.page.reception_workspace.reception_workspace." + method,
      args,
      freeze: false,
      callback: (r) => callback && callback(r.message),
    });
  }

  load_billing_summary() {
    this.call("get_billing_summary", {}, (data) => {
      this.billing_summary = data || {};
      this.load_stats();
    });
  }

  load_stats() {
    this.call("get_dashboard_stats", {}, (data) => {
      data = data || {};
      const cards = [
        { label: "Today Appointments", value: data.today || 0, icon: "📅", color: "blue" },
        { label: "Waiting", value: data.waiting || 0, icon: "⏱", color: "orange" },
        { label: "With Doctor", value: data.with_doctor || 0, icon: "👨‍⚕️", color: "sky" },
        { label: "Completed", value: data.completed || 0, icon: "✓", color: "green" },
      ];
      $("#nb-kpis").html(cards.map(c => `
        <div class="nb-kpi-card">
          <div class="nb-kpi-icon" style="background:var(--nb-primary)">${c.icon}</div>
          <div class="nb-kpi-info">
            <h4>${c.label}</h4>
            <div class="nb-kpi-value">${this.esc(c.value)}</div>
          </div>
        </div>
      `).join(""));
      this.render_today_stats(data);
    });
  }

  load_queue(show_loading = true) {
    if (show_loading) {
      $("#nb-queue-table").html(`<div class="nb-empty-soft">Loading queue...</div>`);
    }
    this.call("get_today_queue", { filter: this.active_filter }, (rows) => {
      this.queue_rows = rows || [];
      this.render_queue_table(this.queue_rows);
      this.render_calendar(this.queue_rows);
      this.render_billing($(".nb-tabs button.active").data("bill-tab") || "pending");
    });
  }

  render_calendar(rows) {
    const hours = ["09:00", "10:00", "11:00", "12:00", "13:00"];
    $("#nb-calendar").html(`
      <div style="display:flex; flex-direction:column; gap:10px; padding:15px;">
        ${hours.map(h => `
          <div style="display:flex; align-items:center; gap:15px; border-bottom:1px solid var(--nb-border); padding-bottom:5px;">
            <span style="font-size:12px; color:var(--nb-text-muted); width:40px;">${h}</span>
            <div style="flex:1; height:30px; background:var(--nb-surface); border-radius:4px;"></div>
          </div>
        `).join("")}
      </div>
    `);
  }

  render_queue_table(rows) {
    if (!rows.length) {
      $("#nb-queue-table").html(`<div class="nb-empty-soft">No appointments found.</div>`);
      return;
    }
    $("#nb-queue-table").html(`
      <table class="nb-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Patient</th>
            <th>Doctor</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${this.esc(row.time)}</td>
              <td><b>${this.esc(row.patient_name || row.patient)}</b></td>
              <td>${this.esc(row.practitioner_name || row.practitioner)}</td>
              <td><span class="nb-badge nb-badge-blue">${this.esc(row.status)}</span></td>
              <td>
                <div style="display:flex; gap:5px;">
                  <button class="nb-btn nb-btn-secondary btn-xs" data-action="check_in" data-name="${this.esc(row.name)}">Arrived</button>
                  <button class="nb-btn nb-btn-primary btn-xs" data-action="invoice" data-name="${this.esc(row.name)}">Invoice</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `);
    $("#nb-queue-table [data-action]").on("click", (e) => {
      this.queue_action($(e.currentTarget).data("action"), $(e.currentTarget).data("name"));
    });
  }

  render_billing(tab = "pending") {
    let rows = this.queue_rows.filter(r => tab === "paid" ? r.payment_status === "Paid" : r.payment_status !== "Paid");
    rows = rows.slice(0, 5);
    if (!rows.length) {
      $("#nb-billing-list").html(`<div class="nb-empty-soft">No records found.</div>`);
      return;
    }
    $("#nb-billing-list").html(rows.map(r => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--nb-border);">
        <div>
          <div style="font-weight:700;">${this.esc(r.patient_name || r.patient)}</div>
          <div style="font-size:11px; color:var(--nb-text-muted);">${this.esc(r.name)}</div>
        </div>
        <button class="nb-btn nb-btn-primary btn-xs" data-action="invoice" data-name="${this.esc(r.name)}">Invoice</button>
      </div>
    `).join(""));
    $("#nb-billing-list [data-action='invoice']").on("click", (e) => this.queue_action("create_invoice", $(e.currentTarget).data("name")));
  }

  render_today_stats(data) {
    $("#nb-today-stats").html(`
      <div style="display:grid; gap:12px;">
        <div style="display:flex; justify-content:space-between;"><span>Completed</span><b>${data.completed || 0}</b></div>
        <div style="display:flex; justify-content:space-between;"><span>Waiting</span><b>${data.waiting || 0}</b></div>
        <div style="display:flex; justify-content:space-between;"><span>Revenue</span><b>${this.format_currency(this.billing_summary.paid_today_amount || 0)}</b></div>
      </div>
    `);
  }

  search_patients(query) {
    const target = document.activeElement.id === "nb-patient-search" ? "#nb-patient-results" : "#nb-global-results";
    if (!query || query.length < 2) {
      $(target).hide();
      return;
    }
    this.call("search_patient", { query }, (rows) => {
      if (!rows || !rows.length) {
        $(target).html(`<div style="padding:10px;">No results</div>`).show();
        return;
      }
      $(target).html(rows.map(p => `
        <div class="nb-global-item" data-patient="${this.esc(p.name)}" style="padding:10px; cursor:pointer; border-bottom:1px solid var(--nb-border);">
          <b>${this.esc(p.patient_name || p.name)}</b>
          <div style="font-size:11px; color:var(--nb-text-muted);">${this.esc(p.name)}</div>
        </div>
      `).join("")).show();
      $(`${target} .nb-global-item`).on("click", (e) => {
        const name = $(e.currentTarget).data("patient");
        this.selected_patient = rows.find(p => p.name === name);
        this.render_patient_preview(this.selected_patient);
        $(target).hide();
      });
    });
  }

  render_patient_preview(p) {
    $("#nb-patient-preview").html(`
      <div class="nb-card" style="margin:0; padding:15px;">
        <div style="display:flex; gap:15px; align-items:center; margin-bottom:15px;">
          <div class="nb-avatar">${this.initials(p.patient_name || p.name)}</div>
          <div>
            <div style="font-weight:800; font-size:16px;">${this.esc(p.patient_name || p.name)}</div>
            <div style="color:var(--nb-text-muted); font-size:12px;">${this.esc(p.name)}</div>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <button class="nb-btn nb-btn-primary" id="nb-preview-book">Book Appt</button>
          <button class="nb-btn nb-btn-secondary" onclick="frappe.set_route('Form', 'Patient', '${this.esc(p.name)}')">Profile</button>
        </div>
      </div>
    `);
  }

  book_appointment_dialog(patient = null) {
    const d = new frappe.ui.Dialog({
      title: "Book Appointment",
      fields: [
        { fieldname: "patient", label: "Patient", fieldtype: "Link", options: "Patient", reqd: 1, default: patient },
        { fieldname: "practitioner", label: "Doctor", fieldtype: "Link", options: "Healthcare Practitioner", reqd: 1 },
        { fieldname: "appointment_date", label: "Date", fieldtype: "Date", reqd: 1, default: frappe.datetime.get_today() },
        { fieldname: "appointment_time", label: "Time", fieldtype: "Time", reqd: 1 },
        { fieldname: "notes", label: "Notes", fieldtype: "Small Text" },
      ],
      primary_action_label: "Book Now",
      primary_action: (values) => {
        this.call("book_appointment", values, () => {
          d.hide();
          frappe.show_alert({ message: "Appointment booked successfully", indicator: "green" });
          this.load_all(false);
        });
      },
    });
    d.show();
  }

  queue_action(method, appointment) {
    this.call(method, { appointment }, (res) => {
      frappe.show_alert({ message: (res && res.message) || "Done", indicator: "green" });
      this.load_all(false);
    });
  }

  register_walkin() {
    const patient = this.walkin_patient.get_value();
    const practitioner = this.walkin_practitioner.get_value();
    if (!patient || !practitioner) return frappe.msgprint("Select patient and doctor");
    this.call("add_walk_in", { patient, practitioner }, () => {
      frappe.show_alert({ message: "Walk-in registered", indicator: "green" });
      this.load_all(false);
    });
  }

  new_patient_dialog() {
    frappe.new_doc("Patient");
  }

  set_updated() {
    $("#nb-last-updated").text(new Date().toLocaleTimeString());
  }

  format_currency(value) {
    return frappe.format(value, { fieldtype: "Currency" });
  }

  initials(value) {
    return String(value || "U").split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase();
  }

  esc(value) {
    return frappe.utils.escape_html(String(value == null ? "" : value));
  }
}
