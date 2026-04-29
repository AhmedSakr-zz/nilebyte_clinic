frappe.pages["lab-dashboard"].on_page_load = function (wrapper) {
  new NBLabDashboard(wrapper);
};

class NBLabDashboard {
  constructor(wrapper) {
    this.wrapper = wrapper;
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: "Laboratory Dashboard",
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
              <div class="nb-brand-sub">Diagnostic Lab</div>
            </div>
          </div>
          <nav class="nb-nav">
            <button class="nb-nav-item active" data-nav="dashboard">
              <span class="nb-nav-icon">⌂</span>
              <span class="nb-nav-text">Dashboard</span>
            </button>
            <button class="nb-nav-item" data-nav="tests">
              <span class="nb-nav-icon">🔬</span>
              <span class="nb-nav-text">Test Requests</span>
            </button>
            <button class="nb-nav-item" data-nav="samples">
              <span class="nb-nav-icon">🧪</span>
              <span class="nb-nav-text">Samples</span>
            </button>
          </nav>
        </aside>

        <main class="nb-main">
          <header class="nb-topbar">
            <div class="nb-page-title">
              <h1>Lab Dashboard</h1>
              <p>Diagnostics & Test Results Management</p>
            </div>
            <div class="nb-top-actions">
              <div class="nb-search-bar">
                <span class="nb-search-icon">⌕</span>
                <input id="nb-lab-search" placeholder="Search tests or patients..." autocomplete="off" />
                <div id="nb-lab-results" class="nb-quick-results"></div>
              </div>
              <div class="nb-user-profile">
                <div class="nb-avatar">${this.initials(frappe.session.user_fullname || "L")}</div>
              </div>
            </div>
          </header>

          <div class="nb-content nb-fade-in">
            <div id="nb-lab-stats" class="nb-kpis"></div>

            <section class="nb-card">
              <div class="nb-card-header">
                <h3>Test Queue</h3>
                <button class="nb-btn nb-btn-secondary btn-xs" id="nb-refresh-lab">Refresh</button>
              </div>
              <div id="nb-lab-table" class="nb-table-container"></div>
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

    $("#nb-refresh-lab").on("click", () => this.load_all());
  }

  handle_sidebar_nav(nav) {
    $(".nb-nav-item").removeClass("active");
    $(`.nb-nav-item[data-nav='${nav}']`).addClass("active");
    if (nav === "dashboard") this.load_all();
    if (nav === "tests") this.scroll_to("#nb-lab-table");
  }

  load_all(show_loading = true) {
    if (show_loading) {
      $("#nb-lab-table").html(`<div class="nb-empty-soft">Loading lab queue...</div>`);
    }
    frappe.call({
      method: "nilebyte_clinic.nilebyte_clinic.page.lab_dashboard.lab_dashboard.get_lab_dashboard",
      callback: (r) => {
        const data = r.message || {};
        this.render_stats(data.stats || {});
        this.render_queue(data.tests || []);
        this.set_updated();
      }
    });
  }

  render_stats(stats) {
    const cards = [
      { label: "Tests Requested", value: stats.requested || 0, icon: "📥", color: "blue" },
      { label: "Samples Collected", value: stats.collected || 0, icon: "🧪", color: "orange" },
      { label: "Completed Today", value: stats.completed_today || 0, icon: "✓", color: "green" },
    ];
    $("#nb-lab-stats").html(cards.map(c => `
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
      $("#nb-lab-table").html(`<div class="nb-empty-soft">No pending lab tests.</div>`);
      return;
    }
    $("#nb-lab-table").html(`
      <table class="nb-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient</th>
            <th>Test Name</th>
            <th>Doctor</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${this.esc(row.request_date)}</td>
              <td><b>${this.esc(row.patient_name)}</b></td>
              <td>${this.esc(row.lab_test_name)}</td>
              <td>${this.esc(row.practitioner_name)}</td>
              <td><span class="nb-badge ${row.status === "Sample Collected" ? "nb-badge-blue" : "nb-badge-orange"}">${this.esc(row.status)}</span></td>
              <td>
                <div style="display:flex; gap:5px;">
                  ${row.status === "Requested" ? `<button class="nb-btn nb-btn-secondary btn-xs" data-action="collect" data-id="${this.esc(row.name)}">Collect Sample</button>` : ""}
                  <button class="nb-btn nb-btn-primary btn-xs" data-action="result" data-id="${this.esc(row.name)}">Enter Result</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `);
    
    $("#nb-lab-table [data-action='collect']").on("click", (e) => {
        this.collect_sample($(e.currentTarget).data("id"));
    });
    $("#nb-lab-table [data-action='result']").on("click", (e) => {
        this.open_result_dialog($(e.currentTarget).data("id"));
    });
  }

  collect_sample(id) {
    frappe.call({
        method: "nilebyte_clinic.nilebyte_clinic.page.lab_dashboard.lab_dashboard.collect_sample",
        args: { test_id: id },
        callback: (r) => {
            frappe.show_alert({ message: r.message.message, indicator: "green" });
            this.load_all(false);
        }
    });
  }

  open_result_dialog(id) {
    const d = new frappe.ui.Dialog({
        title: "Enter Lab Results",
        fields: [
            { fieldname: "value", label: "Result Value", fieldtype: "Data", reqd: 1 },
            { fieldname: "notes", label: "Findings / Notes", fieldtype: "Small Text" }
        ],
        primary_action_label: "Submit & Complete",
        primary_action: (values) => {
            frappe.call({
                method: "nilebyte_clinic.nilebyte_clinic.page.lab_dashboard.lab_dashboard.submit_result",
                args: { test_id: id, result_data: values },
                callback: (r) => {
                    d.hide();
                    frappe.show_alert({ message: r.message.message, indicator: "green" });
                    this.load_all(false);
                }
            });
        }
    });
    d.show();
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
