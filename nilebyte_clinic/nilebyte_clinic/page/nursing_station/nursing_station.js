// Nursing Station UI Upgrade
frappe.pages["nursing-station"].on_page_load = function (wrapper) {
  new NBNursingStation(wrapper);
};

class NBNursingStation {
  constructor(wrapper) {
    this.wrapper = wrapper;
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: "Nursing Station",
      single_column: true,
    });
    this.render();
    this.bind_events();
    this.load_all();
    setInterval(() => this.load_all(false), 30000);
  }

  render() {
    $(this.page.body).html(`
      <div class="nb-clinic-app">
        <aside class="nb-sidebar">
          <div class="nb-brand">
            <div class="nb-brand-logo">✦</div>
            <div class="nb-brand-text">
              <div class="nb-brand-title">ClinicWiser</div>
              <div class="nb-brand-sub">Nursing Station</div>
            </div>
          </div>
          <nav class="nb-nav">
            <button class="nb-nav-item active" data-nav="dashboard">⌂ Dashboard</button>
            <button class="nb-nav-item" data-nav="patients">👤 Patients</button>
          </nav>
        </aside>
        <main class="nb-main">
          <header class="nb-topbar">
            <div class="nb-page-title">
              <h1>Nursing Dashboard</h1>
              <p>Triage & Vital Signs Control</p>
            </div>
            <div class="nb-user-profile">
              <div class="nb-avatar">${this.initials(frappe.session.user_fullname)}</div>
            </div>
          </header>
          <div class="nb-content nb-fade-in">
            <div id="nb-nurse-stats" class="nb-kpis"></div>
            <div class="nb-grid nb-grid-2">
              <section class="nb-card">
                <div class="nb-card-header"><h3>Triage Queue</h3></div>
                <div id="nb-triage-table" class="nb-table-container"></div>
              </section>
              <section class="nb-card" id="nb-vitals-container">
                <div class="nb-card-header"><h3>Vitals Entry</h3></div>
                <div id="nb-nurse-patient-preview">
                    <div class="nb-empty-soft">Select patient from queue</div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    `);
  }

  bind_events() {
    $(this.wrapper).on("click", ".nb-nav-item", (e) => {
        const nav = $(e.currentTarget).data("nav");
        if (nav === "patients") frappe.set_route("List", "Patient");
    });
  }

  load_all(show_loading = true) {
    if (show_loading) $("#nb-triage-table").html(`<div class="nb-empty-soft">Syncing...</div>`);
    frappe.call({
      method: "nilebyte_clinic.nilebyte_clinic.page.nursing_station.nursing_station.get_nursing_dashboard",
      callback: (r) => {
        const data = r.message || {};
        this.render_stats(data.stats || {});
        this.render_queue(data.queue || []);
      }
    });
  }

  render_stats(stats) {
    const cards = [
      { label: "Pending Triage", value: stats.waiting || 0, icon: "⏱" },
      { label: "Done Today", value: stats.completed || 0, icon: "✓" },
    ];
    $("#nb-nurse-stats").html(cards.map(c => `
      <div class="nb-kpi-card">
        <div class="nb-kpi-icon" style="background:var(--nb-primary)">${c.icon}</div>
        <div class="nb-kpi-info"><h4>${c.label}</h4><div class="nb-kpi-value">${c.value}</div></div>
      </div>
    `).join(""));
  }

  render_queue(rows) {
    this.queue_rows = rows;
    if (!rows.length) return $("#nb-triage-table").html(`<div class="nb-empty-soft">No patients waiting.</div>`);
    $("#nb-triage-table").html(`
      <table class="nb-table">
        <thead><tr><th>Time</th><th>Patient</th><th>Action</th></tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${row.appointment_time}</td>
              <td><b>${row.patient_name}</b></td>
              <td><button class="nb-btn nb-btn-primary btn-xs" data-id="${row.name}">Take Vitals</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `);
    $("#nb-triage-table button").on("click", (e) => this.select_patient(rows.find(r => r.name === $(e.currentTarget).data("id"))));
  }

  select_patient(row) {
    this.selected_patient = row;
    $("#nb-nurse-patient-preview").html(`
      <div class="nb-fade-in">
        <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
          <div class="nb-avatar" style="width:50px; height:50px; border-radius:12px;">${this.initials(row.patient_name)}</div>
          <div><div style="font-weight:900; font-size:16px;">${row.patient_name}</div><div style="font-size:12px; opacity:0.6;">${row.patient}</div></div>
        </div>
        <div class="nb-form-grid">
            <div class="nb-form-group"><label>Weight (kg)</label><input type="number" id="vs-weight"></div>
            <div class="nb-form-group"><label>Height (cm)</label><input type="number" id="vs-height"></div>
            <div class="nb-form-group"><label>Temp (°C)</label><input type="number" id="vs-temp"></div>
            <div class="nb-form-group"><label>BP</label><input type="text" id="vs-bp" placeholder="120/80"></div>
            <button class="nb-btn nb-btn-primary" id="nb-save-vitals" style="margin-top:10px;">Save Vitals</button>
        </div>
      </div>
    `);
    $("#nb-save-vitals").on("click", () => this.save_vitals());
  }

  save_vitals() {
    const v = { weight: $("#vs-weight").val(), height: $("#vs-height").val(), temperature: $("#vs-temp").val(), bp: $("#vs-bp").val() };
    frappe.call({
        method: "nilebyte_clinic.nilebyte_clinic.page.nursing_station.nursing_station.save_vitals",
        args: { appointment: this.selected_patient.name, patient: this.selected_patient.patient, vitals: v },
        callback: (r) => {
            frappe.show_alert({ message: r.message.message, indicator: "green" });
            this.load_all(false);
            $("#nb-nurse-patient-preview").html(`<div class="nb-empty-soft">Vitals Saved! Select next patient.</div>`);
        }
    });
  }

  initials(n) { return String(n || "U").split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase(); }
}
