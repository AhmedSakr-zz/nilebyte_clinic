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
              <p>Managing clinical front-desk operations</p>
            </div>
            <div class="nb-top-actions">
              <div class="nb-search-bar">
                <span class="nb-search-icon">⌕</span>
                <input id="nb-global-search" placeholder="Search patients or appointments..." autocomplete="off" />
                <div id="nb-global-results" class="nb-global-results nb-quick-results"></div>
              </div>
              <div style="display:flex; gap:12px;">
                <button class="nb-btn nb-btn-secondary" id="nb-header-collect">💳 Collect</button>
                <button class="nb-btn nb-btn-secondary" id="nb-header-book">📅 Book</button>
                <button class="nb-btn nb-btn-primary" id="nb-new-patient">＋ New Patient</button>
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
                  <h3>Schedule Highlights</h3>
                  <button class="nb-btn nb-btn-secondary btn-xs" id="nb-open-calendar">Full Calendar</button>
                </div>
                <div id="nb-calendar" class="nb-rw-calendar">
                    <div class="nb-empty-soft">Calendar view is being updated...</div>
                </div>
              </section>

              <div class="nb-grid" style="gap: 24px;">
                <section class="nb-card" style="margin: 0; padding: 24px;">
                  <div class="nb-card-header" style="margin-bottom:16px; border:0;"><h3>Find Patient</h3></div>
                  <div class="nb-search-bar" style="width: 100%;">
                    <span class="nb-search-icon">🔍</span>
                    <input id="nb-patient-search" placeholder="Name, phone, or patient ID..." autocomplete="off" />
                    <div id="nb-patient-results" class="nb-quick-results"></div>
                  </div>
                </section>
                <div id="nb-patient-preview">
                    <div class="nb-card" style="margin: 0; display: flex; flex-direction:column; align-items: center; justify-content: center; min-height: 200px; color: var(--nb-text-muted); border: 2px dashed var(--nb-border); background: var(--nb-surface);">
                        <span style="font-size: 32px; margin-bottom:10px;">👤</span>
                        Select a patient to see details
                    </div>
                </div>
              </div>
            </div>

            <div class="nb-grid nb-grid-3">
              <section class="nb-card">
                <div class="nb-card-header"><h3>Register Walk-In</h3></div>
                <div class="nb-form-grid">
                  <div class="nb-form-group">
                    <label>Patient</label>
                    <div id="nb-walkin-patient"></div>
                  </div>
                  <div class="nb-form-group">
                    <label>Doctor</label>
                    <div id="nb-walkin-practitioner"></div>
                  </div>
                  <button class="nb-btn nb-btn-primary w-100" id="nb-register-walkin">🩺 Register & Queue</button>
                </div>
              </section>

              <section class="nb-card">
                <div class="nb-card-header">
                  <h3>Billing</h3>
                  <div style="display:flex; background:var(--nb-surface); padding:4px; border-radius:10px; gap:4px;">
                    <button class="nb-btn btn-xs nb-btn-secondary active" data-bill-tab="pending" style="border:0;">Pending</button>
                    <button class="nb-btn btn-xs nb-btn-secondary" data-bill-tab="paid" style="border:0;">Paid</button>
                  </div>
                </div>
                <div id="nb-billing-list"></div>
              </section>

              <section class="nb-card">
                <div class="nb-card-header"><h3>Daily Financials</h3></div>
                <div id="nb-today-stats"></div>
              </section>
            </div>

            <section class="nb-card">
              <div class="nb-card-header">
                <h3>Queue Management</h3>
                <div style="display:flex; gap:8px;">
                  <button class="nb-btn btn-xs nb-btn-secondary active" data-filter="all">All</button>
                  <button class="nb-btn btn-xs nb-btn-secondary" data-filter="waiting">Waiting</button>
                  <button class="nb-btn btn-xs nb-btn-secondary" data-filter="with_doctor">With Doctor</button>
                  <button class="nb-btn btn-xs nb-btn-secondary" data-filter="completed">Completed</button>
                </div>
              </div>
              <div id="nb-queue-table" class="nb-table-container"></div>
            </section>
          </div>
          <div class="nb-last-updated" style="margin-top: 40px; opacity: 0.5; text-align: center; font-size: 13px;">
            ✦ Cloud Sync Active • Last updated: <span id="nb-last-updated">--</span>
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
    $("#nb-header-collect").on("click", () => this.collect_payment_dialog());
    $("#nb-register-walkin").on("click", () => this.register_walkin());
    $("#nb-new-patient").on("click", () => this.new_patient_dialog());

    $("[data-bill-tab]").on("click", (e) => {
      $("[data-bill-tab]").removeClass("active").css("background", "transparent");
      $(e.currentTarget).addClass("active").css("background", "#ffffff");
      this.render_billing($(e.currentTarget).data("bill-tab"));
    });

    $("[data-filter]").on("click", (e) => {
      $("[data-filter]").removeClass("active").removeClass("nb-btn-primary").addClass("nb-btn-secondary");
      $(e.currentTarget).addClass("active").addClass("nb-btn-primary").removeClass("nb-btn-secondary");
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
        { label: "Today Appts", value: data.today || 0, icon: "📅", color: "blue" },
        { label: "Waiting", value: data.waiting || 0, icon: "⏱", color: "orange" },
        { label: "In Triage", value: data.with_nurse || 0, icon: "🧪", color: "sky" },
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
      $("#nb-queue-table").html(`<div class="nb-empty-soft">Updating queue...</div>`);
    }
    this.call("get_today_queue", { filter: this.active_filter }, (rows) => {
      this.queue_rows = rows || [];
      this.render_queue_table(this.queue_rows);
      this.render_billing($("[data-bill-tab].active").data("bill-tab") || "pending");
    });
  }

  render_queue_table(rows) {
    if (!rows.length) {
      $("#nb-queue-table").html(`<div class="nb-empty-soft">No active queue entries found for today.</div>`);
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
              <td><span style="color:var(--nb-primary); font-weight:700;">${this.esc(row.time)}</span></td>
              <td>
                <div style="font-weight:700;">${this.esc(row.patient_name || row.patient)}</div>
                <div style="font-size:11px; opacity:0.6;">${this.esc(row.patient)}</div>
              </td>
              <td>${this.esc(row.practitioner_name || row.practitioner)}</td>
              <td><span class="nb-badge ${this.status_badge(row.status)}">${this.esc(row.status)}</span></td>
              <td>
                <div style="display:flex; gap:8px;">
                  ${row.status === 'Arrived' ? '' : `<button class="nb-btn nb-btn-secondary btn-xs" data-action="mark_arrived" data-name="${this.esc(row.name)}">Check In</button>`}
                  <button class="nb-btn nb-btn-secondary btn-xs" data-action="send_to_doctor" data-name="${this.esc(row.name)}">Send to MD</button>
                  ${row.invoice ? `<button class="nb-btn nb-btn-primary btn-xs" data-action="collect" data-invoice="${this.esc(row.invoice)}">Collect</button>` : `<button class="nb-btn nb-btn-primary btn-xs" data-action="create_invoice" data-name="${this.esc(row.name)}">Invoice</button>`}
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `);
    $("#nb-queue-table [data-action]").on("click", (e) => {
        const action = $(e.currentTarget).data("action");
        if (action === "collect") {
            this.collect_payment_dialog($(e.currentTarget).data("invoice"));
        } else {
            this.queue_action(action, $(e.currentTarget).data("name"));
        }
    });
  }

  status_badge(status) {
    if (status === "Arrived" || status === "With Doctor") return "nb-badge-blue";
    if (status === "Completed") return "nb-badge-green";
    if (status === "Pending") return "nb-badge-orange";
    return "nb-badge-blue";
  }

  render_billing(tab = "pending") {
    let rows = this.queue_rows.filter(r => tab === "paid" ? r.payment_status === "Paid" : r.payment_status !== "Paid");
    rows = rows.slice(0, 5);
    if (!rows.length) {
      $("#nb-billing-list").html(`<div class="nb-empty-soft" style="padding:20px; border:0;">No records.</div>`);
      return;
    }
    $("#nb-billing-list").html(rows.map(r => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--nb-border);">
        <div>
          <div style="font-weight:700; font-size:14px;">${this.esc(r.patient_name || r.patient)}</div>
          <div style="font-size:11px; color:var(--nb-text-muted);">${this.esc(r.name)} • ${this.esc(r.payment_status)}</div>
        </div>
        <div style="display:flex; gap:5px;">
            ${r.invoice ? `<button class="nb-btn nb-btn-primary btn-xs" data-action="collect" data-invoice="${this.esc(r.invoice)}">Collect</button>` : `<button class="nb-btn nb-btn-secondary btn-xs" data-action="create_invoice" data-name="${this.esc(r.name)}">Invoice</button>`}
        </div>
      </div>
    `).join(""));
    
    $("#nb-billing-list [data-action='create_invoice']").on("click", (e) => this.queue_action("create_invoice", $(e.currentTarget).data("name")));
    $("#nb-billing-list [data-action='collect']").on("click", (e) => this.collect_payment_dialog($(e.currentTarget).data("invoice")));
  }

  render_today_stats(data) {
    $("#nb-today-stats").html(`
      <div style="display:grid; gap:16px; padding:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--nb-border); padding-bottom:12px;">
            <span style="font-weight:600; color:var(--nb-text-muted);">Paid Today</span>
            <b style="font-size:18px; color:var(--nb-success);">${this.format_currency(this.billing_summary.paid_today_amount || 0)}</b>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--nb-border); padding-bottom:12px;">
            <span style="font-weight:600; color:var(--nb-text-muted);">Pending Amount</span>
            <b style="font-size:18px; color:var(--nb-warning);">${this.format_currency(this.billing_summary.unpaid_amount || 0)}</b>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:600; color:var(--nb-text-muted);">Total Invoices</span>
            <b style="font-size:18px;">${this.billing_summary.total_invoices || 0}</b>
        </div>
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
        $(target).html(`<div style="padding:16px; color:var(--nb-text-muted);">No results found</div>`).show();
        return;
      }
      $(target).html(rows.map(p => `
        <div class="nb-global-item" data-patient="${this.esc(p.name)}">
          <b>${this.esc(p.patient_name || p.name)}</b>
          <div>${this.esc(p.name)} • ${this.esc(p.mobile || "No phone")}</div>
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
      <div class="nb-card nb-fade-in" style="margin:0; padding:28px; border:1px solid var(--nb-primary-soft); background:linear-gradient(to bottom, #ffffff, var(--nb-surface));">
        <div style="display:flex; gap:20px; align-items:center; margin-bottom:24px;">
          <div class="nb-avatar" style="width:64px; height:64px; font-size:24px; border-radius:20px;">${this.initials(p.patient_name || p.name)}</div>
          <div>
            <div style="font-weight:900; font-size:20px; font-family:'Outfit';">${this.esc(p.patient_name || p.name)}</div>
            <div style="color:var(--nb-text-muted); font-size:13px; font-weight:600;">ID: ${this.esc(p.name)}</div>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <button class="nb-btn nb-btn-primary" id="nb-preview-book">📅 Book Appt</button>
          <button class="nb-btn nb-btn-secondary" onclick="frappe.set_route('Form', 'Patient', '${this.esc(p.name)}')">👤 Profile</button>
        </div>
      </div>
    `);
  }

  book_appointment_dialog(patient = null) {
    const d = new frappe.ui.Dialog({
      title: "Book Patient Appointment",
      fields: [
        { fieldname: "patient", label: "Patient", fieldtype: "Link", options: "Patient", reqd: 1, default: patient },
        { fieldname: "practitioner", label: "Healthcare Practitioner", fieldtype: "Link", options: "Healthcare Practitioner", reqd: 1 },
        { fieldname: "appointment_date", label: "Date", fieldtype: "Date", reqd: 1, default: frappe.datetime.get_today() },
        { fieldname: "appointment_time", label: "Time", fieldtype: "Time", reqd: 1 },
        { fieldname: "notes", label: "Notes", fieldtype: "Small Text" },
      ],
      primary_action_label: "Confirm Booking",
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

  collect_payment_dialog(invoice = null) {
    const d = new frappe.ui.Dialog({
      title: "Collect Clinical Payment",
      fields: [
        { fieldname: "invoice", label: "Sales Invoice", fieldtype: "Link", options: "Sales Invoice", reqd: 1, default: invoice },
        { fieldname: "mode_of_payment", label: "Mode of Payment", fieldtype: "Link", options: "Mode of Payment", reqd: 1 },
        { fieldname: "amount", label: "Amount to Collect", fieldtype: "Currency", reqd: 1 },
        { fieldname: "reference", label: "Reference No", fieldtype: "Data" },
      ],
      primary_action_label: "Submit Payment",
      primary_action: (values) => {
        this.call("collect_payment", values, (res) => {
          d.hide();
          frappe.msgprint({
            title: "Success",
            indicator: "green",
            message: `Payment Entry Created: <b>${this.esc(res.payment_entry)}</b>`,
          });
          this.load_all(false);
        });
      },
    });
    d.show();
  }

  queue_action(method, appointment) {
    this.call(method, { appointment }, (res) => {
      frappe.show_alert({ message: (res && res.message) || "Action completed", indicator: "green" });
      this.load_all(false);
    });
  }

  register_walkin() {
    const patient = this.walkin_patient.get_value();
    const practitioner = this.walkin_practitioner.get_value();
    if (!patient || !practitioner) return frappe.msgprint("Please select both patient and doctor.");
    this.call("add_walk_in", { patient, practitioner }, () => {
      frappe.show_alert({ message: "Walk-in registration successful", indicator: "green" });
      this.walkin_patient.set_value("");
      this.walkin_practitioner.set_value("");
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
