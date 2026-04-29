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
              <span class="nb-nav-icon">☑</span>
              <span class="nb-nav-text">My Schedule</span>
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
              <span class="nb-nav-text">Reports</span>
            </button>
          </nav>
        </aside>

        <main class="nb-main">
          <header class="nb-topbar">
            <div class="nb-page-title">
              <h1>Doctor Dashboard</h1>
              <p>Welcome back, ${this.esc(frappe.session.user_fullname || "Doctor")}</p>
            </div>
            <div class="nb-top-actions">
              <div class="nb-search-bar">
                <span class="nb-search-icon">⌕</span>
                <input id="nb-doc-search" placeholder="Search patients..." autocomplete="off" />
                <div id="nb-doc-search-results" class="nb-doc-search-results"></div>
              </div>
              <div class="nb-user-profile">
                <div class="nb-avatar">${this.initials(frappe.session.user_fullname || "DR")}</div>
              </div>
            </div>
          </header>

          <div class="nb-content nb-fade-in">
            <div id="nb-doc-stats" class="nb-kpis"></div>

            <div class="nb-grid nb-grid-2">
              <section class="nb-card">
                <div class="nb-card-header">
                  <h3>Today’s Appointments</h3>
                  <button class="nb-btn nb-btn-secondary btn-xs">•••</button>
                </div>
                <div id="nb-doc-queue" class="nb-doc-appointments">
                  <div class="nb-doc-empty">Loading queue...</div>
                </div>
              </section>

              <section class="nb-card">
                <div class="nb-card-header">
                  <h3>Patient Overview</h3>
                  <button class="nb-btn nb-btn-secondary btn-xs">•••</button>
                </div>
                <div id="nb-doc-patient-overview">
                  <div class="nb-doc-empty">Select a patient from today’s queue.</div>
                </div>
              </section>
            </div>

            <div class="nb-grid nb-grid-3">
              <section class="nb-card">
                <div class="nb-card-header"><h3>Actions</h3></div>
                <div style="display:flex; flex-direction:column; gap:12px;">
                  <button class="nb-btn nb-btn-primary" id="nb-begin-visit">🩺 Start Consultation</button>
                  <button class="nb-btn nb-btn-secondary" id="nb-create-rx">💊 New Prescription</button>
                  <button class="nb-btn nb-btn-secondary" id="nb-request-tests">🔬 Order Lab Tests</button>
                </div>
              </section>

              <section class="nb-card">
                <div class="nb-card-header"><h3>My Tasks</h3></div>
                <div id="nb-doc-tasks"></div>
              </section>

              <section class="nb-card">
                <div class="nb-card-header"><h3>Medical Stats</h3></div>
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

    $(this.wrapper).on("click", ".nb-doc-appt-body", (e) => {
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
    $(this.wrapper).on("click", "#nb-doc-add-note", () => this.add_note_dialog());

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
      error: (r) => {
        const msg = r && r.message ? r.message : "Something went wrong.";
        frappe.msgprint({ title: "Doctor Workspace", message: msg, indicator: "red" });
      },
    });
  }

  load_dashboard(show_loading = true) {
    if (show_loading) {
      $("#nb-doc-queue").html(`<div class="nb-doc-empty">Loading queue...</div>`);
    }
    this.call("get_doctor_dashboard", {}, (data) => {
      this.dashboard = data || {};
      this.render_stats(this.dashboard.stats || {});
      this.render_queue(this.dashboard.queue || []);
      this.render_tasks(this.dashboard.tasks || []);
      this.render_notes(this.dashboard.notes || []);
      this.render_medical_stats(this.dashboard.stats || {});

      if (!this.active_patient && this.dashboard.patient_summary) {
        this.active_patient = this.dashboard.patient_summary.name;
        const first = (this.dashboard.queue || [])[0];
        this.active_appointment = first ? first.appointment : null;
        this.render_patient(this.dashboard.patient_summary);
      } else if (!this.dashboard.patient_summary && !this.active_patient) {
        this.render_patient(null);
      }
    });
  }

  render_stats(stats) {
    const cards = [
      ["waiting", "Waiting", stats.waiting || 0, "⏱", "#f6a11a"],
      ["with_doctor", "With Doctor", stats.with_doctor || 0, "👨‍⚕️", "#4a8ff0"],
      ["completed", "Completed", stats.completed || 0, "✓", "#40aa62"],
      ["followups", "Follow-Ups", stats.followups || 0, "↺", "#8757d5"],
      ["pending_labs", "Pending Labs", stats.pending_labs || 0, "🔬", "#14a3b8"],
      ["unpaid", "Unpaid Visits", stats.unpaid || 0, "💳", "#e64a4a"],
    ];
    $("#nb-doc-stats").html(cards.map(c => `
      <div class="nb-doc-stat" data-stat="${c[0]}">
        <div class="nb-doc-stat-icon" style="background:${c[4]}">${c[3]}</div>
        <div><h4>${c[1]}</h4><b>${this.esc(c[2])}</b><small>Today</small></div>
      </div>
    `).join(""));
  }

  render_queue(rows) {
    if (!rows.length) {
      $("#nb-doc-queue").html(`<div class="nb-doc-empty">No appointments in your queue today.</div>`);
      return;
    }
    $("#nb-doc-queue").html(rows.map(row => {
      const cls = this.status_class(row.status);
      const selected = row.appointment === this.active_appointment ? "selected" : "";
      return `
        <div class="nb-doc-appt-row">
          <div class="nb-doc-appt-time">${this.esc(this.time_label(row.time))}</div>
          <div class="nb-doc-appt-body ${cls} ${selected}" data-appointment="${this.esc(row.appointment)}" data-patient="${this.esc(row.patient)}">
            <div>
              <b>${this.esc(row.patient_name || row.patient || "Patient")}</b>
              <small>${this.esc(row.appointment_type || "Consultation")} · ${this.esc(row.payment_status || "")}</small>
            </div>
            <div class="status">${this.esc(row.status || "Waiting")}</div>
          </div>
        </div>
      `;
    }).join(""));
  }

  render_patient(patient) {
    if (!patient) {
      $("#nb-doc-patient-overview").html(`<div class="nb-doc-empty">Select a patient from today’s queue.</div>`);
      return;
    }
    const initials = this.initials(patient.patient_name || patient.name || "P");
    $("#nb-doc-patient-overview").html(`
      <div class="nb-doc-patient-box">
        <div class="nb-doc-patient-main">
          <div class="nb-doc-patient-photo">${initials}</div>
          <div class="nb-doc-patient-info">
            <h2>${this.esc(patient.patient_name || patient.name)}</h2>
            <p>${this.esc(patient.name || "")}</p>
            <strong>${this.esc(patient.age_gender || "Age/Gender not recorded")}</strong>
            <strong>${this.esc(patient.chronic_diseases || "No chronic diseases recorded")}</strong>
            <p class="nb-doc-muted">Payment: ${this.esc(patient.payment_status || "Not Invoiced")}</p>
          </div>
        </div>
        <div class="nb-doc-patient-actions">
          <button id="nb-doc-clinical-notes">📄 Clinical Notes</button>
          <button id="nb-doc-prescribe">💊 Prescribe</button>
          <button id="nb-doc-labs">☑ Order Tests</button>
          <button id="nb-doc-history">♙ Patient History</button>
          <button id="nb-doc-open-patient">Open File</button>
        </div>
      </div>
    `);
  }

  render_tasks(tasks) {
    if (!tasks.length) {
      $("#nb-doc-tasks").html(`<div class="nb-doc-empty">No tasks.</div>`);
      return;
    }
    $("#nb-doc-tasks").html(tasks.map(t => `
      <div class="nb-doc-task"><i>▣</i><b>${this.esc(t.title || t.description || "Task")}</b><span>${this.esc(t.status || "Open")}</span></div>
    `).join(""));
  }

  render_medical_stats(stats) {
    $("#nb-doc-medical-stats").html(`
      <div class="nb-doc-stat-list">
        <div class="nb-doc-stat-line"><i>🛡</i><div><b>${this.esc(stats.patients_seen || stats.completed || 0)}</b>Patients Seen Today</div></div>
        <div class="nb-doc-stat-line"><i style="background:#48b36b">↓</i><div><b>${this.esc(stats.followups || 0)}</b>Pending Follow-Ups</div></div>
        <div class="nb-doc-stat-line"><i style="background:#cf624e">!</i><div><b>${this.esc(stats.pending_labs || 0)}</b>Pending Lab Results</div></div>
      </div>
    `);
  }

  render_notes(notes) {
    $("#nb-doc-notes").html(`
      <div class="nb-doc-notes-list">
        ${(notes || []).map(n => `<div class="nb-doc-note-line"><i>+</i><div>${this.esc(n.note || n.title || n.description || "Note")}</div></div>`).join("") || `<div class="nb-doc-empty">No quick notes.</div>`}
        <div class="nb-doc-note-actions"><button id="nb-doc-add-note">+ Add Note</button></div>
      </div>
    `);
  }

  select_patient(appointment, patient) {
    this.active_appointment = appointment;
    this.active_patient = patient;
    this.active_encounter = null;
    $(".nb-doc-appt-body").removeClass("selected");
    $(`.nb-doc-appt-body[data-appointment="${this.css_escape(appointment)}"]`).addClass("selected");
    this.call("get_patient_summary", { patient }, (data) => this.render_patient(data));
  }

  start_visit() {
    if (!this.active_appointment) {
      frappe.msgprint("Select an appointment first.");
      return;
    }
    this.call("start_visit", { appointment: this.active_appointment }, (res) => {
      this.active_encounter = res && res.encounter;
      frappe.show_alert({ message: (res && res.message) || "Visit started", indicator: "green" });
      this.load_dashboard(false);
      this.open_visit_dialog();
    });
  }

  open_visit_dialog() {
    if (!this.active_patient || !this.active_appointment) {
      frappe.msgprint("Select a patient appointment first.");
      return;
    }
    const d = new frappe.ui.Dialog({
      title: "Clinical Notes",
      size: "large",
      fields: [
        { fieldname: "vitals_section", fieldtype: "Section Break", label: "Vitals" },
        { fieldname: "bp", fieldtype: "Data", label: "BP" },
        { fieldname: "pulse", fieldtype: "Data", label: "Pulse" },
        { fieldname: "temperature", fieldtype: "Data", label: "Temperature" },
        { fieldname: "weight", fieldtype: "Data", label: "Weight" },
        { fieldname: "height", fieldtype: "Data", label: "Height" },
        { fieldname: "spo2", fieldtype: "Data", label: "SpO2" },
        { fieldname: "notes_section", fieldtype: "Section Break", label: "Consultation" },
        { fieldname: "chief_complaint", fieldtype: "Small Text", label: "Chief Complaint" },
        { fieldname: "history", fieldtype: "Small Text", label: "History" },
        { fieldname: "diagnosis", fieldtype: "Small Text", label: "Diagnosis" },
        { fieldname: "doctor_notes", fieldtype: "Text", label: "Doctor Notes" },
        { fieldname: "followup_date", fieldtype: "Date", label: "Follow-up Date" },
      ],
      primary_action_label: "Save Draft",
      primary_action: (values) => {
        this.save_visit(values, false, d);
      },
      secondary_action_label: "Finish Visit",
      secondary_action: () => {
        this.save_visit(d.get_values() || {}, true, d);
      },
    });
    d.show();
  }

  save_visit(values, finish, dialog) {
    values = values || {};
    const payload = {
      appointment: this.active_appointment,
      patient: this.active_patient,
      encounter: this.active_encounter,
      chief_complaint: values.chief_complaint,
      history: values.history,
      diagnosis: values.diagnosis,
      doctor_notes: values.doctor_notes,
      followup_date: values.followup_date,
      vitals: {
        bp: values.bp,
        pulse: values.pulse,
        temperature: values.temperature,
        weight: values.weight,
        height: values.height,
        spo2: values.spo2,
      },
    };
    this.call(finish ? "finish_visit" : "save_visit_draft", { data: payload }, (res) => {
      if (res && res.encounter) this.active_encounter = res.encounter;
      frappe.show_alert({ message: (res && res.message) || "Saved", indicator: "green" });
      if (dialog) dialog.hide();
      this.load_dashboard(false);
    });
  }

  open_prescription_dialog() {
    if (!this.active_patient) {
      frappe.msgprint("Select a patient first.");
      return;
    }
    const d = new frappe.ui.Dialog({
      title: "New Prescription",
      fields: [
        { fieldname: "medicine", label: "Medicine", fieldtype: "Link", options: "Item" },
        { fieldname: "dosage", label: "Dosage", fieldtype: "Data" },
        { fieldname: "frequency", label: "Frequency", fieldtype: "Data" },
        { fieldname: "duration", label: "Duration", fieldtype: "Data" },
        { fieldname: "instructions", label: "Instructions", fieldtype: "Small Text" },
      ],
      primary_action_label: "Save Note",
      primary_action: (values) => {
        const note = `Prescription: ${values.medicine || "Medicine"} ${values.dosage || ""} ${values.frequency || ""} ${values.duration || ""}\n${values.instructions || ""}`;
        this.call("save_visit_draft", { data: { appointment: this.active_appointment, patient: this.active_patient, doctor_notes: note } }, () => {
          d.hide();
          frappe.show_alert({ message: "Prescription note saved", indicator: "green" });
        });
      },
    });
    d.show();
  }

  open_lab_dialog() {
    if (!this.active_patient) {
      frappe.msgprint("Select a patient first.");
      return;
    }
    const d = new frappe.ui.Dialog({
      title: "Order Lab Tests",
      fields: [
        { fieldname: "test", label: "Test / Item", fieldtype: "Data", reqd: 1 },
        { fieldname: "priority", label: "Priority", fieldtype: "Select", options: "Routine\nUrgent" },
        { fieldname: "notes", label: "Notes", fieldtype: "Small Text" },
      ],
      primary_action_label: "Save Request Note",
      primary_action: (values) => {
        const note = `Lab Request: ${values.test} (${values.priority || "Routine"})\n${values.notes || ""}`;
        this.call("save_visit_draft", { data: { appointment: this.active_appointment, patient: this.active_patient, doctor_notes: note } }, () => {
          d.hide();
          frappe.show_alert({ message: "Lab request note saved", indicator: "green" });
        });
      },
    });
    d.show();
  }

  open_patient_history() {
    if (!this.active_patient) {
      frappe.msgprint("Select a patient first.");
      return;
    }
    frappe.set_route("Form", "Patient", this.active_patient);
  }

  add_note_dialog() {
    const d = new frappe.ui.Dialog({
      title: "Add Quick Note",
      fields: [{ fieldname: "note", label: "Note", fieldtype: "Small Text", reqd: 1 }],
      primary_action_label: "Add",
      primary_action: (values) => {
        frappe.show_alert({ message: "Quick note added locally", indicator: "green" });
        const notes = (this.dashboard.notes || []).slice();
        notes.push({ note: values.note });
        this.dashboard.notes = notes;
        this.render_notes(notes);
        d.hide();
      },
    });
    d.show();
  }

  search_patients(query) {
    if (!query || query.length < 2) {
      $("#nb-doc-search-results").hide().html("");
      return;
    }
    frappe.call({
      method: "nilebyte_clinic.nilebyte_clinic.page.reception_workspace.reception_workspace.search_patient",
      args: { query },
      callback: (r) => {
        const rows = r.message || [];
        if (!rows.length) {
          $("#nb-doc-search-results").html(`<div class="nb-doc-search-item nb-doc-muted">No patients found</div>`).show();
          return;
        }
        $("#nb-doc-search-results").html(rows.map(p => `
          <div class="nb-doc-search-item" data-patient="${this.esc(p.name)}">
            <b>${this.esc(p.patient_name || p.name)}</b>
            <div class="nb-doc-muted">${this.esc(p.name || "")} · ${this.esc(p.mobile || p.phone || "No phone")}</div>
          </div>
        `).join("")).show();
        $(".nb-doc-search-item[data-patient]").on("click", (e) => {
          const patient = $(e.currentTarget).data("patient");
          this.active_patient = patient;
          this.active_appointment = null;
          this.call("get_patient_summary", { patient }, (data) => this.render_patient(data));
          $("#nb-doc-search-results").hide();
        });
      },
    });
  }

  status_class(status) {
    const s = String(status || "").toLowerCase().replace(/\s+/g, "-");
    if (s === "with-doctor") return "with-doctor";
    if (s === "completed") return "completed";
    if (s === "cancelled") return "cancelled";
    if (s === "no-show") return "no-show";
    return "waiting";
  }

  time_label(value) {
    if (!value) return "--";
    const parts = String(value).split(":");
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
    return value;
  }

  go(route) {
    const parts = String(route).split("/");
    frappe.set_route(...parts);
  }

  initials(name) {
    return String(name || "P").split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();
  }

  css_escape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(String(value || ""));
    return String(value || "").replace(/"/g, "\\\"");
  }

  esc(value) {
    return frappe.utils.escape_html(String(value == null ? "" : value));
  }
}
