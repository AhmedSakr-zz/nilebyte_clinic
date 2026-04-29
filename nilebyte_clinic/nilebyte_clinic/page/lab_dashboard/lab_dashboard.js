// Lab Dashboard UI Upgrade
frappe.pages["lab-dashboard"].on_page_load = function (wrapper) {
  new NBLabDashboard(wrapper);
};

class NBLabDashboard {
  constructor(wrapper) {
    this.wrapper = wrapper;
    this.page = frappe.ui.make_app_page({ parent: wrapper, title: "Lab Dashboard", single_column: true });
    this.render();
    this.bind_events();
    this.load_all();
    setInterval(() => this.load_all(false), 30000);
  }

  render() {
    $(this.page.body).html(`
      <div class="nb-clinic-app">
        <aside class="nb-sidebar">
          <div class="nb-brand"><div class="nb-brand-logo">✦</div><div class="nb-brand-text"><div class="nb-brand-title">ClinicWiser</div><div class="nb-brand-sub">Diagnostic Lab</div></div></div>
          <nav class="nb-nav">
            <button class="nb-nav-item active">⌂ Dashboard</button>
            <button class="nb-nav-item" onclick="frappe.set_route('List', 'Lab Test')">🔬 All Tests</button>
          </nav>
        </aside>
        <main class="nb-main">
          <header class="nb-topbar"><div class="nb-page-title"><h1>Laboratory Dashboard</h1><p>Test Requests & Results</p></div><div class="nb-avatar">${this.initials(frappe.session.user_fullname)}</div></header>
          <div class="nb-content nb-fade-in">
            <div id="nb-lab-stats" class="nb-kpis"></div>
            <section class="nb-card">
              <div class="nb-card-header"><h3>Active Test Requests</h3></div>
              <div id="nb-lab-table" class="nb-table-container"></div>
            </section>
          </div>
        </main>
      </div>
    `);
  }

  bind_events() {}

  load_all(show_loading = true) {
    if (show_loading) $("#nb-lab-table").html(`<div class="nb-empty-soft">Loading...</div>`);
    frappe.call({
      method: "nilebyte_clinic.nilebyte_clinic.page.lab_dashboard.lab_dashboard.get_lab_dashboard",
      callback: (r) => {
        const data = r.message || {};
        this.render_stats(data.stats || {});
        this.render_queue(data.tests || []);
      }
    });
  }

  render_stats(stats) {
    const cards = [
      { label: "Requested", value: stats.requested || 0, icon: "📥" },
      { label: "Collected", value: stats.collected || 0, icon: "🧪" },
      { label: "Done Today", value: stats.completed_today || 0, icon: "✓" },
    ];
    $("#nb-lab-stats").html(cards.map(c => `
      <div class="nb-kpi-card">
        <div class="nb-kpi-icon" style="background:var(--nb-primary)">${c.icon}</div>
        <div class="nb-kpi-info"><h4>${c.label}</h4><div class="nb-kpi-value">${c.value}</div></div>
      </div>
    `).join(""));
  }

  render_queue(rows) {
    if (!rows.length) return $("#nb-lab-table").html(`<div class="nb-empty-soft">No tests pending.</div>`);
    $("#nb-lab-table").html(`
      <table class="nb-table">
        <thead><tr><th>Patient</th><th>Test</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td><b>${row.patient_name}</b></td>
              <td>${row.lab_test_name || 'Test'}</td>
              <td><span class="nb-badge ${row.status === 'Sample Collected' ? 'nb-badge-blue' : 'nb-badge-orange'}">${row.status}</span></td>
              <td>
                ${row.status === "Requested" ? `<button class="nb-btn nb-btn-secondary btn-xs" data-action="collect" data-id="${row.name}">Collect</button>` : ""}
                <button class="nb-btn nb-btn-primary btn-xs" data-action="result" data-id="${row.name}">Result</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `);
    $("#nb-lab-table [data-action='collect']").on("click", (e) => this.collect_sample($(e.currentTarget).data("id")));
    $("#nb-lab-table [data-action='result']").on("click", (e) => this.open_result_dialog($(e.currentTarget).data("id")));
  }

  collect_sample(id) {
    frappe.call({
        method: "nilebyte_clinic.nilebyte_clinic.page.lab_dashboard.lab_dashboard.collect_sample",
        args: { test_id: id },
        callback: () => { frappe.show_alert({ message: "Sample Collected", indicator: "green" }); this.load_all(false); }
    });
  }

  open_result_dialog(id) {
    const d = new frappe.ui.Dialog({
        title: "Enter Lab Results",
        fields: [{ fieldname: "value", label: "Result", fieldtype: "Data", reqd: 1 }, { fieldname: "notes", label: "Notes", fieldtype: "Small Text" }],
        primary_action: (v) => {
            frappe.call({
                method: "nilebyte_clinic.nilebyte_clinic.page.lab_dashboard.lab_dashboard.submit_result",
                args: { test_id: id, result_data: v },
                callback: () => { d.hide(); frappe.show_alert({ message: "Results Saved", indicator: "green" }); this.load_all(false); }
            });
        }
    });
    d.show();
  }

  initials(n) { return String(n || "U").split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase(); }
}
