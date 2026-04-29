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
      <div class="nb-rw-shell">
        <aside class="nb-rw-sidebar">
          <div class="nb-rw-brand">
            <div class="nb-rw-logo">NB</div>
            <div>
              <div class="nb-rw-brand-title">ClinicWiser</div>
              <div class="nb-rw-brand-sub">Reception</div>
            </div>
          </div>
          <nav class="nb-rw-nav">
            <button class="active" data-nav="dashboard"><span>H</span>Dashboard</button>
            <button data-nav="appointments"><span>A</span>Appointments</button>
            <button data-nav="patients"><span>P</span>Patients</button>
            <button data-nav="queue"><span>Q</span>Queue</button>
            <button data-nav="billing"><span>B</span>Billing & Payments</button>
            <button data-nav="messages"><span>M</span>Messages</button>
            <button data-nav="reports"><span>R</span>Reports</button>
            <button data-nav="settings"><span>S</span>Settings</button>
          </nav>
        </aside>

        <main class="nb-rw-main">
          <header class="nb-rw-topbar">
            <div class="nb-rw-global-search">
              <span class="nb-search-icon">⌕</span>
              <input id="nb-global-search" placeholder="Search patients or appointments..." autocomplete="off" />
              <div id="nb-global-results" class="nb-global-results"></div>
            </div>
            <button class="nb-top-action" id="nb-new-patient">+ New Patient</button>
            <div class="nb-rw-userbox">
              <div class="nb-rw-bell">!</div>
              <div class="nb-rw-avatar">${this.initials(frappe.session.user_fullname || frappe.session.user)}</div>
              <div>
                <div class="nb-rw-user-name">${this.esc(frappe.session.user_fullname || frappe.session.user)}</div>
                <div class="nb-rw-user-role">Receptionist</div>
              </div>
            </div>
          </header>

          <section id="nb-kpis" class="nb-rw-kpis"></section>

          <section class="nb-rw-grid-top">
            <div class="nb-rw-card nb-rw-calendar-card">
              <div class="nb-rw-card-head">
                <h3>Today's Appointments</h3>
                <button class="nb-dot-btn">...</button>
              </div>
              <div id="nb-calendar" class="nb-rw-calendar"></div>
              <div class="nb-rw-card-footer">
                <button class="nb-link-btn" id="nb-open-calendar">View Full Calendar</button>
              </div>
            </div>

            <div class="nb-rw-side-stack">
              <div class="nb-rw-card">
                <div class="nb-rw-card-head">
                  <h3>Patient Quick Search</h3>
                  <button class="nb-dot-btn">...</button>
                </div>
                <div class="nb-rw-searchline">
                  <input id="nb-patient-search" placeholder="Search by name, phone, or ID..." autocomplete="off" />
                  <button id="nb-search-btn">⌕</button>
                </div>
                <div id="nb-patient-results" class="nb-quick-results"></div>
              </div>

              <div id="nb-patient-preview" class="nb-rw-card nb-patient-preview">
                <div class="nb-empty-soft">Search and select a patient to preview details.</div>
              </div>
            </div>
          </section>

          <section class="nb-rw-grid-bottom">
            <div class="nb-rw-card">
              <div class="nb-rw-card-head">
                <h3>Register Walk-In</h3>
                <button class="nb-dot-btn">...</button>
              </div>
              <div class="nb-form-grid">
                <label>Patient</label>
                <div id="nb-walkin-patient"></div>
                <label>Doctor</label>
                <div id="nb-walkin-practitioner"></div>
                <label>Reason / Notes</label>
                <textarea id="nb-walkin-notes" class="form-control" rows="2" placeholder="Reason for visit"></textarea>
                <button class="nb-green-btn" id="nb-register-walkin">Register Walk-In</button>
              </div>
            </div>

            <div class="nb-rw-card">
              <div class="nb-rw-card-head">
                <h3>Billing & Payments</h3>
                <button class="nb-dot-btn">...</button>
              </div>
              <div class="nb-tabs">
                <button class="active" data-bill-tab="pending">Pending Invoices</button>
                <button data-bill-tab="draft">Draft Invoices</button>
                <button data-bill-tab="paid">Paid Today</button>
              </div>
              <div id="nb-billing-list" class="nb-billing-list"></div>
              <button class="nb-blue-btn" id="nb-collect-payment">Collect Payment</button>
            </div>

            <div class="nb-rw-side-stack">
              <div class="nb-rw-card">
                <div class="nb-rw-card-head">
                  <h3>Waiting Queue</h3>
                  <button class="nb-dot-btn">...</button>
                </div>
                <div id="nb-waiting-queue"></div>
              </div>

              <div class="nb-rw-card">
                <div class="nb-rw-card-head">
                  <h3>Today's Stats</h3>
                  <button class="nb-dot-btn">...</button>
                </div>
                <div id="nb-today-stats"></div>
              </div>
            </div>
          </section>

          <section class="nb-rw-card nb-rw-table-card">
            <div class="nb-rw-card-head">
              <h3>Today's Queue</h3>
              <div class="nb-filter-bar">
                <button class="active" data-filter="all">All</button>
                <button data-filter="waiting">Waiting</button>
                <button data-filter="with_doctor">With Doctor</button>
                <button data-filter="completed">Completed</button>
                <button data-filter="unpaid">Unpaid</button>
                <button data-filter="walk_in">Walk-ins</button>
              </div>
            </div>
            <div id="nb-queue-table"></div>
          </section>

          <div class="nb-last-updated">Last updated: <span id="nb-last-updated">--</span></div>
        </main>
      </div>
    `);

    this.add_styles();
  }

  add_styles() {
    if ($("#nb-rw-style").length) return;
    $("head").append(`
      <style id="nb-rw-style">
        body[data-route="reception-workspace"] .layout-main-section { padding:0 !important; }
        body[data-route="reception-workspace"] .page-head { display:none; }
        .nb-rw-shell{display:grid;grid-template-columns:230px 1fr;min-height:calc(100vh - 50px);background:#f4f7fb;color:#0d2344;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
        .nb-rw-sidebar{background:linear-gradient(180deg,#0757b8,#1167c9);color:#fff;padding:22px 14px;box-shadow:12px 0 28px rgba(4,57,129,.18);}
        .nb-rw-brand{display:flex;align-items:center;gap:12px;margin:0 8px 32px;}
        .nb-rw-logo{width:44px;height:44px;border-radius:14px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-weight:800;border:1px solid rgba(255,255,255,.3);}
        .nb-rw-brand-title{font-size:20px;font-weight:800;line-height:1.1}.nb-rw-brand-sub{font-size:12px;opacity:.8;margin-top:3px}
        .nb-rw-nav{display:flex;flex-direction:column;gap:8px}.nb-rw-nav button{border:0;background:transparent;color:#fff;text-align:left;padding:13px 14px;border-radius:10px;font-weight:700;display:flex;gap:12px;align-items:center;transition:.16s;}
        .nb-rw-nav button span{width:24px;height:24px;background:rgba(255,255,255,.14);border-radius:7px;display:inline-flex;align-items:center;justify-content:center;font-size:12px}.nb-rw-nav button:hover,.nb-rw-nav button.active{background:rgba(255,255,255,.16);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
        .nb-rw-main{padding:24px;overflow:hidden}.nb-rw-topbar{height:64px;background:linear-gradient(90deg,#0757b8,#0058bf);margin:-24px -24px 24px;padding:10px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px;box-shadow:0 12px 28px rgba(10,70,140,.2)}
        .nb-rw-global-search{position:relative;width:min(680px,55vw)}.nb-rw-global-search input{width:100%;height:44px;border-radius:8px;border:1px solid rgba(255,255,255,.35);padding:0 16px 0 44px;font-size:15px;color:#243b63;background:#fff;box-shadow:0 8px 18px rgba(0,0,0,.1)}.nb-search-icon{position:absolute;left:16px;top:11px;font-size:22px;color:#3d5f91}.nb-global-results{display:none;position:absolute;left:0;right:0;top:50px;background:#fff;border-radius:12px;box-shadow:0 18px 44px rgba(12,38,80,.25);z-index:20;overflow:hidden;border:1px solid #dce5f2}.nb-global-item{padding:12px 14px;border-bottom:1px solid #edf2f7;cursor:pointer}.nb-global-item:hover{background:#f4f8ff}
        .nb-quick-results{display:none;margin-top:10px;background:#fff;border:1px solid #dce5f2;border-radius:10px;overflow:hidden;box-shadow:0 8px 20px rgba(12,38,80,.08)}
        .nb-quick-results .nb-global-item{padding:10px 12px}
        .nb-top-action{height:40px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.13);color:#fff;border-radius:8px;font-weight:850;padding:0 14px}.nb-rw-userbox{display:flex;align-items:center;gap:12px;color:#fff}.nb-rw-bell{width:32px;height:32px;border-radius:50%;background:#fff;color:#e33b3b;display:flex;align-items:center;justify-content:center;font-weight:900;position:relative}.nb-rw-avatar{width:40px;height:40px;border-radius:50%;background:#dbeafe;color:#0757b8;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.7)}.nb-rw-user-name{font-weight:800}.nb-rw-user-role{font-size:12px;opacity:.85}
        .nb-rw-kpis{display:grid;grid-template-columns:repeat(8,minmax(120px,1fr));gap:14px;margin-bottom:18px}.nb-kpi{background:#fff;border:1px solid #dce5f2;border-radius:10px;padding:16px 14px;box-shadow:0 8px 22px rgba(26,50,85,.08);min-height:112px;cursor:pointer;transition:.15s}.nb-kpi:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(26,50,85,.13)}.nb-kpi-top{display:flex;gap:10px;align-items:center}.nb-kpi-icon{width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900}.nb-kpi-title{font-size:13px;color:#334e73}.nb-kpi-value{font-size:24px;font-weight:900;margin:8px 0 2px}.nb-kpi-sub{font-size:12px;color:#587095}.nb-bg-blue{background:#1769e0}.nb-bg-orange{background:#f7a51a}.nb-bg-sky{background:#4d9af7}.nb-bg-green{background:#36a957}.nb-bg-red{background:#f04444}.nb-bg-purple{background:#7c45d9}.nb-bg-teal{background:#16a4a8}.nb-bg-pink{background:#dd5599}
        .nb-rw-grid-top{display:grid;grid-template-columns:1.55fr .9fr;gap:16px;margin-bottom:16px}.nb-rw-grid-bottom{display:grid;grid-template-columns:.85fr 1fr .95fr;gap:16px}.nb-rw-side-stack{display:flex;flex-direction:column;gap:16px}.nb-rw-card{background:#fff;border:1px solid #dce5f2;border-radius:10px;box-shadow:0 8px 22px rgba(26,50,85,.08);overflow:hidden}.nb-rw-card-head{min-height:50px;padding:0 16px;border-bottom:1px solid #e3eaf4;display:flex;align-items:center;justify-content:space-between;gap:12px}.nb-rw-card h3{font-size:17px;font-weight:850;margin:0;color:#0d2344}.nb-dot-btn{border:0;background:transparent;color:#9aabc4;font-weight:900;font-size:20px;line-height:1}.nb-rw-card-footer{border-top:1px solid #eaf0f7;text-align:center;padding:9px}.nb-link-btn{border:0;background:transparent;color:#075dcc;font-weight:800}.nb-blue-btn,.nb-green-btn{border:0;border-radius:7px;color:#fff;font-weight:800;height:38px;padding:0 22px;box-shadow:0 8px 16px rgba(5,73,165,.18)}.nb-blue-btn{background:#075dcc}.nb-green-btn{background:#35a853}.nb-empty-soft{padding:28px;text-align:center;color:#6b7f99;background:#f8fbff}.nb-muted{color:#607491;font-size:12px}.nb-strong{font-weight:850}
        .nb-rw-calendar{height:330px;padding:0 18px 14px;position:relative;background:linear-gradient(#fff,#fff),repeating-linear-gradient(0deg,transparent 0,transparent 56px,#e8eef7 57px),repeating-linear-gradient(90deg,transparent 0,transparent 180px,#e8eef7 181px);}.nb-cal-head{display:grid;grid-template-columns:60px repeat(5,1fr);height:48px;align-items:center;color:#243b63;font-weight:700;border-bottom:1px solid #e5edf7}.nb-cal-body{display:grid;grid-template-columns:60px repeat(5,1fr);height:260px;position:relative}.nb-cal-time{font-size:13px;color:#455a78;border-right:1px solid #e5edf7;padding-top:12px}.nb-cal-col{border-right:1px solid #e5edf7;position:relative}.nb-cal-redline{position:absolute;left:60px;right:0;top:58px;border-top:1px solid #f05252}.nb-appt-card{position:absolute;width:calc(100% - 18px);left:9px;border-radius:7px;padding:10px 12px;border:1px solid;box-shadow:0 8px 18px rgba(12,38,80,.08);font-size:12px}.nb-appt-card b{display:block;font-size:13px;margin-top:3px}.nb-appt-green{background:#eaf8ed;border-color:#b8e6c2;color:#155c2d}.nb-appt-orange{background:#fff4d8;border-color:#ffd37a;color:#7a4c00}.nb-appt-blue{background:#eaf3ff;border-color:#9cc6ff;color:#174f9c}.nb-appt-red{background:#ffecec;border-color:#ffb0b0;color:#a51f1f}.nb-appt-gray{background:#f1f5f9;border-color:#d5dde8;color:#475569}
        .nb-rw-searchline{padding:14px 16px;display:grid;grid-template-columns:1fr 52px}.nb-rw-searchline input{height:42px;border:1px solid #d5dfed;border-right:0;border-radius:7px 0 0 7px;padding:0 14px}.nb-rw-searchline button{border:1px solid #d5dfed;background:#fff;border-radius:0 7px 7px 0;font-size:22px;color:#244d86}.nb-patient-preview .nb-patient-head{display:flex;gap:14px;align-items:center;padding:16px;background:linear-gradient(90deg,#f2f6fc,#fff)}.nb-patient-photo{width:64px;height:64px;border-radius:50%;background:#dbeafe;color:#0757b8;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;border:3px solid #fff;box-shadow:0 4px 12px rgba(10,49,92,.12)}.nb-patient-name{font-size:19px;font-weight:900}.nb-patient-details{padding:14px 16px;border-top:1px solid #e7eef7}.nb-patient-row{display:flex;justify-content:space-between;margin:8px 0}.nb-patient-actions{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:10px;padding:0 16px 16px}.nb-white-btn{height:36px;border:1px solid #d6e0ee;border-radius:7px;background:#fff;color:#0d3770;font-weight:800}.nb-form-grid{padding:14px 16px 18px;display:grid;gap:8px}.nb-form-grid label{font-weight:800;color:#314666;font-size:13px}.nb-form-grid .control-input,.nb-form-grid textarea{border-color:#d5dfed;border-radius:7px}.nb-form-grid .nb-green-btn{justify-self:center;margin-top:10px;min-width:170px}
        .nb-tabs{display:flex;gap:12px;padding:12px 16px 2px}.nb-tabs button{border:0;background:transparent;padding:8px 4px;color:#334e73;font-weight:800;border-bottom:3px solid transparent}.nb-tabs button.active{color:#005bd3;border-color:#005bd3}.nb-billing-list{padding:10px 16px}.nb-bill-row,.nb-queue-row,.nb-stat-row{display:grid;grid-template-columns:auto 1fr auto auto;gap:12px;align-items:center;border:1px solid #e1e9f4;border-radius:7px;padding:10px 12px;margin-bottom:8px}.nb-bill-row a{font-weight:800}.nb-bill-amount{font-weight:900}.nb-pill{display:inline-block;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:800}.nb-pill-unpaid{background:#fff1dc;color:#e26000}.nb-pill-draft{background:#edf2f7;color:#334e73}.nb-pill-paid{background:#dcfce7;color:#15803d}.nb-rw-card #nb-collect-payment{display:block;margin:8px auto 18px;min-width:210px}.nb-queue-row{grid-template-columns:auto 1fr auto}.nb-queue-row.good .nb-q-icon{background:#35a853}.nb-queue-row.bad .nb-q-icon{background:#ef4444}.nb-q-icon{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:900}.nb-stat-row{grid-template-columns:auto 1fr auto;border:0;border-top:1px solid #e1e9f4;border-radius:0;margin:0}.nb-stat-dot{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900}
        .nb-rw-table-card{margin-top:16px}.nb-filter-bar{display:flex;gap:6px;flex-wrap:wrap}.nb-filter-bar button{border:1px solid #d6e0ee;background:#fff;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:800;color:#355276}.nb-filter-bar button.active{background:#075dcc;color:#fff;border-color:#075dcc}.nb-table-wrap{overflow:auto}.nb-table{width:100%;border-collapse:collapse}.nb-table th,.nb-table td{padding:12px 14px;border-bottom:1px solid #edf2f7;vertical-align:middle}.nb-table th{background:#f8fafc;color:#5b6f8c;font-size:11px;text-transform:uppercase}.nb-table tbody tr:hover{background:#f8fbff}.nb-status{padding:5px 9px;border-radius:999px;font-size:12px;font-weight:800;white-space:nowrap}.nb-waiting{background:#fff4d8;color:#8a5b00}.nb-with-doctor{background:#e4f0ff;color:#1252a3}.nb-completed{background:#dcfce7;color:#187044}.nb-cancelled{background:#fee2e2;color:#a83232}.nb-not-invoiced{background:#f1f5f9;color:#64748b}.nb-row-actions{display:flex;gap:6px;flex-wrap:wrap}.nb-row-actions .btn{border-radius:7px}.nb-last-updated{text-align:center;color:#70849f;font-size:12px;margin:16px}.nb-link{color:#075dcc;font-weight:850;cursor:pointer}.nb-link:hover{text-decoration:underline}.nb-error{padding:14px;color:#991b1b;background:#fee2e2;border-radius:8px}
        @media(max-width:1250px){.nb-rw-kpis{grid-template-columns:repeat(4,1fr)}.nb-rw-grid-top,.nb-rw-grid-bottom{grid-template-columns:1fr}.nb-rw-global-search{width:55vw}}
        @media(max-width:850px){.nb-rw-shell{grid-template-columns:1fr}.nb-rw-sidebar{display:none}.nb-rw-main{padding:14px}.nb-rw-topbar{margin:-14px -14px 16px}.nb-rw-kpis{grid-template-columns:repeat(2,1fr)}.nb-rw-userbox{display:none}.nb-rw-global-search{width:100%}}
      </style>
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
