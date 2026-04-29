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
      <div class="nb-doc-app">
        <aside class="nb-doc-sidebar">
          <div class="nb-doc-brand">
            <div class="nb-doc-logo">✦</div>
            <div class="nb-doc-brand-name">Medica Clinic</div>
          </div>
          <nav class="nb-doc-nav">
            <button class="active" data-route="doctor-workspace"><span>⌂</span> Dashboard</button>
            <button data-route="List/Patient Appointment"><span>☑</span> My Schedule</button>
            <button data-route="List/Patient"><span>●</span> Patients</button>
            <button data-action="tasks"><span>▣</span> Tasks</button>
            <button data-action="telemedicine"><span>↗</span> Telemedicine</button>
            <button data-route="query-report/Patient Visit History"><span>▥</span> Reports</button>
          </nav>
        </aside>

        <main class="nb-doc-shell">
          <header class="nb-doc-topbar">
            <div class="nb-doc-global-search">
              <span>⌕</span>
              <input id="nb-doc-search" placeholder="Search patients..." autocomplete="off" />
              <div id="nb-doc-search-results" class="nb-doc-search-results"></div>
            </div>
            <div class="nb-doc-user">
              <div class="nb-doc-bell">🔔<b>2</b></div>
              <div class="nb-doc-avatar">DR</div>
              <div>
                <strong>${this.esc(frappe.session.user_fullname || frappe.session.user || "Doctor")}</strong>
                <small>Doctor</small>
              </div>
              <span>⌄</span>
            </div>
          </header>

          <section class="nb-doc-content">
            <div id="nb-doc-stats" class="nb-doc-stats"></div>

            <div class="nb-doc-grid nb-doc-grid-top">
              <section class="nb-doc-card nb-doc-appointments-card">
                <div class="nb-doc-card-head"><h3>Today’s Appointments</h3><span>•••</span></div>
                <div id="nb-doc-queue" class="nb-doc-appointments"><div class="nb-doc-empty">Loading queue...</div></div>
              </section>

              <section class="nb-doc-card nb-doc-patient-card">
                <div class="nb-doc-card-head"><h3>Patient Overview</h3><span>•••</span></div>
                <div id="nb-doc-patient-overview"><div class="nb-doc-empty">Select a patient from today’s queue.</div></div>
              </section>
            </div>

            <div class="nb-doc-grid nb-doc-action-grid">
              <section class="nb-doc-card nb-doc-action-card">
                <div class="nb-doc-action-title"><span>🩺</span><h3>Start Consultation</h3></div>
                <button class="nb-doc-field-btn" id="nb-begin-visit">Begin Patient Visit</button>
                <button class="nb-doc-green" id="nb-start-now">Start Now</button>
              </section>

              <section class="nb-doc-card nb-doc-action-card">
                <div class="nb-doc-action-title"><span>💊</span><h3>New Prescription</h3></div>
                <button class="nb-doc-field-btn" id="nb-create-rx-link">Create Rx</button>
                <button class="nb-doc-blue" id="nb-create-rx">Create Rx</button>
              </section>

              <section class="nb-doc-card nb-doc-action-card">
                <div class="nb-doc-action-title"><span>🔬</span><h3>Order Lab Tests</h3></div>
                <button class="nb-doc-field-btn" id="nb-request-tests-link">Request Tests</button>
                <div class="nb-doc-lines"><i></i><i></i><i></i></div>
              </section>

              <section class="nb-doc-card nb-doc-tasks-card">
                <div class="nb-doc-card-head"><h3>My Tasks</h3><span>•••</span></div>
                <div id="nb-doc-tasks"></div>
              </section>
            </div>

            <div class="nb-doc-grid nb-doc-bottom-grid">
              <section class="nb-doc-card nb-doc-medical-stats">
                <div class="nb-doc-card-head"><h3>Medical Stats</h3><span>•••</span></div>
                <div id="nb-doc-medical-stats"></div>
              </section>

              <section class="nb-doc-card nb-doc-notes-card">
                <div class="nb-doc-card-head"><h3>Quick Notes</h3><span>•••</span></div>
                <div id="nb-doc-notes"></div>
              </section>
            </div>
          </section>
        </main>
      </div>
    `);

    this.add_styles();
  }

  add_styles() {
    if ($("#nb-doctor-style").length) return;
    $("head").append(`
      <style id="nb-doctor-style">
        body[data-route="doctor-workspace"] .layout-main-section-wrapper,
        body[data-route="doctor-workspace"] .layout-main-section { padding:0 !important; margin:0 !important; }
        .nb-doc-app { --blue:#075cc6; --blue2:#1d71d5; --deep:#0b2454; --muted:#667899; --line:#dbe5f2; --soft:#f4f8fd; display:flex; min-height:calc(100vh - 92px); margin:-15px -15px 0; background:#eef4fb; color:#0f2447; font-family:Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .nb-doc-sidebar { width:235px; flex:0 0 235px; background:linear-gradient(180deg,#0962c8,#074fb1); color:#fff; box-shadow:8px 0 24px rgba(8,65,140,.18); }
        .nb-doc-brand { height:86px; display:flex; align-items:center; gap:12px; padding:0 28px; border-bottom:1px solid rgba(255,255,255,.13); }
        .nb-doc-logo { width:38px; height:38px; display:grid; place-items:center; font-size:24px; font-weight:900; }
        .nb-doc-brand-name { font-size:21px; font-weight:800; white-space:nowrap; }
        .nb-doc-nav { padding:18px 14px; display:flex; flex-direction:column; gap:6px; }
        .nb-doc-nav button { border:0; background:transparent; color:#fff; text-align:left; padding:13px 16px; border-radius:8px; display:flex; gap:14px; align-items:center; font-size:15px; font-weight:700; opacity:.94; }
        .nb-doc-nav button:hover, .nb-doc-nav button.active { background:rgba(255,255,255,.14); box-shadow:inset 0 0 0 1px rgba(255,255,255,.08); }
        .nb-doc-nav span { width:24px; font-size:22px; display:inline-grid; place-items:center; }
        .nb-doc-shell { flex:1; min-width:0; }
        .nb-doc-topbar { height:86px; display:flex; align-items:center; justify-content:space-between; padding:0 34px; background:linear-gradient(90deg,#085bc4,#0756ba,#0c62c9); box-shadow:0 3px 16px rgba(20,70,130,.2); }
        .nb-doc-global-search { position:relative; width:min(620px,50vw); height:48px; background:#f9fbff; border:1px solid rgba(255,255,255,.65); border-radius:8px; display:flex; align-items:center; gap:12px; padding:0 14px; box-shadow:0 8px 20px rgba(0,0,0,.12) inset, 0 6px 18px rgba(0,0,0,.07); }
        .nb-doc-global-search span { color:#486386; font-size:28px; line-height:1; }
        .nb-doc-global-search input { border:0; outline:0; background:transparent; width:100%; font-size:15px; color:#1f365a; }
        .nb-doc-search-results { display:none; position:absolute; top:53px; left:0; right:0; background:#fff; border:1px solid var(--line); border-radius:10px; overflow:hidden; z-index:100; box-shadow:0 16px 36px rgba(20,50,90,.22); }
        .nb-doc-search-item { padding:12px 14px; border-bottom:1px solid #eef3fa; cursor:pointer; }
        .nb-doc-search-item:hover { background:#f4f8ff; }
        .nb-doc-user { display:flex; align-items:center; gap:12px; color:#fff; }
        .nb-doc-user strong { display:block; font-size:15px; line-height:1.1; }
        .nb-doc-user small { display:block; color:#dbe9ff; font-size:12px; margin-top:3px; }
        .nb-doc-avatar { width:44px; height:44px; border-radius:50%; display:grid; place-items:center; background:#fff; color:#075cc6; font-weight:900; border:3px solid rgba(255,255,255,.55); box-shadow:0 5px 15px rgba(0,0,0,.18); }
        .nb-doc-bell { position:relative; font-size:24px; }
        .nb-doc-bell b { position:absolute; right:-8px; top:-8px; background:#f04b46; color:#fff; border-radius:99px; min-width:18px; height:18px; padding:0 4px; font-size:11px; display:grid; place-items:center; }
        .nb-doc-content { padding:18px 22px 34px; }
        .nb-doc-stats { display:grid; grid-template-columns:repeat(6,minmax(120px,1fr)); gap:12px; margin-bottom:16px; }
        .nb-doc-stat { background:#fff; border:1px solid var(--line); border-radius:9px; padding:13px 14px; display:flex; align-items:center; gap:12px; min-height:88px; box-shadow:0 5px 14px rgba(25,55,100,.08); cursor:pointer; transition:.14s ease; }
        .nb-doc-stat:hover { transform:translateY(-1px); box-shadow:0 9px 22px rgba(25,55,100,.13); }
        .nb-doc-stat-icon { width:42px; height:42px; border-radius:12px; display:grid; place-items:center; color:#fff; font-size:21px; flex:0 0 42px; }
        .nb-doc-stat h4 { margin:0 0 4px; font-size:12px; font-weight:700; color:#2c3f62; }
        .nb-doc-stat b { display:block; font-size:24px; color:#0d2447; line-height:1; }
        .nb-doc-stat small { display:block; margin-top:6px; color:var(--muted); }
        .nb-doc-grid { display:grid; gap:14px; }
        .nb-doc-grid-top { grid-template-columns:1.05fr 1fr; align-items:start; }
        .nb-doc-action-grid { grid-template-columns:1fr 1fr 1fr 1.2fr; margin-top:14px; align-items:start; }
        .nb-doc-bottom-grid { grid-template-columns:1fr 1fr; margin-top:14px; align-items:start; max-width:930px; }
        .nb-doc-card { background:#fff; border:1px solid var(--line); border-radius:8px; box-shadow:0 5px 14px rgba(25,55,100,.09); overflow:hidden; }
        .nb-doc-card-head { height:56px; padding:0 22px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line); }
        .nb-doc-card-head h3 { margin:0; font-size:18px; color:#0c244b; font-weight:800; }
        .nb-doc-card-head span { color:#9aaaC2; letter-spacing:3px; font-size:20px; }
        .nb-doc-appointments { padding:10px 18px 18px; min-height:250px; }
        .nb-doc-appt-row { display:grid; grid-template-columns:86px 1fr; align-items:center; border-bottom:1px solid #e9eef6; min-height:54px; gap:14px; }
        .nb-doc-appt-time { color:#32486c; font-weight:700; display:flex; gap:6px; align-items:center; }
        .nb-doc-appt-time:before { content:"•"; color:#8495ad; font-size:18px; }
        .nb-doc-appt-body { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:11px 14px; border-radius:5px; cursor:pointer; font-weight:800; color:#0e2449; }
        .nb-doc-appt-body small { display:block; font-weight:600; color:#4f6283; margin-top:2px; }
        .nb-doc-appt-body .status { font-weight:800; }
        .nb-doc-appt-body.waiting { background:#ffeab4; border:1px solid #ffd674; }
        .nb-doc-appt-body.with-doctor { background:#d8ebff; border:1px solid #8dc0ff; }
        .nb-doc-appt-body.completed { background:#dff5e6; border:1px solid #95d8a8; }
        .nb-doc-appt-body.cancelled, .nb-doc-appt-body.no-show { background:#ffe1df; border:1px solid #ffaaa5; }
        .nb-doc-appt-body.selected { outline:3px solid rgba(7,92,198,.22); }
        .nb-doc-patient-card { min-height:326px; }
        .nb-doc-patient-box { margin:16px; border:1px solid var(--line); border-radius:8px; overflow:hidden; background:#f7faff; }
        .nb-doc-patient-main { padding:16px; display:flex; gap:15px; align-items:flex-start; background:linear-gradient(100deg,#f9fbff,#eef5ff); }
        .nb-doc-patient-photo { width:74px; height:74px; border-radius:50%; background:linear-gradient(135deg,#e5edf9,#cfdcf0); display:grid; place-items:center; color:#0a5dc8; font-weight:900; font-size:25px; border:3px solid #fff; box-shadow:0 4px 12px rgba(20,50,90,.15); }
        .nb-doc-patient-info h2 { margin:6px 0 3px; color:#0d2447; font-size:24px; }
        .nb-doc-patient-info p { margin:0 0 8px; color:#556986; }
        .nb-doc-patient-info strong { display:block; margin-top:6px; font-size:16px; }
        .nb-doc-patient-actions { display:flex; flex-wrap:wrap; gap:0; padding:12px 18px; background:#fff; border-top:1px solid var(--line); }
        .nb-doc-patient-actions button { border:0; background:#fff; color:#24558e; font-weight:800; padding:7px 10px; border-right:1px solid #dce5f2; }
        .nb-doc-patient-actions button:last-child { border-right:0; }
        .nb-doc-action-card { padding:16px; min-height:160px; }
        .nb-doc-action-title { display:flex; gap:10px; align-items:center; margin-bottom:22px; }
        .nb-doc-action-title span { color:#0b61ca; font-size:31px; }
        .nb-doc-action-title h3 { margin:0; font-size:19px; color:#0c244b; }
        .nb-doc-field-btn { width:100%; border:1px solid var(--line); background:#fff; border-radius:6px; box-shadow:0 3px 8px rgba(25,55,100,.1); height:42px; color:#174778; font-weight:800; }
        .nb-doc-green, .nb-doc-blue { margin:14px auto 0; border:0; height:36px; border-radius:5px; color:#fff; display:block; width:70%; font-weight:800; box-shadow:0 5px 12px rgba(25,55,100,.16); }
        .nb-doc-green { background:#49b16a; }
        .nb-doc-blue { background:#1266c8; }
        .nb-doc-lines { padding:14px 35px; }
        .nb-doc-lines i { display:block; height:4px; background:#e3e9f2; border-radius:99px; margin:8px 0; }
        .nb-doc-task { display:grid; grid-template-columns:28px 1fr auto; align-items:center; gap:10px; padding:14px 18px; border-bottom:1px solid #e8eef6; }
        .nb-doc-task i { color:#0b67cf; font-style:normal; font-size:18px; }
        .nb-doc-task b { font-size:14px; }
        .nb-doc-task span { color:#bf6b5e; font-size:13px; }
        .nb-doc-stat-list, .nb-doc-notes-list { margin:14px; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
        .nb-doc-stat-line, .nb-doc-note-line { display:grid; grid-template-columns:34px 1fr auto; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid #e8eef6; }
        .nb-doc-stat-line:last-child, .nb-doc-note-line:last-child { border-bottom:0; }
        .nb-doc-stat-line i, .nb-doc-note-line i { font-style:normal; width:26px; height:26px; border-radius:50%; display:grid; place-items:center; color:#fff; background:#2174d5; font-weight:800; }
        .nb-doc-stat-line b { font-size:21px; color:#0d2447; margin-right:8px; }
        .nb-doc-note-actions { text-align:right; padding:9px 14px; border-top:1px solid var(--line); }
        .nb-doc-note-actions button { border:1px solid var(--line); background:#fff; color:#1d65bd; border-radius:5px; font-weight:800; padding:6px 13px; }
        .nb-doc-empty { color:var(--muted); text-align:center; padding:30px; }
        .nb-doc-muted { color:var(--muted); }
        @media(max-width:1200px){ .nb-doc-sidebar{width:86px;flex-basis:86px}.nb-doc-brand-name,.nb-doc-nav button{font-size:0}.nb-doc-nav span{font-size:24px}.nb-doc-topbar{padding:0 18px}.nb-doc-stats{grid-template-columns:repeat(3,1fr)}.nb-doc-grid-top,.nb-doc-action-grid,.nb-doc-bottom-grid{grid-template-columns:1fr}.nb-doc-global-search{width:48vw} }
        @media(max-width:760px){ .nb-doc-app{display:block;margin:0}.nb-doc-sidebar{display:none}.nb-doc-topbar{height:auto;gap:12px;flex-direction:column;align-items:stretch;padding:12px}.nb-doc-global-search{width:100%}.nb-doc-content{padding:12px}.nb-doc-stats{grid-template-columns:1fr 1fr}.nb-doc-user{justify-content:flex-end}.nb-doc-appt-row{grid-template-columns:1fr}.nb-doc-appt-time{padding-top:10px} }
      </style>
    `);
  }

  bind_events() {
    $(document).on("click", ".nb-doc-nav button", (e) => {
      const route = $(e.currentTarget).data("route");
      const action = $(e.currentTarget).data("action");
      if (route) this.go(route);
      if (action === "tasks") frappe.set_route("List", "ToDo");
      if (action === "telemedicine") frappe.msgprint("Telemedicine shortcuts can be connected when your Telemedicine module is enabled.");
    });

    $(document).on("click", ".nb-doc-appt-body", (e) => {
      const appointment = $(e.currentTarget).data("appointment");
      const patient = $(e.currentTarget).data("patient");
      this.select_patient(appointment, patient);
    });

    $("#nb-begin-visit, #nb-start-now").on("click", () => this.start_visit());
    $("#nb-create-rx, #nb-create-rx-link").on("click", () => this.open_prescription_dialog());
    $("#nb-request-tests-link").on("click", () => this.open_lab_dialog());

    $(document).on("click", "#nb-doc-open-patient", () => {
      if (this.active_patient) frappe.set_route("Form", "Patient", this.active_patient);
    });
    $(document).on("click", "#nb-doc-clinical-notes", () => this.open_visit_dialog());
    $(document).on("click", "#nb-doc-prescribe", () => this.open_prescription_dialog());
    $(document).on("click", "#nb-doc-labs", () => this.open_lab_dialog());
    $(document).on("click", "#nb-doc-history", () => this.open_patient_history());
    $(document).on("click", "#nb-doc-add-note", () => this.add_note_dialog());

    $("#nb-doc-search").on("input", () => {
      clearTimeout(this.search_timer);
      const query = $("#nb-doc-search").val().trim();
      this.search_timer = setTimeout(() => this.search_patients(query), 250);
    });

    $(document).on("click", (e) => {
      if (!$(e.target).closest(".nb-doc-global-search").length) {
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
