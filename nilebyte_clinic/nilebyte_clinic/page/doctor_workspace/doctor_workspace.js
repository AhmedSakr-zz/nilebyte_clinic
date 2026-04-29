frappe.pages["doctor-workspace"].on_page_load = function (wrapper) {
  new NBDoctorWorkspace(wrapper);
};

class NBDoctorWorkspace {
  constructor(wrapper) {
    this.wrapper = wrapper;
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: "Doctor Workspace",
      single_column: true,
    });

    this.method_base = "nilebyte_clinic.nilebyte_clinic.page.doctor_workspace.doctor_workspace";
    this.active_appointment = null;
    this.active_patient = null;
    this.active_encounter = null;
    this.dashboard = {};
    this.search_timer = null;

    this.render();
    this.bind_events();
    this.load_dashboard();

    this.refresh_interval = setInterval(() => this.load_dashboard(false), 30000);
  }

  render() {
    $(this.page.body).html(`
      <div class="nb-clinic-app">
        <aside class="nb-sidebar">
          <div class="nb-brand">
            <div class="nb-brand-logo">✦</div>
            <div class="nb-brand-text">
              <div class="nb-brand-title">ClinicWiser</div>
              <div class="nb-brand-sub">Doctor Portal</div>
            </div>
          </div>
          <nav class="nb-nav">
            <button class="nb-nav-item active" data-route="doctor-workspace">
              <span class="nb-nav-icon">⌂</span>
              <span class="nb-nav-text">Dashboard</span>
            </button>
            <button class="nb-nav-item" data-route="List/Patient Appointment">
              <span class="nb-nav-icon">📅</span>
              <span class="nb-nav-text">Schedule</span>
            </button>
            <button class="nb-nav-item" data-route="List/Patient">
              <span class="nb-nav-icon">👤</span>
              <span class="nb-nav-text">Patients</span>
            </button>
            <button class="nb-nav-item" data-action="tasks">
              <span class="nb-nav-icon">▣</span>
              <span class="nb-nav-text">Tasks</span>
            </button>
            <button class="nb-nav-item" data-route="query-report/Patient Visit History">
              <span class="nb-nav-icon">▥</span>
              <span class="nb-nav-text">History</span>
            </button>
          </nav>
        </aside>

        <main class="nb-main">
          <header class="nb-topbar">
            <div class="nb-page-title">
              <h1>Clinical Dashboard</h1>
              <p>Welcome back, ${this.esc(frappe.session.user_fullname || "Doctor")}</p>
            </div>
            <div class="nb-top-actions">
              <div class="nb-search-bar">
                <span class="nb-search-icon">⌕</span>
                <input id="nb-doc-search" placeholder="Quick patient lookup..." autocomplete="off" />
                <div id="nb-doc-search-results" class="nb-quick-results"></div>
              </div>
              <div class="nb-user-profile">
                <div class="nb-avatar">${this.initials(frappe.session.user_fullname || "DR")}</div>
              </div>
            </div>
          </header>

          <div class="nb-content nb-fade-in">
            <div id="nb-doc-stats" class="nb-kpis"></div>

            <div class="nb-grid nb-grid-2">
              <section class="nb-card" style="display:flex; flex-direction:column;">
                <div class="nb-card-header">
                  <h3>Active Consultations</h3>
                  <button class="nb-btn nb-btn-secondary btn-xs" onclick="frappe.set_route('List', 'Patient Appointment', {'status': 'With Doctor'})">View All</button>
                </div>
                <div id="nb-doc-queue" style="flex:1;">
                  <div class="nb-empty-soft">Loading queue...</div>
                </div>
              </section>

              <section class="nb-card">
                <div class="nb-card-header">
                  <h3>Current Patient</h3>
                  <div style="display:flex; gap:8px;">
                    <button class="nb-btn nb-btn-secondary btn-xs" id="nb-doc-history">🕒 History</button>
                    <button class="nb-btn nb-btn-secondary btn-xs" id="nb-doc-open-patient">👤 Profile</button>
                  </div>
                </div>
                <div id="nb-doc-patient-overview">
                  <div class="nb-empty-soft">Select a patient to begin consultation</div>
                </div>
              </section>
            </div>

            <div class="nb-grid nb-grid-3">
              <section class="nb-card">
                <div class="nb-card-header"><h3>Consultation Actions</h3></div>
                <div class="nb-form-grid">
                  <button class="nb-btn nb-btn-primary" id="nb-begin-visit">🩺 Start Clinical Notes</button>
                  <button class="nb-btn nb-btn-secondary" id="nb-create-rx">💊 New Prescription</button>
                  <button class="nb-btn nb-btn-secondary" id="nb-request-tests">🔬 Order Labs/Imaging</button>
                </div>
              </section>

              <section class="nb-card">
                <div class="nb-card-header"><h3>My Tasks</h3></div>
                <div id="nb-doc-tasks"></div>
              </section>

              <section class="nb-card">
                <div class="nb-card-header"><h3>Today's Performance</h3></div>
                <div id="nb-doc-medical-stats"></div>
              </section>
            </div>
          </div>
        </main>
      </div>
    `);
  }

  bind_events() {
    $(this.wrapper).on("click", ".nb-nav-item", (e) => {
      const route = $(e.currentTarget).data("route");
      const action = $(e.currentTarget).data("action");
      if (route) this.go(route);
      if (action === "tasks") frappe.set_route("List", "ToDo");
    });

    $(this.wrapper).on("click", ".nb-appt-item", (e) => {
      const appointment = $(e.currentTarget).data("appointment");
      const patient = $(e.currentTarget).data("patient");
      this.select_patient(appointment, patient);
    });

    $("#nb-begin-visit").on("click", () => this.start_visit());
    $("#nb-create-rx").on("click", () => this.open_prescription_dialog());
    $("#nb-request-tests").on("click", () => this.open_lab_dialog());

    $(this.wrapper).on("click", "#nb-doc-open-patient", () => {
      if (this.active_patient) frappe.set_route("Form", "Patient", this.active_patient);
    });
    $(this.wrapper).on("click", "#nb-doc-clinical-notes", () => this.open_visit_dialog());
    $(this.wrapper).on("click", "#nb-doc-prescribe", () => this.open_prescription_dialog());
    $(this.wrapper).on("click", "#nb-doc-labs", () => this.open_lab_dialog());
    $(this.wrapper).on("click", "#nb-doc-history", () => this.open_patient_history());

    $("#nb-doc-search").on("input", () => {
      clearTimeout(this.search_timer);
      const query = $("#nb-doc-search").val().trim();
      this.search_timer = setTimeout(() => this.search_patients(query), 250);
    });

    $(document).on("click", (e) => {
      if (!$(e.target).closest(".nb-search-bar").length) {
        $("#nb-doc-search-results").hide();
      }
    });
  }

  call(method, args = {}, callback = null) {
    frappe.call({
      method: `${this.method_base}.${method}`,
      args,
      freeze: false,
      callback: (r) => callback && callback(r.message),
    });
  }

  load_dashboard(show_loading = true) {
    if (show_loading) {
      $("#nb-doc-queue").html(`<div class="nb-empty-soft">Syncing...</div>`);
    }
    this.call("get_doctor_dashboard", {}, (data) => {
      this.dashboard = data || {};
      this.render_stats(this.dashboard.stats || {});
      this.render_queue(this.dashboard.queue || []);
      this.render_tasks(this.dashboard.tasks || []);
      this.render_medical_stats(this.dashboard.stats || {});

      if (!this.active_patient && this.dashboard.patient_summary) {
        this.active_patient = this.dashboard.patient_summary.name;
        const first = (this.dashboard.queue || [])[0];
        this.active_appointment = first ? first.appointment : null;
        this.render_patient(this.dashboard.patient_summary);
      } else if (this.active_patient) {
        this.call("get_patient_summary", { patient: this.active_patient }, (res) => this.render_patient(res));
      }
    });
  }

  render_stats(stats) {
    const cards = [
      { label: "Waiting", value: stats.waiting || 0, icon: "⏱", color: "orange" },
      { label: "With Me", value: stats.with_doctor || 0, icon: "👨‍⚕️", color: "blue" },
      { label: "Completed", value: stats.completed || 0, icon: "✓", color: "green" },
      { label: "Pending Labs", value: stats.pending_labs || 0, icon: "🔬", color: "sky" },
    ];
    $("#nb-doc-stats").html(cards.map(c => `
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
      $("#nb-doc-queue").html(`<div class="nb-empty-soft">Your clinical queue is empty.</div>`);
      return;
    }
    $("#nb-doc-queue").html(rows.map(row => {
      const selected = row.appointment === this.active_appointment ? "selected" : "";
      return `
        <div class="nb-appt-item ${selected}" data-appointment="${this.esc(row.appointment)}" data-patient="${this.esc(row.patient)}" style="display:flex; justify-content:space-between; align-items:center; padding:16px; border-bottom:1px solid var(--nb-border); cursor:pointer; transition:var(--nb-transition);">
            <div>
              <b style="font-size:15px; color:${selected ? 'var(--nb-primary)' : 'inherit'};">${this.esc(row.patient_name || "Patient")}</b>
              <div style="font-size:11px; color:var(--nb-text-muted);">${this.esc(this.time_label(row.time))} • ${this.esc(row.appointment_type)}</div>
            </div>
            <span class="nb-badge ${row.status === 'Waiting' ? 'nb-badge-orange' : 'nb-badge-blue'}">${this.esc(row.status)}</span>
        </div>
      `;
    }).join(""));
  }

  render_patient(patient) {
    if (!patient) {
      $("#nb-doc-patient-overview").html(`<div class="nb-empty-soft">Select a patient to begin.</div>`);
      return;
    }
    const initials = this.initials(patient.patient_name || patient.name || "P");
    $("#nb-doc-patient-overview").html(`
      <div class="nb-fade-in" style="padding:10px;">
        <div style="display:flex; gap:20px; align-items:center; margin-bottom:24px;">
          <div class="nb-avatar" style="width:70px; height:70px; border-radius:20px; font-size:28px;">${initials}</div>
          <div style="flex:1;">
            <h2 style="margin:0; font-family:'Outfit'; font-size:24px; font-weight:900;">${this.esc(patient.patient_name)}</h2>
            <div style="color:var(--nb-text-muted); font-weight:600;">${this.esc(patient.name)} • ${this.esc(patient.age_gender)}</div>
          </div>
          <span class="nb-badge nb-badge-green">${this.esc(patient.payment_status)}</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div style="background:var(--nb-surface); padding:16px; border-radius:12px;">
                <label style="display:block; font-size:11px; text-transform:uppercase; font-weight:800; color:var(--nb-text-muted); margin-bottom:8px;">Chronic Conditions</label>
                <div style="font-weight:700;">${this.esc(patient.chronic_diseases)}</div>
            </div>
            <div style="background:var(--nb-surface); padding:16px; border-radius:12px;">
                <label style="display:block; font-size:11px; text-transform:uppercase; font-weight:800; color:var(--nb-text-muted); margin-bottom:8px;">Drug Allergies</label>
                <div style="font-weight:700; color:var(--nb-danger);">${this.esc(patient.allergies)}</div>
            </div>
        </div>
        <div style="margin-top:20px; padding:16px; border:1.5px solid var(--nb-border); border-radius:16px; background:#fff;">
            <label style="display:block; font-size:11px; text-transform:uppercase; font-weight:800; color:var(--nb-text-muted); margin-bottom:10px;">Latest Diagnosis</label>
            <div style="font-weight:700; font-size:15px; color:var(--nb-primary);">${this.esc(patient.last_diagnosis)}</div>
        </div>
      </div>
    `);
  }

  render_tasks(tasks) {
    if (!tasks.length) {
      $("#nb-doc-tasks").html(`<div class="nb-empty-soft">No active tasks.</div>`);
      return;
    }
    $("#nb-doc-tasks").html(tasks.map(t => `
      <div style="display:flex; align-items:center; gap:12px; padding:12px; border-bottom:1px solid var(--nb-border);">
        <i style="color:var(--nb-primary); font-size:18px;">▣</i>
        <div style="flex:1; font-weight:600; font-size:14px;">${this.esc(t.title)}</div>
        <span class="nb-badge nb-badge-blue" style="padding:4px 8px; font-size:10px;">${this.esc(t.status)}</span>
      </div>
    `).join(""));
  }

  render_medical_stats(stats) {
    $("#nb-doc-medical-stats").html(`
      <div style="display:grid; gap:16px; padding:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--nb-border); padding-bottom:12px;">
            <span style="font-weight:600; color:var(--nb-text-muted);">Today's Revenue</span>
            <b style="font-size:18px; color:var(--nb-success);">Check Admin Dashboard</b>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:600; color:var(--nb-text-muted);">Patients Completed</span>
            <b style="font-size:18px;">${stats.completed || 0}</b>
        </div>
      </div>
    `);
  }

  select_patient(appointment, patient) {
    this.active_appointment = appointment;
    this.active_patient = patient;
    this.active_encounter = null;
    $(".nb-appt-item").removeClass("selected");
    $(`.nb-appt-item[data-appointment="${this.esc(appointment)}"]`).addClass("selected");
    this.call("get_patient_summary", { patient }, (data) => this.render_patient(data));
  }

  start_visit() {
    if (!this.active_appointment) return frappe.msgprint("Please select a patient from the queue.");
    this.call("start_visit", { appointment: this.active_appointment }, (res) => {
      this.active_encounter = res && res.encounter;
      frappe.show_alert({ message: "Clinical Encounter Started", indicator: "green" });
      this.load_dashboard(false);
      this.open_visit_dialog();
    });
  }

  open_visit_dialog() {
    if (!this.active_patient || !this.active_appointment) return frappe.msgprint("Select a patient first.");
    const d = new frappe.ui.Dialog({
      title: "Consultation & Clinical Notes",
      size: "large",
      fields: [
        { fieldname: "sb1", fieldtype: "Section Break", label: "Patient Vitals" },
        { fieldname: "bp", fieldtype: "Data", label: "Blood Pressure", columns: 6 },
        { fieldname: "pulse", fieldtype: "Data", label: "Pulse", columns: 6 },
        { fieldname: "temp", fieldtype: "Data", label: "Temperature", columns: 6 },
        { fieldname: "weight", fieldtype: "Data", label: "Weight (kg)", columns: 6 },
        { fieldname: "sb2", fieldtype: "Section Break", label: "Clinical Assessment" },
        { fieldname: "chief_complaint", fieldtype: "Small Text", label: "Chief Complaint", reqd: 1 },
        { fieldname: "diagnosis", fieldtype: "Small Text", label: "Diagnosis / Assessment" },
        { fieldname: "doctor_notes", fieldtype: "Text", label: "Clinical Notes & Observations" },
        { fieldname: "sb3", fieldtype: "Section Break", label: "Plan" },
        { fieldname: "followup_date", fieldtype: "Date", label: "Follow-up Date" },
      ],
      primary_action_label: "Save & Finalize",
      primary_action: (values) => this.save_visit(values, true, d),
      secondary_action_label: "Save Draft",
      secondary_action: () => this.save_visit(d.get_values() || {}, false, d),
    });
    d.show();
  }

  save_visit(values, finish, dialog) {
    const payload = {
      appointment: this.active_appointment,
      patient: this.active_patient,
      encounter: this.active_encounter,
      chief_complaint: values.chief_complaint,
      diagnosis: values.diagnosis,
      doctor_notes: values.doctor_notes,
      followup_date: values.followup_date,
      vitals: { bp: values.bp, pulse: values.pulse, temperature: values.temp, weight: values.weight },
    };
    this.call(finish ? "finish_visit" : "save_visit_draft", { data: payload }, (res) => {
      if (res && res.encounter) this.active_encounter = res.encounter;
      frappe.show_alert({ message: finish ? "Visit Completed" : "Draft Saved", indicator: "green" });
      if (dialog && finish) dialog.hide();
      this.load_dashboard(false);
    });
  }

  open_prescription_dialog() {
    if (!this.active_patient) return frappe.msgprint("Select a patient first.");
    const d = new frappe.ui.Dialog({
      title: "Prescribe Medication",
      fields: [
        { fieldname: "medicine", label: "Medication", fieldtype: "Link", options: "Item", reqd: 1 },
        { fieldname: "dosage", label: "Dosage", fieldtype: "Data", placeholder: "e.g., 500mg" },
        { fieldname: "frequency", label: "Frequency", fieldtype: "Data", placeholder: "e.g., 1-0-1" },
        { fieldname: "duration", label: "Duration", fieldtype: "Data", placeholder: "e.g., 5 days" },
        { fieldname: "instructions", label: "Special Instructions", fieldtype: "Small Text" },
      ],
      primary_action_label: "Add to Record",
      primary_action: (values) => {
        const note = `Prescription: ${values.medicine} (${values.dosage}) - ${values.frequency} for ${values.duration}`;
        this.call("save_visit_draft", { data: { appointment: this.active_appointment, patient: this.active_patient, doctor_notes: note } }, () => {
          d.hide();
          frappe.show_alert({ message: "Medication added to encounter", indicator: "green" });
        });
      },
    });
    d.show();
  }

  open_lab_dialog() {
    if (!this.active_patient) return frappe.msgprint("Select a patient first.");
    const d = new frappe.ui.Dialog({
      title: "Order Investigations",
      fields: [
        { fieldname: "test", label: "Lab Test / Imaging", fieldtype: "Data", reqd: 1 },
        { fieldname: "priority", label: "Priority", fieldtype: "Select", options: "Routine\nUrgent\nSTAT" },
        { fieldname: "notes", label: "Clinical Indication", fieldtype: "Small Text" },
      ],
      primary_action_label: "Request Order",
      primary_action: (values) => {
        const note = `Order Requested: ${values.test} [${values.priority}] - ${values.notes || ''}`;
        this.call("save_visit_draft", { data: { appointment: this.active_appointment, patient: this.active_patient, doctor_notes: note } }, () => {
          d.hide();
          frappe.show_alert({ message: "Investigation request saved", indicator: "green" });
        });
      },
    });
    d.show();
  }

  open_patient_history() {
    if (this.active_patient) frappe.set_route("Form", "Patient", this.active_patient);
  }

  search_patients(query) {
    if (!query || query.length < 2) return $("#nb-doc-search-results").hide();
    frappe.call({
      method: "nilebyte_clinic.nilebyte_clinic.page.reception_workspace.reception_workspace.search_patient",
      args: { query },
      callback: (r) => {
        const rows = r.message || [];
        if (!rows.length) return $("#nb-doc-search-results").html(`<div style="padding:16px; opacity:0.6;">No patients found.</div>`).show();
        $("#nb-doc-search-results").html(rows.map(p => `
          <div class="nb-global-item" data-patient="${this.esc(p.name)}">
            <b>${this.esc(p.patient_name || p.name)}</b>
            <div style="font-size:11px;">${this.esc(p.name)} • ${this.esc(p.mobile || "No phone")}</div>
          </div>
        `).join("")).show();
        $(".nb-global-item[data-patient]").on("click", (e) => {
          this.active_patient = $(e.currentTarget).data("patient");
          this.active_appointment = null;
          this.call("get_patient_summary", { patient: this.active_patient }, (data) => this.render_patient(data));
          $("#nb-doc-search-results").hide();
        });
      },
    });
  }

  time_label(value) {
    if (!value) return "--:--";
    const p = String(value).split(":");
    return p.length >= 2 ? `${p[0]}:${p[1]}` : value;
  }

  go(route) { frappe.set_route(...String(route).split("/")); }
  initials(name) { return String(name || "P").split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase(); }
  esc(value) { return frappe.utils.escape_html(String(value == null ? "" : value)); }
}
