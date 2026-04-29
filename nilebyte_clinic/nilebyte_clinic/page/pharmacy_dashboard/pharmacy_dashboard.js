frappe.pages["pharmacy-dashboard"].on_page_load = function (wrapper) {
  new NBPharmacyDashboard(wrapper);
};

class NBPharmacyDashboard {
  constructor(wrapper) {
    this.wrapper = wrapper;
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: "Pharmacy Dashboard",
      single_column: true,
    });

    this.render();
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
              <div class="nb-brand-sub">Pharmacy Dept</div>
            </div>
          </div>
          <nav class="nb-nav">
            <button class="nb-nav-item active" data-nav="dashboard">
              <span class="nb-nav-icon">⌂</span>
              <span class="nb-nav-text">Dashboard</span>
            </button>
            <button class="nb-nav-item" data-nav="prescriptions">
              <span class="nb-nav-icon">💊</span>
              <span class="nb-nav-text">Prescriptions</span>
            </button>
            <button class="nb-nav-item" data-nav="inventory">
              <span class="nb-nav-icon">📦</span>
              <span class="nb-nav-text">Inventory</span>
            </button>
          </nav>
        </aside>

        <main class="nb-main">
          <header class="nb-topbar">
            <div class="nb-page-title">
              <h1>Pharmacy Dashboard</h1>
              <p>Medication Dispensing & Stock Control</p>
            </div>
            <div class="nb-top-actions">
              <div class="nb-search-bar">
                <span class="nb-search-icon">⌕</span>
                <input id="nb-pharmacy-search" placeholder="Search drugs or patients..." autocomplete="off" />
                <div id="nb-pharmacy-results" class="nb-quick-results"></div>
              </div>
              <div class="nb-user-profile">
                <div class="nb-avatar">${this.initials(frappe.session.user_fullname || "P")}</div>
              </div>
            </div>
          </header>

          <div class="nb-content nb-fade-in">
            <div id="nb-pharmacy-stats" class="nb-kpis"></div>

            <section class="nb-card">
              <div class="nb-card-header">
                <h3>Pending Prescriptions</h3>
                <button class="nb-btn nb-btn-secondary btn-xs" id="nb-refresh-pharmacy">Refresh</button>
              </div>
              <div id="nb-pharmacy-table" class="nb-table-container"></div>
            </section>
          </div>
          <div class="nb-last-updated" style="margin-top: 32px; opacity: 0.6; text-align: center;">
            Last sync: <span id="nb-last-updated">--</span>
          </div>
        </main>
      </div>
    `);
  }

  bind_events() {
    $(this.wrapper).on("click", ".nb-nav-item", (e) => {
      const nav = $(e.currentTarget).data("nav");
      this.handle_sidebar_nav(nav);
    });

    $("#nb-refresh-pharmacy").on("click", () => this.load_all());
  }

  handle_sidebar_nav(nav) {
    $(".nb-nav-item").removeClass("active");
    $(`.nb-nav-item[data-nav='${nav}']`).addClass("active");
    if (nav === "dashboard") this.load_all();
    if (nav === "prescriptions") this.scroll_to("#nb-pharmacy-table");
    if (nav === "inventory") frappe.set_route("List", "Item");
  }

  load_all(show_loading = true) {
    if (show_loading) {
      $("#nb-pharmacy-table").html(`<div class="nb-empty-soft">Loading prescriptions...</div>`);
    }
    frappe.call({
      method: "nilebyte_clinic.nilebyte_clinic.page.pharmacy_dashboard.pharmacy_dashboard.get_pharmacy_dashboard",
      callback: (r) => {
        const data = r.message || {};
        this.render_stats(data.stats || {});
        this.render_queue(data.prescriptions || []);
        this.set_updated();
      }
    });
  }

  render_stats(stats) {
    const cards = [
      { label: "Pending Dispensing", value: stats.pending || 0, icon: "💊", color: "orange" },
      { label: "Dispensed Today", value: stats.dispensed_today || 0, icon: "✓", color: "green" },
    ];
    $("#nb-pharmacy-stats").html(cards.map(c => `
      <div class="nb-kpi-card">
        <div class="nb-kpi-icon" style="background:var(--nb-primary)">${c.icon}</div>
        <div class="nb-kpi-info">
          <h4>${c.label}</h4>
          <div class="nb-kpi-value">${this.esc(c.value)}</div>
        </div>
      </div>
    `).join(""));
  }

  render_queue(rows) {
    if (!rows.length) {
      $("#nb-pharmacy-table").html(`<div class="nb-empty-soft">No pending prescriptions.</div>`);
      return;
    }
    $("#nb-pharmacy-table").html(`
      <table class="nb-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Medication</th>
            <th>Dosage</th>
            <th>Duration</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td><b>${this.esc(row.patient_name)}</b></td>
              <td>${this.esc(row.drug_name)}</td>
              <td>${this.esc(row.dosage)}</td>
              <td>${this.esc(row.period)}</td>
              <td>
                <button class="nb-btn nb-btn-primary btn-xs" data-action="dispense" data-id="${this.esc(row.name)}">Dispense</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `);
    
    $("#nb-pharmacy-table [data-action='dispense']").on("click", (e) => {
        this.dispense_drug($(e.currentTarget).data("id"));
    });
  }

  dispense_drug(id) {
    frappe.call({
        method: "nilebyte_clinic.nilebyte_clinic.page.pharmacy_dashboard.pharmacy_dashboard.dispense_drug",
        args: { prescription_id: id },
        callback: (r) => {
            frappe.show_alert({ message: r.message.message, indicator: "green" });
            this.load_all(false);
        }
    });
  }

  set_updated() {
    $("#nb-last-updated").text(new Date().toLocaleTimeString());
  }

  initials(value) {
    return String(value || "U").split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase();
  }

  esc(value) {
    return frappe.utils.escape_html(String(value == null ? "" : value));
  }

  scroll_to(selector) {
    const target = $(selector);
    if (target.length) {
      $("html, body").animate({ scrollTop: target.offset().top - 90 }, 250);
    }
  }
}
