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
      <div class="nb-clinic-app">
        <aside class="nb-sidebar">
          <div class="nb-brand">
            <div class="nb-brand-logo">✦</div>
            <div class="nb-brand-text">
              <div class="nb-brand-title">ClinicWiser</div>
              <div class="nb-brand-sub">Admin Portal</div>
            </div>
          </div>
          <nav class="nb-nav">
            <button class="nb-nav-item active" data-route="clinic-admin-dashboard">
              <span class="nb-nav-icon">⌂</span>
              <span class="nb-nav-text">Dashboard</span>
            </button>
            <button class="nb-nav-item" data-route="clinic-reports">
              <span class="nb-nav-icon">▥</span>
              <span class="nb-nav-text">Reports</span>
            </button>
            <button class="nb-nav-item" data-route="List/Healthcare Practitioner">
              <span class="nb-nav-icon">👥</span>
              <span class="nb-nav-text">Staff</span>
            </button>
            <button class="nb-nav-item" data-route="List/Item">
              <span class="nb-nav-icon">📦</span>
              <span class="nb-nav-text">Inventory</span>
            </button>
            <button class="nb-nav-item" data-route="List/Sales Invoice">
              <span class="nb-nav-icon">💳</span>
              <span class="nb-nav-text">Billing</span>
            </button>
            <button class="nb-nav-item" data-action="settings">
              <span class="nb-nav-icon">⚙</span>
              <span class="nb-nav-text">Settings</span>
            </button>
          </nav>
        </aside>

        <main class="nb-main">
          <header class="nb-topbar">
            <div class="nb-page-title">
              <h1>Clinic Administration</h1>
              <p>Global Performance Overview</p>
            </div>
            <div class="nb-top-actions">
              <div class="nb-search-bar">
                <span class="nb-search-icon">⌕</span>
                <input id="nb-admin-search" placeholder="Search records..." autocomplete="off" />
                <div id="nb-admin-search-results" class="nb-admin-search-results"></div>
              </div>
              <div class="nb-user-profile">
                <div class="nb-avatar">AD</div>
              </div>
            </div>
          </header>

          <div class="nb-content nb-fade-in">
            <div id="nb-admin-kpis" class="nb-kpis"></div>

            <div class="nb-grid nb-grid-2">
              <section class="nb-card">
                <div class="nb-card-header">
                  <h3>Financial Overview</h3>
                  <div class="nb-tabs" style="padding: 0;">
                    <button class="active" data-chart="revenue">Revenue</button>
                    <button data-chart="expenses">Expenses</button>
                  </div>
                </div>
                <div id="nb-admin-chart" style="height: 300px; padding: 20px;">
                  <div class="nb-empty-soft">Loading chart...</div>
                </div>
              </section>

              <section class="nb-card">
                <div class="nb-card-header"><h3>Facility Status</h3></div>
                <div id="nb-admin-facility" style="padding: 20px;"></div>
              </section>
            </div>

            <div id="nb-admin-quick-cards" class="nb-grid nb-grid-3"></div>

            <div class="nb-grid nb-grid-3">
              <section class="nb-card">
                <div class="nb-card-header"><h3>Recent Activities</h3></div>
                <div id="nb-admin-activities" class="nb-table-container"></div>
              </section>
              <section class="nb-card">
                <div class="nb-card-header"><h3>Active Tasks</h3></div>
                <div id="nb-admin-tasks" class="nb-table-container"></div>
              </section>
              <section class="nb-card">
                <div class="nb-card-header"><h3>System Status</h3></div>
                <div id="nb-admin-settings" class="nb-table-container"></div>
              </section>
            </div>
          </div>
        </main>
      </div>
    `);
  }

  bind_events() {
    $(this.wrapper).on("click", ".nb-nav-item", (e) => {
      const $btn = $(e.currentTarget);
      $(".nb-nav-item").removeClass("active");
      $btn.addClass("active");
      const route = $btn.data("route");
      const action = $btn.data("action");
      if (route) this.go_route(route);
      if (action === "settings") this.open_settings();
    });

    $(this.wrapper).on("click", "[data-admin-route]", (e) => {
      const route = $(e.currentTarget).attr("data-admin-route");
      this.go_route(route);
    });

    $("#nb-admin-search").on("input", () => {
      clearTimeout(this.search_timer);
      const query = $("#nb-admin-search").val().trim();
      this.search_timer = setTimeout(() => this.search_global(query), 250);
    });

    $(document).on("click", function (e) {
      if (!$(e.target).closest(".nb-search-bar").length) {
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
    });
  }

  render_kpis(k) {
    const cards = [
      { label: "Total Patients", value: this.num(k.total_patients), icon: "👤", color: "blue", route: "List/Patient" },
      { label: "Revenue", value: `EGP ${this.money(k.monthly_revenue)}`, icon: "💰", color: "red", route: "query-report/Clinic Revenue Summary" },
      { label: "Pending Appts", value: this.num(k.pending_appointments), icon: "📅", color: "green", route: "List/Patient Appointment" },
      { label: "Low Stock", value: this.num(k.low_stock_items), icon: "📦", color: "orange", route: "List/Bin" },
    ];
    $("#nb-admin-kpis").html(cards.map(c => `
      <div class="nb-kpi-card" data-admin-route="${this.esc(c.route)}">
        <div class="nb-kpi-icon" style="background:var(--nb-primary)">${c.icon}</div>
        <div class="nb-kpi-info">
            <h4>${c.label}</h4>
            <div class="nb-kpi-value">${this.esc(c.value)}</div>
        </div>
      </div>
    `).join(""));
  }

  render_chart(chart) {
    const labels = chart.labels || [];
    const revenue = chart.revenue || [];
    const expenses = chart.expenses || [];
    const max = Math.max(1, ...revenue, ...expenses);
    if (!labels.length) {
      $("#nb-admin-chart").html(`<div class="nb-empty-soft">No financial data found.</div>`);
      return;
    }
    const html = `<div style="display: flex; align-items: flex-end; height: 200px; gap: 10px; border-bottom: 1px solid var(--nb-border);">
        ${labels.map((label, i) => {
            const rh = Math.max(5, (revenue[i] / max) * 100);
            const eh = Math.max(5, (expenses[i] / max) * 100);
            return `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px;">
                    <div style="display: flex; gap: 2px; align-items: flex-end; height: 100px;">
                        <div style="width: 10px; height: ${rh}%; background: var(--nb-primary); border-radius: 2px 2px 0 0;"></div>
                        <div style="width: 10px; height: ${eh}%; background: var(--nb-danger); border-radius: 2px 2px 0 0;"></div>
                    </div>
                    <span style="font-size: 10px; color: var(--nb-text-muted)">${label}</span>
                </div>
            `;
        }).join("")}
    </div>`;
    $("#nb-admin-chart").html(html);
  }

  render_facility(facility) {
    $("#nb-admin-facility").html(`
      <div style="display: grid; gap: 15px;">
        <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--nb-surface); border-radius: 8px;">
            <span style="font-weight: 600;">Active Doctors</span>
            <b style="font-size: 18px;">${this.num(facility.active_doctors)}</b>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--nb-surface); border-radius: 8px;">
            <span style="font-weight: 600;">Service Units</span>
            <b style="font-size: 18px;">${this.num(facility.rooms)}</b>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--nb-surface); border-radius: 8px;">
            <span style="font-weight: 600;">Today Admissions</span>
            <b style="font-size: 18px;">${this.num(facility.today_admissions)}</b>
        </div>
      </div>
    `);
  }

  render_quick_cards(cards) {
    $("#nb-admin-quick-cards").html(cards.map((c, i) => `
      <section class="nb-card" style="display: flex; align-items: center; justify-content: space-between; padding: 20px;">
        <div style="font-weight: 800; font-family: 'Outfit'; font-size: 16px;">${this.esc(c.label)}</div>
        <button class="nb-btn nb-btn-primary" data-admin-route="${this.esc(this.route_string(c.route))}">${this.esc(c.button || "Open")}</button>
      </section>
    `).join(""));
  }

  render_list(selector, rows) {
    if (!rows.length) {
      $(selector).html(`<div class="nb-empty-soft">No records found.</div>`);
      return;
    }
    $(selector).html(`
        <div style="padding: 10px;">
            ${rows.map(row => `
                <div data-admin-route="${this.esc(this.route_string(row.route))}" 
                     style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--nb-border); cursor: pointer;">
                    <div class="nb-avatar" style="width: 32px; height: 32px; font-size: 14px;">${this.initials(row.label || row.title)}</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700;">${this.esc(row.label || row.title)}</div>
                        <div style="font-size: 11px; color: var(--nb-text-muted)">${this.esc(row.subtitle || "")}</div>
                    </div>
                </div>
            `).join("")}
        </div>
    `);
  }

  search_global(query) {
    if (!query || query.length < 2) {
      $("#nb-admin-search-results").hide();
      return;
    }
    this.call("search_global", { query }, (rows) => {
      rows = rows || [];
      if (!rows.length) {
        $("#nb-admin-search-results").html(`<div style="padding: 12px;">No results</div>`).show();
        return;
      }
      $("#nb-admin-search-results").html(rows.map(row => `
        <div class="nb-global-item" data-admin-route="${this.esc(this.route_string(row.route))}" style="padding: 12px; border-bottom: 1px solid var(--nb-border); cursor: pointer;">
          <b style="display:block;">${this.esc(row.title || row.name)}</b>
          <div style="font-size: 11px; color: var(--nb-text-muted)">${this.esc(row.type || "")}</div>
        </div>
      `).join("")).show();
    });
  }

  open_settings() {
    this.go_route("Form/NileByte Clinic Settings/NileByte Clinic Settings");
  }

  go_route(route) {
    if (!route) return;
    const parts = String(route).split("/").map(decodeURIComponent);
    frappe.set_route(...parts);
  }

  route_string(route) {
    if (!route) return "clinic-admin-dashboard";
    if (Array.isArray(route)) return route.map(v => encodeURIComponent(v)).join("/");
    return String(route);
  }

  initials(value) {
    const words = String(value || "A").trim().split(/\s+/).slice(0, 2);
    return words.map(w => w.charAt(0).toUpperCase()).join("") || "A";
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
