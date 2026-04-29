frappe.pages["clinic-admin-dashboard"].on_page_load = function (wrapper) {
  new NBClinicAdminDashboard(wrapper);
};

class NBClinicAdminDashboard {
  constructor(wrapper) {
    this.wrapper = wrapper;
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: "Clinic Admin Dashboard",
      single_column: true,
    });

    this.method_base = "nilebyte_clinic.nilebyte_clinic.page.clinic_admin_dashboard.clinic_admin_dashboard";
    this.dashboard = {};
    this.search_timer = null;

    this.render();
    this.bind_events();
    this.load_dashboard();
    this.refresh_interval = setInterval(() => this.load_dashboard(false), 60000);
  }

  render() {
    $(this.page.body).html(`
      <div class="nb-admin-app">
        <aside class="nb-admin-sidebar">
          <div class="nb-admin-brand">
            <div class="nb-admin-logo">✦</div>
            <div class="nb-admin-brand-name">Medica Clinic</div>
          </div>
          <nav class="nb-admin-nav">
            <button class="active" data-route="clinic-admin-dashboard"><span>⌂</span> Dashboard</button>
            <button data-route="clinic-reports"><span>▥</span> Reports</button>
            <button data-route="List/Healthcare Practitioner"><span>☷</span> Staff Management</button>
            <button data-route="List/Item"><span>▣</span> Inventory</button>
            <button data-route="List/Sales Invoice"><span>▰</span> Billing</button>
            <button data-route="List/Patient Appointment"><span>▦</span> Appointments</button>
            <button data-route="List/Patient"><span>▣</span> Patient Records</button>
            <button data-action="settings"><span>⚙</span> Settings</button>
          </nav>
        </aside>

        <main class="nb-admin-shell">
          <header class="nb-admin-topbar">
            <div class="nb-admin-search">
              <span>⌕</span>
              <input id="nb-admin-search" placeholder="Search..." autocomplete="off" />
              <div id="nb-admin-search-results" class="nb-admin-search-results"></div>
            </div>
            <div class="nb-admin-user">
              <div class="nb-admin-icon">🔔</div>
              <div class="nb-admin-icon">✉<b>5</b></div>
              <div class="nb-admin-avatar">AD</div>
              <div>
                <strong>${this.esc(frappe.session.user_fullname || frappe.session.user || "Clinic Administrator")}</strong>
                <small>Clinic Administrator</small>
              </div>
              <span>⌄</span>
            </div>
          </header>

          <section class="nb-admin-content">
            <div id="nb-admin-kpis" class="nb-admin-kpis"></div>

            <div class="nb-admin-grid nb-admin-grid-main">
              <section class="nb-admin-card nb-admin-financial">
                <div class="nb-admin-card-head"><h3>Financial Overview</h3><span>•••</span></div>
                <div class="nb-admin-tabs">
                  <button class="active" data-chart="revenue">Revenue</button>
                  <button data-chart="expenses">Expenses</button>
                </div>
                <div id="nb-admin-chart" class="nb-admin-chart"><div class="nb-admin-empty">Loading chart...</div></div>
              </section>

              <section class="nb-admin-card">
                <div class="nb-admin-card-head"><h3>Facility Stats</h3><span>•••</span></div>
                <div id="nb-admin-facility"><div class="nb-admin-empty">Loading facility stats...</div></div>
              </section>
            </div>

            <div class="nb-admin-grid nb-admin-quick-row" id="nb-admin-quick-cards"></div>

            <div class="nb-admin-grid nb-admin-bottom-grid">
              <section class="nb-admin-card">
                <div class="nb-admin-card-head"><h3>Recent Activities</h3><span>•••</span></div>
                <div id="nb-admin-activities"></div>
              </section>

              <section class="nb-admin-card">
                <div class="nb-admin-card-head"><h3>System Settings</h3><span>•••</span></div>
                <div id="nb-admin-settings"></div>
              </section>

              <section class="nb-admin-card">
                <div class="nb-admin-card-head"><h3>My Tasks</h3><span>•••</span></div>
                <div id="nb-admin-tasks"></div>
              </section>

              <section class="nb-admin-card">
                <div class="nb-admin-card-head"><h3>Reports & Analytics</h3><span>•••</span></div>
                <div id="nb-admin-reports"></div>
                <div class="nb-admin-note-actions"><button id="nb-admin-open-reports">Open Reports Workspace</button></div>
              </section>
            </div>
          </section>
        </main>
      </div>
    `);
    this.add_styles();
  }

  add_styles() {
    if ($("#nb-admin-style").length) return;
    $("head").append(`
      <style id="nb-admin-style">
        body[data-route="clinic-admin-dashboard"] .layout-main-section-wrapper,
        body[data-route="clinic-admin-dashboard"] .layout-main-section { padding:0 !important; margin:0 !important; }
        .nb-admin-app { --blue:#075cc6; --blue2:#1d71d5; --deep:#0b2454; --muted:#667899; --line:#dbe5f2; --soft:#f4f8fd; display:flex; min-height:calc(100vh - 92px); margin:-15px -15px 0; background:#eef4fb; color:#0f2447; font-family:Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .nb-admin-sidebar { width:235px; flex:0 0 235px; background:linear-gradient(180deg,#0962c8,#074fb1); color:#fff; box-shadow:8px 0 24px rgba(8,65,140,.18); }
        .nb-admin-brand { height:86px; display:flex; align-items:center; gap:12px; padding:0 28px; border-bottom:1px solid rgba(255,255,255,.13); }
        .nb-admin-logo { width:38px; height:38px; display:grid; place-items:center; font-size:24px; font-weight:900; }
        .nb-admin-brand-name { font-size:21px; font-weight:800; white-space:nowrap; }
        .nb-admin-nav { padding:18px 14px; display:flex; flex-direction:column; gap:6px; }
        .nb-admin-nav button { border:0; background:transparent; color:#fff; text-align:left; padding:13px 16px; border-radius:8px; display:flex; gap:14px; align-items:center; font-size:15px; font-weight:750; opacity:.95; }
        .nb-admin-nav button:hover, .nb-admin-nav button.active { background:rgba(255,255,255,.15); box-shadow:inset 0 0 0 1px rgba(255,255,255,.08); }
        .nb-admin-nav span { width:24px; font-size:22px; display:inline-grid; place-items:center; }
        .nb-admin-shell { flex:1; min-width:0; }
        .nb-admin-topbar { height:86px; display:flex; align-items:center; justify-content:space-between; padding:0 34px; background:linear-gradient(90deg,#085bc4,#0756ba,#0c62c9); box-shadow:0 3px 16px rgba(20,70,130,.2); }
        .nb-admin-search { position:relative; width:min(620px,50vw); height:48px; background:#f9fbff; border:1px solid rgba(255,255,255,.65); border-radius:8px; display:flex; align-items:center; gap:12px; padding:0 14px; box-shadow:0 8px 20px rgba(0,0,0,.12) inset, 0 6px 18px rgba(0,0,0,.07); }
        .nb-admin-search span { color:#486386; font-size:28px; line-height:1; }
        .nb-admin-search input { border:0; outline:0; background:transparent; width:100%; font-size:15px; color:#1f365a; }
        .nb-admin-search-results { display:none; position:absolute; top:53px; left:0; right:0; background:#fff; border:1px solid var(--line); border-radius:10px; overflow:hidden; z-index:100; box-shadow:0 16px 36px rgba(20,50,90,.22); }
        .nb-admin-search-item { padding:12px 14px; border-bottom:1px solid #eef3fa; cursor:pointer; }
        .nb-admin-search-item:hover { background:#f4f8ff; }
        .nb-admin-user { display:flex; align-items:center; gap:12px; color:#fff; }
        .nb-admin-user strong { display:block; font-size:15px; line-height:1.1; }
        .nb-admin-user small { display:block; color:#dbe9ff; font-size:12px; margin-top:3px; }
        .nb-admin-avatar { width:44px; height:44px; border-radius:50%; display:grid; place-items:center; background:#fff; color:#075cc6; font-weight:900; border:3px solid rgba(255,255,255,.55); box-shadow:0 5px 15px rgba(0,0,0,.18); }
        .nb-admin-icon { position:relative; font-size:23px; }
        .nb-admin-icon b { position:absolute; right:-9px; top:-9px; background:#f04b46; color:#fff; border-radius:99px; min-width:18px; height:18px; padding:0 4px; font-size:11px; display:grid; place-items:center; }
        .nb-admin-content { padding:18px 28px 34px; }
        .nb-admin-kpis { display:grid; grid-template-columns:repeat(4,minmax(180px,1fr)); gap:16px; margin-bottom:16px; }
        .nb-admin-kpi { color:#fff; min-height:86px; border-radius:4px; padding:18px 22px; box-shadow:0 8px 18px rgba(25,55,100,.16); display:flex; align-items:center; gap:18px; cursor:pointer; transition:.15s ease; }
        .nb-admin-kpi:hover { transform:translateY(-1px); box-shadow:0 12px 26px rgba(25,55,100,.22); }
        .nb-admin-kpi-icon { font-size:34px; width:42px; text-align:center; }
        .nb-admin-kpi h4 { margin:0 0 4px; color:#fff; font-size:15px; font-weight:800; opacity:.95; }
        .nb-admin-kpi b { display:block; font-size:29px; line-height:1; }
        .nb-admin-kpi small { display:block; margin-top:6px; color:#fff; opacity:.9; }
        .nb-admin-blue { background:linear-gradient(135deg,#3d8af2,#2a66d2); }
        .nb-admin-red { background:linear-gradient(135deg,#ef625b,#dc4740); }
        .nb-admin-green { background:linear-gradient(135deg,#4dab6b,#2f8d51); }
        .nb-admin-orange { background:linear-gradient(135deg,#ffb144,#f39b20); }
        .nb-admin-card { background:#fff; border:1px solid var(--line); border-radius:5px; box-shadow:0 6px 18px rgba(25,55,100,.09); overflow:hidden; }
        .nb-admin-card-head { min-height:54px; padding:0 20px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; }
        .nb-admin-card-head h3 { margin:0; font-size:18px; font-weight:850; color:#0c2146; }
        .nb-admin-card-head span { color:#9aabc2; font-size:24px; letter-spacing:2px; }
        .nb-admin-grid { display:grid; gap:14px; }
        .nb-admin-grid-main { grid-template-columns:2fr 1.05fr; align-items:start; }
        .nb-admin-quick-row { grid-template-columns:1fr 1fr 1fr; margin-top:14px; }
        .nb-admin-bottom-grid { grid-template-columns:1.35fr .9fr 1fr 1fr; margin-top:14px; align-items:start; }
        .nb-admin-tabs { display:flex; padding:18px 20px 0; }
        .nb-admin-tabs button { border:1px solid var(--line); background:#eef3fb; padding:8px 22px; color:#3f5a85; font-weight:800; }
        .nb-admin-tabs button:first-child { border-radius:4px 0 0 4px; }
        .nb-admin-tabs button:last-child { border-radius:0 4px 4px 0; }
        .nb-admin-tabs button.active { background:#fff; color:#0c2146; box-shadow:0 2px 5px rgba(20,50,90,.08); }
        .nb-admin-chart { padding:16px 20px 18px; min-height:220px; }
        .nb-admin-bars { height:180px; display:flex; align-items:flex-end; gap:16px; border-top:1px solid #e6edf7; border-bottom:1px solid #e6edf7; background:repeating-linear-gradient(to top,#fff,#fff 35px,#eef3fa 36px); padding:0 18px 18px; }
        .nb-admin-bar-wrap { flex:1; min-width:35px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; gap:5px; }
        .nb-admin-bar { width:28px; border-radius:3px 3px 0 0; background:linear-gradient(180deg,#7badf3,#3f7ed8); min-height:6px; box-shadow:0 5px 12px rgba(40,90,160,.18); }
        .nb-admin-bar.expense { background:linear-gradient(180deg,#ff9087,#ea5b51); opacity:.85; }
        .nb-admin-bar-label { font-size:12px; color:#546887; white-space:nowrap; }
        .nb-admin-facility-patient { margin:16px; border:1px solid var(--line); border-radius:6px; overflow:hidden; background:#f8fbff; }
        .nb-admin-patient-top { display:grid; grid-template-columns:70px 1fr; gap:14px; padding:18px; align-items:center; }
        .nb-admin-patient-avatar { width:58px; height:58px; border-radius:50%; background:linear-gradient(135deg,#d8e7fb,#fff); display:grid; place-items:center; color:#2768bd; font-weight:900; font-size:22px; border:2px solid #fff; box-shadow:0 4px 12px rgba(20,50,90,.12); }
        .nb-admin-patient-name { font-size:21px; font-weight:900; color:#10284d; }
        .nb-admin-patient-id { color:#446188; margin-top:4px; }
        .nb-admin-patient-meta { border-top:1px solid var(--line); padding:14px 18px; font-weight:750; }
        .nb-admin-patient-actions { display:grid; grid-template-columns:1fr 1fr 1fr; border-top:1px solid var(--line); }
        .nb-admin-patient-actions button { border:0; background:#fff; border-right:1px solid var(--line); padding:12px 8px; color:#2768bd; font-weight:850; }
        .nb-admin-patient-actions button:last-child { border-right:0; }
        .nb-admin-quick-card { background:#fff; border:1px solid var(--line); border-radius:5px; padding:18px 18px 16px; min-height:128px; box-shadow:0 6px 18px rgba(25,55,100,.09); }
        .nb-admin-quick-title { display:flex; align-items:center; gap:12px; font-size:18px; font-weight:900; color:#10284d; padding-bottom:14px; border-bottom:1px solid var(--line); }
        .nb-admin-quick-title span { font-size:30px; color:#1466c5; }
        .nb-admin-quick-actions { display:flex; gap:10px; align-items:center; justify-content:center; padding-top:16px; }
        .nb-admin-primary-btn, .nb-admin-green-btn { border:0; color:#fff; border-radius:4px; font-weight:850; padding:9px 30px; box-shadow:0 4px 10px rgba(20,70,140,.18); }
        .nb-admin-primary-btn { background:#1466d3; }
        .nb-admin-green-btn { background:#40a865; }
        .nb-admin-list-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; border-bottom:1px solid var(--line); cursor:pointer; }
        .nb-admin-list-row:hover { background:#f8fbff; }
        .nb-admin-list-row:last-child { border-bottom:0; }
        .nb-admin-list-title { font-weight:850; color:#10284d; }
        .nb-admin-list-sub { color:var(--muted); font-size:12px; margin-top:3px; }
        .nb-admin-row-left { display:flex; align-items:center; gap:12px; min-width:0; }
        .nb-admin-row-icon { width:32px; height:32px; border-radius:8px; display:grid; place-items:center; background:#eaf3ff; color:#1766c3; font-size:18px; flex:0 0 32px; }
        .nb-admin-tag { color:#d85c50; font-weight:850; white-space:nowrap; }
        .nb-admin-note-actions { border-top:1px solid var(--line); padding:10px 14px; text-align:right; }
        .nb-admin-note-actions button { border:0; background:#1466d3; color:#fff; border-radius:4px; padding:8px 16px; font-weight:850; }
        .nb-admin-empty { color:var(--muted); text-align:center; padding:30px; }
        @media(max-width:1250px){ .nb-admin-sidebar{width:86px;flex-basis:86px}.nb-admin-brand-name,.nb-admin-nav button{font-size:0}.nb-admin-nav span{font-size:24px}.nb-admin-kpis{grid-template-columns:repeat(2,1fr)}.nb-admin-grid-main,.nb-admin-bottom-grid{grid-template-columns:1fr}.nb-admin-quick-row{grid-template-columns:1fr}.nb-admin-search{width:48vw} }
        @media(max-width:760px){ .nb-admin-app{display:block;margin:0}.nb-admin-sidebar{display:none}.nb-admin-topbar{height:auto;gap:12px;flex-direction:column;align-items:stretch;padding:12px}.nb-admin-search{width:100%}.nb-admin-content{padding:12px}.nb-admin-kpis{grid-template-columns:1fr}.nb-admin-user{justify-content:flex-end}.nb-admin-patient-actions{grid-template-columns:1fr} }
      </style>
    `);
  }

  bind_events() {
    $(document).on("click", ".nb-admin-nav button", (e) => {
      const $btn = $(e.currentTarget);
      $(".nb-admin-nav button").removeClass("active");
      $btn.addClass("active");
      const route = $btn.data("route");
      const action = $btn.data("action");
      if (route) this.go_route(route);
      if (action === "settings") this.open_settings();
    });

    $(document).on("click", "[data-admin-route]", (e) => {
      const route = $(e.currentTarget).attr("data-admin-route");
      this.go_route(route);
    });

    $("#nb-admin-open-reports").on("click", () => this.go_route("clinic-reports"));

    $("#nb-admin-search").on("input", () => {
      clearTimeout(this.search_timer);
      const query = $("#nb-admin-search").val().trim();
      this.search_timer = setTimeout(() => this.search_global(query), 250);
    });

    $(document).on("click", function (e) {
      if (!$(e.target).closest(".nb-admin-search").length) {
        $("#nb-admin-search-results").hide();
      }
    });
  }

  call(method, args, callback) {
    frappe.call({
      method: `${this.method_base}.${method}`,
      args: args || {},
      freeze: false,
      callback: (r) => callback && callback(r.message),
      error: () => frappe.show_alert({ message: `Failed to load ${method}`, indicator: "red" }),
    });
  }

  load_dashboard() {
    this.call("get_admin_dashboard", { days: 30 }, (data) => {
      this.dashboard = data || {};
      this.render_kpis(this.dashboard.kpis || {});
      this.render_chart(this.dashboard.chart || {});
      this.render_facility(this.dashboard.facility || {});
      this.render_quick_cards(this.dashboard.quick_cards || []);
      this.render_list("#nb-admin-activities", this.dashboard.recent_activities || []);
      this.render_list("#nb-admin-settings", this.dashboard.settings || []);
      this.render_list("#nb-admin-tasks", this.dashboard.tasks || []);
      this.render_list("#nb-admin-reports", this.dashboard.reports || []);
    });
  }

  render_kpis(k) {
    const cards = [
      { label: "Total Patients", value: this.num(k.total_patients), icon: "👤", color: "blue", route: "List/Patient" },
      { label: "Monthly Revenue", value: `EGP ${this.money(k.monthly_revenue)}`, icon: "▟", color: "red", route: "query-report/Clinic Revenue Summary", sub: `Today EGP ${this.money(k.revenue_today)}` },
      { label: "Pending Appointments", value: this.num(k.pending_appointments), icon: "▦", color: "green", route: "List/Patient Appointment" },
      { label: "Low Stock Items", value: this.num(k.low_stock_items), icon: "⚠", color: "orange", route: "List/Bin" },
    ];
    $("#nb-admin-kpis").html(cards.map(c => `
      <div class="nb-admin-kpi nb-admin-${c.color}" data-admin-route="${this.esc(c.route)}">
        <div class="nb-admin-kpi-icon">${c.icon}</div>
        <div><h4>${this.esc(c.label)}</h4><b>${this.esc(c.value)}</b>${c.sub ? `<small>${this.esc(c.sub)}</small>` : ""}</div>
      </div>
    `).join(""));
  }

  render_chart(chart) {
    const labels = chart.labels || [];
    const revenue = chart.revenue || [];
    const expenses = chart.expenses || [];
    const max = Math.max(1, ...revenue, ...expenses);
    if (!labels.length) {
      $("#nb-admin-chart").html(`<div class="nb-admin-empty">No financial data found.</div>`);
      return;
    }
    const html = `<div class="nb-admin-bars">${labels.map((label, i) => {
      const rh = Math.max(6, Math.round((Number(revenue[i] || 0) / max) * 140));
      const eh = Math.max(6, Math.round((Number(expenses[i] || 0) / max) * 140));
      return `<div class="nb-admin-bar-wrap" title="${this.esc(label)}: Revenue ${this.money(revenue[i])}, Expenses ${this.money(expenses[i])}">
        <div style="display:flex; align-items:flex-end; gap:4px; height:145px;">
          <div class="nb-admin-bar" style="height:${rh}px"></div>
          <div class="nb-admin-bar expense" style="height:${eh}px"></div>
        </div>
        <div class="nb-admin-bar-label">${this.esc(label)}</div>
      </div>`;
    }).join("")}</div>`;
    $("#nb-admin-chart").html(html);
  }

  render_facility(facility) {
    const p = facility.patient || {};
    const patientRoute = p.name ? `Form/Patient/${encodeURIComponent(p.name)}` : "List/Patient";
    $("#nb-admin-facility").html(`
      <div class="nb-admin-facility-patient">
        <div class="nb-admin-patient-top">
          <div class="nb-admin-patient-avatar">${this.initials(p.display_name || "PT")}</div>
          <div>
            <div class="nb-admin-patient-name">${this.esc(p.display_name || "No recent patient")}</div>
            <div class="nb-admin-patient-id">${this.esc(p.name || "")}</div>
          </div>
        </div>
        <div class="nb-admin-patient-meta">
          <div>${this.esc(p.age_gender || "")}</div>
          <div>${this.esc(p.conditions || "")}</div>
        </div>
        <div class="nb-admin-patient-actions">
          <button data-admin-route="${this.esc(patientRoute)}">Clinical Notes</button>
          <button data-admin-route="List/Patient Encounter">Encounters</button>
          <button data-admin-route="List/Lab Test">Lab Tests</button>
        </div>
      </div>
      <div class="nb-admin-list-row" data-admin-route="List/Healthcare Practitioner"><div class="nb-admin-list-title">Active Doctors</div><b>${this.num(facility.active_doctors)}</b></div>
      <div class="nb-admin-list-row" data-admin-route="List/Healthcare Service Unit"><div class="nb-admin-list-title">Rooms / Service Units</div><b>${this.num(facility.rooms)}</b></div>
      <div class="nb-admin-list-row" data-admin-route="List/Inpatient Record"><div class="nb-admin-list-title">Today Admissions</div><b>${this.num(facility.today_admissions)}</b></div>
    `);
  }

  render_quick_cards(cards) {
    if (!cards.length) {
      $("#nb-admin-quick-cards").html(`<div class="nb-admin-empty">No quick cards.</div>`);
      return;
    }
    $("#nb-admin-quick-cards").html(cards.map((c, i) => {
      const route = this.route_string(c.route);
      const btnClass = i === 2 ? "nb-admin-green-btn" : "nb-admin-primary-btn";
      return `<section class="nb-admin-quick-card">
        <div class="nb-admin-quick-title"><span>${i === 0 ? "💳" : i === 1 ? "👥" : "🏥"}</span>${this.esc(c.label)}</div>
        <div class="nb-admin-quick-actions">
          <button class="${btnClass}" data-admin-route="${this.esc(route)}">${this.esc(c.button || "Open")}</button>
        </div>
      </section>`;
    }).join(""));
  }

  render_list(selector, rows) {
    if (!rows.length) {
      $(selector).html(`<div class="nb-admin-empty">No records found.</div>`);
      return;
    }
    $(selector).html(rows.map(row => {
      const route = this.route_string(row.route);
      const icon = row.icon || "●";
      const title = row.label || row.title || row.name || "Open";
      const sub = row.subtitle || row.time || "";
      const tag = row.status || "";
      return `<div class="nb-admin-list-row" data-admin-route="${this.esc(route)}">
        <div class="nb-admin-row-left">
          <div class="nb-admin-row-icon">${icon}</div>
          <div><div class="nb-admin-list-title">${this.esc(title)}</div>${sub ? `<div class="nb-admin-list-sub">${this.esc(sub)}</div>` : ""}</div>
        </div>
        ${tag ? `<div class="nb-admin-tag">${this.esc(tag)}</div>` : ""}
      </div>`;
    }).join(""));
  }

  search_global(query) {
    if (!query || query.length < 2) {
      $("#nb-admin-search-results").hide().html("");
      return;
    }
    this.call("search_global", { query }, (rows) => {
      rows = rows || [];
      if (!rows.length) {
        $("#nb-admin-search-results").html(`<div class="nb-admin-search-item">No results found</div>`).show();
        return;
      }
      $("#nb-admin-search-results").html(rows.map(row => `
        <div class="nb-admin-search-item" data-admin-route="${this.esc(this.route_string(row.route))}">
          <b>${this.esc(row.title || row.name)}</b>
          <div class="nb-admin-list-sub">${this.esc(row.type || "")} ${row.subtitle ? "• " + this.esc(row.subtitle) : ""}</div>
        </div>
      `).join("")).show();
    });
  }

  open_settings() {
    const settings = (this.dashboard.settings || []).find(row => row.label === "Clinic Settings");
    this.go_route(this.route_string(settings && settings.route ? settings.route : ["List", "System Settings"]));
  }

  go_route(route) {
    if (!route) return;
    const parts = String(route).split("/").map(decodeURIComponent);
    if (parts[0] === "query-report") {
      frappe.set_route("query-report", parts.slice(1).join("/"));
    } else if (parts[0] === "List") {
      frappe.set_route("List", parts.slice(1).join("/"));
    } else if (parts[0] === "Form") {
      frappe.set_route("Form", parts[1], parts.slice(2).join("/"));
    } else {
      frappe.set_route(parts.join("/"));
    }
  }

  route_string(route) {
    if (!route) return "clinic-admin-dashboard";
    if (Array.isArray(route)) return route.map(v => encodeURIComponent(v)).join("/");
    return String(route);
  }

  initials(value) {
    const words = String(value || "AD").trim().split(/\s+/).slice(0, 2);
    return words.map(w => w.charAt(0).toUpperCase()).join("") || "AD";
  }

  num(value) {
    return Number(value || 0).toLocaleString();
  }

  money(value) {
    return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  esc(value) {
    return frappe.utils.escape_html(String(value == null ? "" : value));
  }
}
