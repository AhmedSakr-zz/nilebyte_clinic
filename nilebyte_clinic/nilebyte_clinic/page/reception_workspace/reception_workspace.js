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
              <button class="nb-btn nb-btn-primary" id="nb-new-patient">+ New Patient</button>
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
      render_input: true,
    });
    this.walkin_practitioner = frappe.ui.form.make_control({
      parent: $("#nb-walkin-practitioner"),
      df: { fieldtype: "Link", options: "Healthcare Practitioner", fieldname: "walkin_practitioner", placeholder: "Select doctor" },
      render_input: true,
    });
  }

  bind_events() {
    $(".nb-rw-nav button").on("click", (e) => {
      const route = $(e.currentTarget).data("route");
      if (!route) return;
      frappe.set_route(...String(route).split("/"));
    });

    $("#nb-global-search, #nb-patient-search").on("input", (e) => {
      clearTimeout(this.search_timer);
      const query = $(e.currentTarget).val().trim();
      this.search_timer = setTimeout(() => this.search_patients(query), 250);
    });

    $("#nb-search-btn").on("click", () => this.search_patients($("#nb-patient-search").val().trim()));
    $("#nb-open-calendar").on("click", () => frappe.set_route("List", "Patient Appointment"));
    $("#nb-register-walkin").on("click", () => this.register_walkin());
    $("#nb-new-patient").on("click", () => this.new_patient_dialog());
    $("#nb-collect-payment").on("click", () => this.collect_payment_dialog());

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
      if (!$(e.target).closest(".nb-rw-global-search,.nb-rw-searchline").length) {
        $("#nb-global-results,#nb-patient-results").hide();
      }
    });
  }

  handle_sidebar_nav(nav) {
    if (!nav) return;
    this.set_sidebar_active(nav);

    if (nav === "dashboard") {
      this.active_filter = "all";
      $(".nb-filter-bar button").removeClass("active");
      $(".nb-filter-bar button[data-filter='all']").addClass("active");
      this.load_all(false);
      this.scroll_to_top();
      return;
    }

    if (nav === "queue") {
      this.active_filter = "waiting";
      $(".nb-filter-bar button[data-filter='waiting']").trigger("click");
      this.scroll_to(".nb-rw-table-card");
      return;
    }

    const routes = {
      appointments: ["List", "Patient Appointment"],
      patients: ["List", "Patient"],
      billing: ["List", "Sales Invoice"],
      messages: ["List", "Communication"],
      reports: ["query-report", "Daily Clinic Summary"],
      settings: ["Form", "NileByte Clinic Settings", "NileByte Clinic Settings"],
    };

    if (routes[nav]) {
      frappe.set_route(...routes[nav]);
    }
  }

  set_sidebar_active(nav) {
    $(".nb-rw-nav button").removeClass("active");
    $(`.nb-rw-nav button[data-nav='${nav}']`).addClass("active");
  }

  scroll_to(selector) {
    const target = $(selector);
    if (target.length) {
      $("html, body").animate({ scrollTop: target.offset().top - 90 }, 250);
    }
  }

  scroll_to_top() {
    $("html, body").animate({ scrollTop: 0 }, 250);
  }

  load_all(show_loading = true) {
    this.load_billing_summary();
    this.load_queue(show_loading);
    this.load_alerts();
    this.set_updated();
  }

  call(method, args = {}, callback = null, error = null) {
    frappe.call({
      method: "nilebyte_clinic.nilebyte_clinic.page.reception_workspace.reception_workspace." + method,
      args,
      freeze: false,
      callback: (r) => callback && callback(r.message),
      error: (r) => {
        if (error) error(r);
        else frappe.msgprint({ title: "Reception Workspace", indicator: "red", message: "Could not complete action. Please check server logs." });
      },
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
      const billing = this.billing_summary || {};
      const paid_today = billing.paid_today_count || this.queue_rows.filter(r => r.payment_status === "Paid").length;
      const cards = [
        ["today", "Today's Appointments", data.today || 0, "View all", "nb-bg-blue", "A"],
        ["waiting", "Waiting", data.waiting || 0, "View queue", "nb-bg-orange", "W"],
        ["with_doctor", "With Doctor", data.with_doctor || 0, "View queue", "nb-bg-sky", "D"],
        ["completed", "Completed", data.completed || 0, "View all", "nb-bg-green", "C"],
        ["unpaid", "Unpaid Invoices", billing.pending_count || data.unpaid || 0, this.format_currency(billing.pending_amount || 0), "nb-bg-red", "U"],
        ["paid", "Paid Today", paid_today, this.format_currency(billing.paid_today_amount || 0), "nb-bg-purple", "P"],
        ["cash", "Cash Collected", this.format_currency(billing.cash_collected || 0), "View details", "nb-bg-teal", "E"],
        ["walk_in", "Walk-ins", data.walk_in || 0, "View all", "nb-bg-pink", "V"],
      ];
      $("#nb-kpis").html(cards.map(c => `
        <div class="nb-kpi" data-filter="${c[0]}">
          <div class="nb-kpi-top"><div class="nb-kpi-icon ${c[4]}">${c[5]}</div><div class="nb-kpi-title">${c[1]}</div></div>
          <div class="nb-kpi-value">${this.esc(c[2])}</div><div class="nb-kpi-sub">${c[3]}</div>
        </div>
      `).join(""));
      $(".nb-kpi").on("click", (e) => {
        const f = $(e.currentTarget).data("filter");
        if (f === "today") { frappe.set_route("List", "Patient Appointment"); return; }
        if (f === "paid") { frappe.set_route("List", "Sales Invoice", { posting_date: frappe.datetime.get_today(), outstanding_amount: 0 }); return; }
        if (f === "cash") { frappe.set_route("List", "Payment Entry"); return; }
        this.active_filter = f;
        $(`.nb-filter-bar button[data-filter='${f}']`).trigger("click");
      });
      this.render_today_stats(data);
    });
  }

  load_queue(show_loading = true) {
    if (show_loading) {
      $("#nb-queue-table").html(`<div class="nb-empty-soft">Loading today's queue...</div>`);
      $("#nb-calendar").html(`<div class="nb-empty-soft">Loading appointments...</div>`);
    }
    this.call("get_today_queue", { filter: this.active_filter }, (rows) => {
      this.queue_rows = rows || [];
      this.render_queue_table(this.queue_rows);
      this.render_calendar(this.queue_rows);
      this.render_waiting_queue(this.queue_rows);
      this.render_billing($(".nb-tabs button.active").data("bill-tab") || "pending");
      this.load_stats();
      this.set_updated();
    });
  }

  render_calendar(rows) {
    const hours = ["9 AM", "10 AM", "11 AM", "12 PM", "1 PM"];
    let html = `<div class="nb-cal-head"><div></div>${hours.map(h => `<div>${h.replace(" ", ":00 ")}</div>`).join("")}</div><div class="nb-cal-body"><div>${hours.map(h => `<div class="nb-cal-time">${h}</div>`).join("")}</div>${hours.map(() => `<div class="nb-cal-col"></div>`).join("")}<div class="nb-cal-redline"></div>`;
    const visible = (rows || []).slice(0, 6);
    visible.forEach((row, i) => {
      const col = Math.min(i % 5, 4);
      const top = 28 + ((i * 54) % 210);
      const cls = row.status === "Completed" ? "nb-appt-green" : row.status === "With Doctor" ? "nb-appt-blue" : row.status === "Cancelled" ? "nb-appt-red" : "nb-appt-orange";
      html += `<div class="nb-appt-card ${cls}" style="left:calc(60px + ${col} * ((100% - 60px)/5) + 9px);top:${top}px;width:calc((100% - 60px)/5 - 18px);">
        <span>${this.esc(row.time || "")}</span><b>${this.esc(row.patient_name || row.patient || "Patient")}</b><span>${this.esc(row.status || "Waiting")}</span>
      </div>`;
    });
    html += `</div>`;
    $("#nb-calendar").html(html);
  }

  render_queue_table(rows) {
    if (!rows || !rows.length) {
      $("#nb-queue-table").html(`<div class="nb-empty-soft">No patients found in this view.</div>`);
      return;
    }
    const html = `<div class="nb-table-wrap"><table class="nb-table"><thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th><th>Payment</th><th>Actions</th></tr></thead><tbody>${rows.map(row => `
      <tr>
        <td>${this.esc(row.time || "")}</td>
        <td><a class="nb-link" href="/app/patient/${encodeURIComponent(row.patient || "")}">${this.esc(row.patient_name || row.patient || "")}</a><div class="nb-muted">${this.esc(row.patient || "")}</div></td>
        <td>${this.esc(row.practitioner_name || row.practitioner || "")}</td>
        <td>${this.status_badge(row.status)}</td>
        <td>${this.payment_badge(row.payment_status, row.invoice)}</td>
        <td><div class="nb-row-actions">
          <button class="btn btn-xs btn-default" data-action="check_in_patient" data-name="${this.esc(row.name)}">Arrived</button>
          <button class="btn btn-xs btn-default" data-action="send_to_doctor" data-name="${this.esc(row.name)}">Send</button>
          <button class="btn btn-xs btn-default" data-action="complete_visit" data-name="${this.esc(row.name)}">Complete</button>
          <button class="btn btn-xs btn-primary" data-action="create_invoice" data-name="${this.esc(row.name)}">Invoice</button>
        </div></td>
      </tr>`).join("")}</tbody></table></div>`;
    $("#nb-queue-table").html(html);
    $("#nb-queue-table [data-action]").on("click", (e) => {
      this.queue_action($(e.currentTarget).data("action"), $(e.currentTarget).data("name"));
    });
  }

  render_waiting_queue(rows) {
    const waiting = (rows || []).filter(r => ["Waiting", "With Doctor", "Cancelled"].includes(r.status)).slice(0, 5);
    if (!waiting.length) {
      $("#nb-waiting-queue").html(`<div class="nb-empty-soft">No patients waiting.</div>`);
      return;
    }
    $("#nb-waiting-queue").html(waiting.map(r => `
      <div class="nb-queue-row ${r.status === "Cancelled" ? "bad" : "good"}">
        <span class="nb-q-icon">${r.status === "Cancelled" ? "!" : "✓"}</span>
        <div class="${r.status === "Cancelled" ? "text-danger" : ""}"><b>${this.esc(r.status === "Cancelled" ? "No-Show: " : "")}${this.esc(r.patient_name || r.patient || "")}</b></div>
        <div class="nb-muted">${r.status === "With Doctor" ? "Now" : "--"}</div>
      </div>
    `).join(""));
  }

  render_billing(tab = "pending") {
    let rows = this.queue_rows || [];
    if (tab === "pending") rows = rows.filter(r => r.payment_status === "Unpaid");
    if (tab === "draft") rows = rows.filter(r => r.payment_status === "Draft Invoice" || r.payment_status === "Not Invoiced");
    if (tab === "paid") rows = rows.filter(r => r.payment_status === "Paid");
    rows = rows.slice(0, 4);
    if (!rows.length) {
      $("#nb-billing-list").html(`<div class="nb-empty-soft">No ${this.esc(tab)} billing records.</div>`);
      return;
    }
    $("#nb-billing-list").html(rows.map(r => `
      <div class="nb-bill-row">
        <span>${r.invoice ? "INV" : "APT"}</span>
        <a href="${r.invoice ? `/app/sales-invoice/${encodeURIComponent(r.invoice)}` : `/app/patient-appointment/${encodeURIComponent(r.name)}`}">${this.esc(r.invoice || r.name)}</a>
        <div class="nb-strong">${this.esc(r.patient_name || r.patient || "")}</div>
        ${this.payment_badge(r.payment_status, null)}
        ${r.invoice ? `<button class="btn btn-xs btn-primary nb-bill-pay" data-invoice="${this.esc(r.invoice)}">Collect</button>` : `<button class="btn btn-xs btn-default" data-action="create_invoice" data-name="${this.esc(r.name)}">Invoice</button>`}
      </div>
    `).join(""));
    $("#nb-billing-list .nb-bill-pay").on("click", (e) => this.collect_payment_dialog($(e.currentTarget).data("invoice")));
    $("#nb-billing-list [data-action='create_invoice']").on("click", (e) => this.queue_action("create_invoice", $(e.currentTarget).data("name")));
  }

  render_today_stats(data) {
    const avg = "--";
    $("#nb-today-stats").html(`
      <div class="nb-stat-row"><span class="nb-stat-dot nb-bg-teal">P</span><span>Patients Served</span><b>${this.esc(data.completed || 0)}</b></div>
      <div class="nb-stat-row"><span class="nb-stat-dot nb-bg-blue">T</span><span>Avg. Wait Time</span><b>${avg}</b></div>
      <div class="nb-stat-row"><span class="nb-stat-dot nb-bg-red">!</span><span>No-Shows</span><b>--</b></div>
    `);
  }

  search_patients(query) {
    const target = document.activeElement && document.activeElement.id === "nb-patient-search" ? "#nb-patient-results" : "#nb-global-results";
    if (!query || query.length < 2) {
      $(target).hide().html("");
      return;
    }
    this.call("search_patient", { query }, (rows) => {
      rows = rows || [];
      if (!rows.length) {
        $(target).html(`<div class="nb-global-item nb-muted">No patients found</div>`).show();
        return;
      }
      $(target).html(rows.map(p => `
        <div class="nb-global-item" data-patient="${this.esc(p.name)}">
          <b>${this.esc(p.patient_name || p.name)}</b>
          <div class="nb-muted">${this.esc(p.name || "")} - ${this.esc(p.mobile || p.phone || "No phone")} - Balance: ${this.esc(p.outstanding || 0)}</div>
        </div>
      `).join("")).show();
      $(`${target} .nb-global-item[data-patient]`).on("click", (e) => {
        const name = $(e.currentTarget).data("patient");
        const patient = rows.find(p => p.name === name);
        this.selected_patient = patient;
        this.render_patient_preview(patient);
        $("#nb-global-results,#nb-patient-results").hide();
      });
    });
  }

  render_patient_preview(p) {
    if (!p) return;
    $("#nb-patient-preview").html(`
      <div class="nb-patient-head">
        <div class="nb-patient-photo">${this.initials(p.patient_name || p.name)}</div>
        <div><div class="nb-patient-name">${this.esc(p.patient_name || p.name)}</div><div class="nb-muted">${this.esc(p.name || "")}</div></div>
      </div>
      <div class="nb-patient-details">
        <div class="nb-patient-row"><span>Mobile</span><b>${this.esc(p.mobile || p.phone || "--")}</b></div>
        <div class="nb-patient-row"><span>Balance</span><b>${this.esc(p.outstanding || 0)}</b></div>
      </div>
      <div class="nb-patient-actions">
        <button class="nb-blue-btn" id="nb-preview-open">View Record</button>
        <button class="nb-green-btn" id="nb-preview-book">New Appointment</button>
        <button class="nb-white-btn" id="nb-preview-billing">Billing</button>
      </div>
    `);
    $("#nb-preview-open").on("click", () => frappe.set_route("Form", "Patient", p.name));
    $("#nb-preview-book").on("click", () => this.book_appointment_dialog(p.name));
    $("#nb-preview-billing").on("click", () => frappe.set_route("List", "Sales Invoice", { patient: p.name }));
  }

  register_walkin() {
    const patient = this.walkin_patient.get_value();
    const practitioner = this.walkin_practitioner.get_value();
    const notes = $("#nb-walkin-notes").val();
    if (!patient || !practitioner) {
      frappe.msgprint("Please select patient and doctor.");
      return;
    }
    this.call("add_walk_in", { patient, practitioner, notes }, () => {
      frappe.show_alert({ message: "Walk-in registered", indicator: "green" });
      this.walkin_patient.set_value("");
      this.walkin_practitioner.set_value("");
      $("#nb-walkin-notes").val("");
      this.load_all(false);
    });
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
      primary_action_label: "Book",
      primary_action: (values) => {
        this.call("book_appointment", values, () => {
          d.hide();
          frappe.show_alert({ message: "Appointment booked", indicator: "green" });
          this.load_all(false);
        });
      },
    });
    d.show();
  }

  new_patient_dialog() {
    const d = new frappe.ui.Dialog({
      title: "Create New Patient",
      fields: [
        { fieldname: "patient_name", label: "Patient Name", fieldtype: "Data", reqd: 1 },
        { fieldname: "mobile", label: "Mobile", fieldtype: "Data" },
        { fieldname: "sex", label: "Gender", fieldtype: "Select", options: "\nMale\nFemale" },
        { fieldname: "dob", label: "Date of Birth", fieldtype: "Date" },
      ],
      primary_action_label: "Create Patient",
      primary_action: (values) => {
        this.call("create_patient", values, (res) => {
          d.hide();
          frappe.show_alert({ message: "Patient created", indicator: "green" });
          if (res && res.name) frappe.set_route("Form", "Patient", res.name);
        });
      },
    });
    d.show();
  }

  collect_payment_dialog(invoice = null) {
    const d = new frappe.ui.Dialog({
      title: "Collect Payment",
      fields: [
        { fieldname: "invoice", label: "Sales Invoice", fieldtype: "Link", options: "Sales Invoice", reqd: 1, default: invoice },
        { fieldname: "mode_of_payment", label: "Mode of Payment", fieldtype: "Link", options: "Mode of Payment" },
        { fieldname: "amount", label: "Amount", fieldtype: "Currency" },
        { fieldname: "reference", label: "Reference No", fieldtype: "Data" },
      ],
      primary_action_label: "Submit Payment",
      primary_action: (values) => {
        this.call("collect_payment", values, (res) => {
          d.hide();
          frappe.msgprint({
            title: "Payment Collected",
            indicator: "green",
            message: `${this.esc((res && res.message) || "Payment collected")}<br><br>${res && res.payment_entry ? `<a class="btn btn-primary" href="/app/payment-entry/${encodeURIComponent(res.payment_entry)}">Open Payment ${this.esc(res.payment_entry)}</a>` : ""}`,
          });
          this.load_all(false);
        });
      },
    });
    d.show();
  }

  queue_action(method, appointment) {
    this.call(method, { appointment }, (res) => {
      if (method === "create_invoice" && res && res.invoice) {
        frappe.msgprint({
          title: "Invoice Ready",
          indicator: "green",
          message: `${this.esc(res.message || "Invoice created")}<br><br><a class="btn btn-primary" href="/app/sales-invoice/${encodeURIComponent(res.invoice)}">Open Invoice ${this.esc(res.invoice)}</a>`,
        });
      } else {
        frappe.show_alert({ message: (res && res.message) || "Done", indicator: "green" });
      }
      this.load_all(false);
    });
  }

  load_alerts() {
    this.call("get_alerts", {}, (rows) => {
      rows = rows || [];
      if (rows.length) $(".nb-rw-bell").text(rows.length);
    });
  }

  status_badge(status) {
    const cls = {
      "Waiting": "nb-waiting",
      "With Doctor": "nb-with-doctor",
      "Completed": "nb-completed",
      "Cancelled": "nb-cancelled",
    }[status] || "nb-waiting";
    return `<span class="nb-status ${cls}">${this.esc(status || "Waiting")}</span>`;
  }

  payment_badge(status, invoice) {
    status = status || "Not Invoiced";
    const cls = {
      "Paid": "nb-pill-paid",
      "Unpaid": "nb-pill-unpaid",
      "Draft Invoice": "nb-pill-draft",
      "Not Invoiced": "nb-not-invoiced",
    }[status] || "nb-not-invoiced";
    const badge = `<span class="nb-pill ${cls}">${this.esc(status)}</span>`;
    if (!invoice) return badge;
    return `${badge}<div class="nb-muted"><a class="nb-link" href="/app/sales-invoice/${encodeURIComponent(invoice)}">${this.esc(invoice)}</a></div>`;
  }

  set_updated() {
    $("#nb-last-updated").text(frappe.datetime.now_time ? frappe.datetime.now_time() : new Date().toLocaleTimeString());
  }

  format_currency(value) {
    const n = (typeof flt !== "undefined") ? flt(value || 0) : Number(value || 0);
    return frappe.format(n, { fieldtype: "Currency" });
  }

  initials(value) {
    return String(value || "U").split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();
  }

  esc(value) {
    return frappe.utils.escape_html(String(value == null ? "" : value));
  }
}
