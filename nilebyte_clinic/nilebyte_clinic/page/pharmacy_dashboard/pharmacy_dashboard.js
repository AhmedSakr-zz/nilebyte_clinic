// Pharmacy Dashboard UI Upgrade
frappe.pages["pharmacy-dashboard"].on_page_load = function (wrapper) {
  new NBPharmacyDashboard(wrapper);
};

class NBPharmacyDashboard {
  constructor(wrapper) {
    this.wrapper = wrapper;
    this.page = frappe.ui.make_app_page({ parent: wrapper, title: "Pharmacy Dashboard", single_column: true });
    this.render();
    this.load_all();
    setInterval(() => this.load_all(false), 30000);
  }

  render() {
    $(this.page.body).html(`
      <div class="nb-clinic-app">
        <aside class="nb-sidebar">
          <div class="nb-brand"><div class="nb-brand-logo">✦</div><div class="nb-brand-text"><div class="nb-brand-title">ClinicWiser</div><div class="nb-brand-sub">Clinical Pharmacy</div></div></div>
          <nav class="nb-nav">
            <button class="nb-nav-item active">⌂ Dashboard</button>
            <button class="nb-nav-item" onclick="frappe.set_route('List', 'Item', {'item_group': 'Medication'})">📦 Stock</button>
          </nav>
        </aside>
        <main class="nb-main">
          <header class="nb-topbar"><div class="nb-page-title"><h1>Pharmacy Dashboard</h1><p>Dispensing & Medications</p></div><div class="nb-avatar">${this.initials(frappe.session.user_fullname)}</div></header>
          <div class="nb-content nb-fade-in">
            <div id="nb-pharm-stats" class="nb-kpis"></div>
            <section class="nb-card"><div class="nb-card-header"><h3>Pending Prescriptions</h3></div><div id="nb-pharm-table" class="nb-table-container"></div></section>
          </div>
        </main>
      </div>
    `);
  }

  load_all(show_loading = true) {
    if (show_loading) $("#nb-pharm-table").html(`<div class="nb-empty-soft">Loading...</div>`);
    frappe.call({
      method: "nilebyte_clinic.nilebyte_clinic.page.pharmacy_dashboard.pharmacy_dashboard.get_pharmacy_dashboard",
      callback: (r) => {
        const data = r.message || {};
        this.render_stats(data.stats || {});
        this.render_queue(data.prescriptions || []);
      }
    });
  }

  render_stats(stats) {
    const cards = [{ label: "Pending", value: stats.pending || 0, icon: "💊" }, { label: "Dispensed Today", value: stats.dispensed_today || 0, icon: "✓" }];
    $("#nb-pharm-stats").html(cards.map(c => `
      <div class="nb-kpi-card">
        <div class="nb-kpi-icon" style="background:var(--nb-primary)">${c.icon}</div>
        <div class="nb-kpi-info"><h4>${c.label}</h4><div class="nb-kpi-value">${c.value}</div></div>
      </div>
    `).join(""));
  }

  render_queue(rows) {
    if (!rows.length) return $("#nb-pharm-table").html(`<div class="nb-empty-soft">No pending prescriptions.</div>`);
    $("#nb-pharm-table").html(`
      <table class="nb-table">
        <thead><tr><th>Patient</th><th>Medication</th><th>Dosage</th><th>Action</th></tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td><b>${row.patient_name}</b></td>
              <td>${row.drug_name || 'Medicine'}</td>
              <td>${row.dosage || ''} (${row.period || ''})</td>
              <td><button class="nb-btn nb-btn-primary btn-xs" data-action="dispense" data-id="${row.name}">Dispense</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `);
    $("#nb-pharm-table [data-action='dispense']").on("click", (e) => this.dispense($(e.currentTarget).data("id")));
  }

  dispense(id) {
    frappe.call({
        method: "nilebyte_clinic.nilebyte_clinic.page.pharmacy_dashboard.pharmacy_dashboard.dispense_drug",
        args: { prescription_id: id },
        callback: () => { frappe.show_alert({ message: "Medication Dispensed", indicator: "green" }); this.load_all(false); }
    });
  }

  initials(n) { return String(n || "U").split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase(); }
}
