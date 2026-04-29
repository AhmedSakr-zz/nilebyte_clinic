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

    this.active_filter = "all";
    this.queue_rows = [];
    this.selected_patient = null;

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
              <div class="nb-brand-sub">Nursing Unit</div>
            </div>
          </div>
          <nav class="nb-nav">
            <button class="nb-nav-item active" data-nav="dashboard">
              <span class="nb-nav-icon">⌂</span>
              <span class="nb-nav-text">Dashboard</span>
            </button>
            <button class="nb-nav-item" data-nav="queue">
              <span class="nb-nav-icon">☑</span>
              <span class="nb-nav-text">Triage Queue</span>
            </button>
            <button class="nb-nav-item" data-nav="patients">
              <span class="nb-nav-icon">👤</span>
              <span class="nb-nav-text">Patients</span>
            </button>
          </nav>
        </aside>

        <main class="nb-main">
          <header class="nb-topbar">
            <div class="nb-page-title">
              <h1>Nursing Dashboard</h1>
              <p>Triage & Vital Signs Management</p>
            </div>
            <div class="nb-top-actions">
              <div class="nb-search-bar">
                <span class="nb-search-icon">⌕</span>
                <input id="nb-nurse-search" placeholder="Search patients..." autocomplete="off" />
                <div id="nb-nurse-results" class="nb-quick-results"></div>
              </div>
              <div class="nb-user-profile">
                <div class="nb-avatar">${this.initials(frappe.session.user_fullname || "N")}</div>
              </div>
            </div>
          </header>

          <div class="nb-content nb-fade-in">
            <div id="nb-nurse-stats" class="nb-kpis"></div>

            <div class="nb-grid nb-grid-2">
              <section class="nb-card">
                <div class="nb-card-header">
                  <h3>Triage Queue</h3>
                  <button class="nb-btn nb-btn-secondary btn-xs" id="nb-refresh-queue">Refresh</button>
                </div>
                <div id="nb-triage-table" class="nb-table-container"></div>
              </section>

              <section class="nb-card">
                <div class="nb-card-header"><h3>Active Patient</h3></div>
                <div id="nb-nurse-patient-preview">
                    <div class="nb-empty-soft">Select a patient from the queue to take vitals.</div>
                </div>
              </section>
            </div>
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

    $("#nb-refresh-queue").on("click", () => this.load_all());

    $("#nb-nurse-search").on("input", (e) => {
        const query = $(e.currentTarget).val().trim();
        this.search_patients(query);
    });

    $(document).on("click", (e) => {
      if (!$(e.target).closest(".nb-search-bar").length) {
        $("#nb-nurse-results").hide();
      }
    });
  }

  handle_sidebar_nav(nav) {
    $(".nb-nav-item").removeClass("active");
    $(`.nb-nav-item[data-nav='${nav}']`).addClass("active");
    if (nav === "dashboard") this.load_all();
    if (nav === "queue") this.scroll_to("#nb-triage-table");
    if (nav === "patients") frappe.set_route("List", "Patient");
  }

  load_all(show_loading = true) {
    if (show_loading) {
      $("#nb-triage-table").html(`<div class="nb-empty-soft">Loading triage queue...</div>`);
    }
    frappe.call({
      method: "nilebyte_clinic.nilebyte_clinic.page.nursing_station.nursing_station.get_nursing_dashboard",
      callback: (r) => {
        const data = r.message || {};
        this.render_stats(data.stats || {});
        this.render_queue(data.queue || []);
        this.set_updated();
      }
    });
  }

  render_stats(stats) {
    const cards = [
      { label: "Pending Triage", value: stats.waiting || 0, icon: "⏱", color: "orange" },
      { label: "Completed Today", value: stats.completed || 0, icon: "✓", color: "green" },
    ];
    $("#nb-nurse-stats").html(cards.map(c => `
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
    this.queue_rows = rows;
    if (!rows.length) {
      $("#nb-triage-table").html(`<div class="nb-empty-soft">No patients waiting for triage.</div>`);
      return;
    }
    $("#nb-triage-table").html(`
      <table class="nb-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Patient</th>
            <th>Doctor</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${this.esc(row.appointment_time)}</td>
              <td><b>${this.esc(row.patient_name)}</b></td>
              <td>${this.esc(row.practitioner_name)}</td>
              <td>
                <button class="nb-btn nb-btn-primary btn-xs" data-action="take_vitals" data-id="${this.esc(row.name)}">Take Vitals</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `);
    $("#nb-triage-table [data-action='take_vitals']").on("click", (e) => {
        const id = $(e.currentTarget).data("id");
        const row = this.queue_rows.find(r => r.name === id);
        this.select_patient(row);
    });
  }

  select_patient(row) {
    this.selected_patient = row;
    $("#nb-nurse-patient-preview").html(`
      <div class="nb-card" style="margin:0; padding:20px;">
        <div style="display:flex; gap:15px; align-items:center; margin-bottom:20px;">
          <div class="nb-avatar" style="width:60px; height:60px; font-size:24px;">${this.initials(row.patient_name)}</div>
          <div>
            <div style="font-weight:800; font-size:18px;">${this.esc(row.patient_name)}</div>
            <div style="color:var(--nb-text-muted);">${this.esc(row.patient)}</div>
          </div>
        </div>
        <div style="display:grid; gap:12px;">
            <div class="nb-form-group">
                <label>Weight (kg)</label>
                <input type="number" class="form-control" id="vs-weight">
            </div>
            <div class="nb-form-group">
                <label>Height (cm)</label>
                <input type="number" class="form-control" id="vs-height">
            </div>
            <div class="nb-form-group">
                <label>Temp (°C)</label>
                <input type="number" class="form-control" id="vs-temp">
            </div>
            <div class="nb-form-group">
                <label>BP (Systolic/Diastolic)</label>
                <input type="text" class="form-control" id="vs-bp" placeholder="120/80">
            </div>
            <div class="nb-form-group">
                <label>SPO2 (%)</label>
                <input type="number" class="form-control" id="vs-spo2">
            </div>
            <button class="nb-btn nb-btn-primary w-100" style="margin-top:10px;" id="nb-save-vitals">Save & Send to Doctor</button>
        </div>
      </div>
    `);
    $("#nb-save-vitals").on("click", () => this.save_vitals());
  }

  save_vitals() {
    const vitals = {
        weight: $("#vs-weight").val(),
        height: $("#vs-height").val(),
        temperature: $("#vs-temp").val(),
        bp: $("#vs-bp").val(),
        spo2: $("#vs-spo2").val()
    };
    
    frappe.call({
        method: "nilebyte_clinic.nilebyte_clinic.page.nursing_station.nursing_station.save_vitals",
        args: {
            appointment: this.selected_patient.name,
            patient: this.selected_patient.patient,
            vitals: vitals
        },
        callback: (r) => {
            frappe.show_alert({ message: r.message.message, indicator: "green" });
            this.load_all(false);
            $("#nb-nurse-patient-preview").html(`<div class="nb-empty-soft">Vitals saved for ${this.esc(this.selected_patient.patient_name)}. Select next patient.</div>`);
        }
    });
  }

  search_patients(query) {
    if (!query || query.length < 2) {
      $("#nb-nurse-results").hide();
      return;
    }
    frappe.call({
      method: "nilebyte_clinic.nilebyte_clinic.page.nursing_station.nursing_station.search_patient",
      args: { query },
      callback: (r) => {
        const rows = r.message || [];
        if (!rows.length) {
          $("#nb-nurse-results").html(`<div style="padding:10px;">No results</div>`).show();
          return;
        }
        $("#nb-nurse-results").html(rows.map(p => `
          <div class="nb-global-item" data-patient="${this.esc(p.name)}" style="padding:10px; cursor:pointer; border-bottom:1px solid var(--nb-border);">
            <b>${this.esc(p.patient_name)}</b>
            <div style="font-size:11px; color:var(--nb-text-muted);">${this.esc(p.name)}</div>
          </div>
        `).join("")).show();
        $(`#nb-nurse-results .nb-global-item`).on("click", (e) => {
          const name = $(e.currentTarget).data("patient");
          frappe.set_route("Form", "Patient", name);
        });
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
