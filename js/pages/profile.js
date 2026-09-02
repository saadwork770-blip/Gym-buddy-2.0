/* ============================================================================
   GymBuddy 2.0 — pages/profile.js
   Profile create/edit/switch, training settings, bodyweight log, backup.
   ============================================================================ */

UI.ready(() => {
  const root = document.getElementById("root");
  let mode = null;   // null | "create" | "edit"

  const GOALS = Object.keys(GOAL_PROFILES);
  const LEVELS = Object.keys(LEVEL_PROFILES);
  const SEXES = ["Male", "Female", "Prefer not to say"];

  /* ---------------- Form ---------------- */

  function renderForm(editing) {
    const p = editing ? Store.getActiveProfile() : null;
    root.innerHTML = `
      <div style="max-width:660px;margin:0 auto;">
        <div class="section-head">
          <div class="kicker">${UI.t(editing ? "profile.formEditKicker" : "profile.formNewKicker")}</div>
          <h2>${UI.t(editing ? "profile.formEditTitle" : "profile.formNewTitle")}</h2>
          <p>${UI.t("profile.formIntro")}</p>
        </div>
        <form class="card" id="profileForm">
          <div class="form-grid">
            <div class="field"><label for="f-name">${UI.t("profile.fName")}</label>
              <input id="f-name" required value="${p ? UI.esc(p.name) : ""}" placeholder="${UI.t("profile.namePlaceholder")}"></div>
            <div class="field"><label for="f-email">${UI.t("profile.fEmail")}</label>
              <input id="f-email" type="email" dir="ltr" value="${p ? UI.esc(p.email) : ""}" placeholder="you@example.com"></div>
            <div class="field"><label for="f-age">${UI.t("profile.fAge")}</label>
              <input id="f-age" type="number" min="12" max="100" required dir="ltr" value="${p ? p.age : ""}"></div>
            <div class="field"><label for="f-sex">${UI.t("profile.fSex")}</label><select id="f-sex">
              ${SEXES.map(x => `<option value="${UI.esc(x)}" ${p && p.sex === x ? "selected" : ""}>${UI.esc(sexLabel(x))}</option>`).join("")}</select>
              <span class="hint">${UI.t("profile.fSexHint")}</span></div>
            <div class="field"><label for="f-height">${UI.t("profile.fHeight")}</label>
              <input id="f-height" type="number" min="120" max="230" required dir="ltr" value="${p ? p.heightCm : ""}"></div>
            <div class="field"><label for="f-weight">${UI.t("profile.fWeight")}</label>
              <input id="f-weight" type="number" min="30" max="300" step="0.1" required dir="ltr" value="${p ? p.weightKg : ""}"></div>
            <div class="field"><label for="f-goal">${UI.t("profile.fGoal")}</label><select id="f-goal">
              ${GOALS.map(g => `<option value="${UI.esc(g)}" ${p && p.goal === g ? "selected" : ""}>${UI.esc(goalLabel(g))}</option>`).join("")}</select></div>
            <div class="field"><label for="f-level">${UI.t("profile.fLevel")}</label><select id="f-level">
              ${LEVELS.map(l => `<option value="${UI.esc(l)}" ${p && p.level === l ? "selected" : ""}>${UI.esc(levelLabel(l))}</option>`).join("")}</select></div>
          </div>
          <div id="goalNote" class="split-note" style="margin:18px 0 0;"></div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${UI.t(editing ? "profile.saveChanges" : "profile.create")}</button>
            ${editing || Store.listProfiles().length ? `<button type="button" class="btn btn-ghost" id="cancelBtn">${UI.t("common.cancel")}</button>` : ""}
          </div>
        </form>
      </div>`;

    const goalSel = document.getElementById("f-goal");
    const noteGoal = () => {
      const g = GOAL_PROFILES[goalSel.value];
      document.getElementById("goalNote").textContent = I18n.t("profile.goalNote", {
        goal: goalLabel(goalSel.value), note: goalNote(goalSel.value),
        cLo: g.repRange.compound[0], cHi: g.repRange.compound[1],
        iLo: g.repRange.isolation[0], iHi: g.repRange.isolation[1],
      });
    };
    goalSel.addEventListener("change", noteGoal); noteGoal();

    const cancel = document.getElementById("cancelBtn");
    if (cancel) cancel.addEventListener("click", () => { mode = null; render(); });

    document.getElementById("profileForm").addEventListener("submit", e => {
      e.preventDefault();
      const data = {
        name: document.getElementById("f-name").value.trim(),
        email: document.getElementById("f-email").value.trim(),
        age: Number(document.getElementById("f-age").value),
        sex: document.getElementById("f-sex").value,
        heightCm: Number(document.getElementById("f-height").value),
        weightKg: Number(document.getElementById("f-weight").value),
        goal: document.getElementById("f-goal").value,
        level: document.getElementById("f-level").value,
      };
      if (editing) {
        const active = Store.getActiveProfile();
        Store.updateProfile(active.id, data);
        Store.regeneratePlan(active.id);
        UI.toast(I18n.t("profile.updated"));
        UI.refreshChrome();
      } else {
        Store.createProfile(data);
        UI.toast(I18n.t("profile.created"));
        UI.refreshChrome();
      }
      mode = null; render();
    });
  }

  /* ---------------- Dashboard ---------------- */

  function renderDashboard() {
    const p = Store.getActiveProfile();
    const plan = Store.getPlan(p.id);
    const phase = Periodization.phaseFor(p);
    const bmiVal = (p.weightKg / ((p.heightCm / 100) ** 2)).toFixed(1);
    const backup = Store.backupStatus(p);

    root.innerHTML = `
      <div class="section-head">
        <div class="kicker">${UI.t("profile.kicker")}</div>
        <h2>${UI.esc(p.name)}</h2>
        <p>${UI.t("profile.headerMeta", {
          goal: goalLabel(p.goal), level: levelLabel(p.level), phase: phase.label,
          plan: plan.empty ? I18n.t("profile.headerNoPlan")
            : I18n.t("profile.headerPlan", {
                split: splitName(plan.splitId),
                days: (p.settings.trainingDays || []).map(d => dayShort(d)).join(" · ") }),
        })}</p>
      </div>
      <div class="profile-shell">
        <div>
          <div class="card profile-card">
            <div class="avatar">${UI.esc(p.name.trim().charAt(0).toUpperCase() || "?")}</div>
            <div class="name">${UI.esc(p.name)}</div>
            <div class="meta">${UI.esc(p.goal)} · ${UI.esc(p.level)}</div>
            <button class="btn btn-ghost btn-sm" id="editBtn" style="width:100%;">${UI.t("profile.edit")}</button>
            <button class="btn btn-danger btn-sm" id="deleteBtn" style="width:100%;margin-top:8px;">${UI.t("profile.del")}</button>
            <div class="profile-switch">
              <div class="hint" style="margin-bottom:8px;">${UI.t("profile.localProfiles")}</div>
              <ul class="plist" id="profileList"></ul>
              <button class="btn btn-ghost btn-sm" id="newProfileBtn" style="width:100%;">${UI.t("profile.newProfile")}</button>
            </div>
          </div>
          <div class="card" id="backup">
            <h3 style="font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-faint);margin:0 0 12px;">${UI.t("profile.backup")}</h3>
            <p class="hint" style="margin-bottom:12px;">${UI.t("profile.backupHint")}</p>
            <p class="hint ${backup.due ? "warn-text" : ""}" style="margin-bottom:12px;">${backupLine(backup)}</p>
            <button class="btn ${backup.due ? "btn-primary" : "btn-ghost"} btn-sm" id="exportBtn" style="width:100%;">${UI.t("profile.export")}</button>
            <label class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;cursor:pointer;">
              ${UI.t("profile.import")}<input type="file" id="importInput" accept="application/json" hidden></label>
          </div>
        </div>

        <div>
          <div class="stat-row">
            <div class="stat-tile"><b>${I18n.num(p.age)}</b><span>${UI.t("profile.statAge")}</span></div>
            <div class="stat-tile"><b>${I18n.num(p.heightCm)} cm</b><span>${UI.t("profile.statHeight")}</span></div>
            <div class="stat-tile"><b>${I18n.num(p.weightKg)} ${UI.t("common.kg")}</b><span>${UI.t("profile.statWeight")}</span></div>
            <div class="stat-tile"><b>${I18n.num(bmiVal)}</b><span>${UI.t("profile.statBmi")}</span></div>
          </div>

          <div class="tabs" role="tablist">
            <button class="tab-btn active" data-tab="settings" role="tab" aria-selected="true">${UI.t("profile.tabSettings")}</button>
            <button class="tab-btn" data-tab="weight" role="tab" aria-selected="false">${UI.t("profile.tabWeight")}</button>
            <button class="tab-btn" data-tab="calibrate" role="tab" aria-selected="false">${UI.t("profile.tabCalibrate")}</button>
            <button class="tab-btn" data-tab="cycle" role="tab" aria-selected="false">${UI.t("profile.tabCycle")}</button>
          </div>

          <div class="tab-panel active" id="tab-settings"><div class="card" id="settingsPanel"></div></div>

          <div class="tab-panel" id="tab-weight">
            <div class="card">
              <form class="weight-form" id="weightForm">
                <div class="field"><label for="w-weight">${UI.t("profile.weightLog")}</label>
                  <input id="w-weight" type="number" min="30" max="300" step="0.1" required dir="ltr"></div>
                <button class="btn btn-primary btn-sm" type="submit">${UI.t("profile.addEntry")}</button>
              </form>
              <canvas class="chart" id="weightChart" data-height="190" role="img"
                      aria-label="${UI.t("progress.weightTitle")}"></canvas>
              <table class="log-table"><thead><tr><th>${UI.t("profile.colDate")}</th><th>${UI.t("profile.colWeightKg")}</th><th>${UI.t("profile.colChange")}</th></tr></thead>
                <tbody id="weightRows"></tbody></table>
            </div>

            <div class="card" style="margin-top:14px;">
              <h3 style="font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-faint);margin:0 0 10px;">${UI.t("profile.girthTitle")}</h3>
              <p class="hint" style="margin-bottom:12px;">${UI.t("profile.girthHint")}</p>
              <form class="weight-form" id="girthForm">
                <div class="field"><label for="g-waist">${UI.t("profile.girthWaist")}</label>
                  <input id="g-waist" type="number" min="40" max="200" step="0.5" dir="ltr"></div>
                <div class="field"><label for="g-hip">${UI.t("profile.girthHip")}</label>
                  <input id="g-hip" type="number" min="40" max="200" step="0.5" dir="ltr"></div>
                <button class="btn btn-primary btn-sm" type="submit">${UI.t("profile.addEntry")}</button>
              </form>
              <canvas class="chart" id="girthChart" data-height="170" role="img"
                      aria-label="${UI.t("profile.girthTitle")}"></canvas>
              <p class="hint" id="girthMeta" style="margin-top:6px;"></p>
              <table class="log-table"><thead><tr><th>${UI.t("profile.colDate")}</th><th>${UI.t("profile.girthWaist")}</th><th>${UI.t("profile.girthHip")}</th><th>${UI.t("profile.colChange")}</th></tr></thead>
                <tbody id="girthRows"></tbody></table>
            </div>
          </div>

          <div class="tab-panel" id="tab-calibrate"><div class="card" id="calibratePanel"></div></div>

          <div class="tab-panel" id="tab-cycle"><div class="card" id="cyclePanel"></div></div>
        </div>
      </div>`;

    document.getElementById("profileList").innerHTML = Store.listProfiles().map(pr =>
      `<li><button class="${pr.id === p.id ? "active" : ""}" data-id="${pr.id}">${UI.esc(pr.name)}</button></li>`).join("");
    document.querySelectorAll("#profileList button").forEach(btn =>
      btn.addEventListener("click", () => { Store.setActive(btn.dataset.id); location.reload(); }));

    document.getElementById("editBtn").addEventListener("click", () => { mode = "edit"; render(); });
    document.getElementById("newProfileBtn").addEventListener("click", () => { mode = "create"; render(); });
    document.getElementById("deleteBtn").addEventListener("click", () => {
      if (!confirm(I18n.t("profile.deleteConfirm", { name: p.name }))) return;
      Store.deleteProfile(p.id); location.reload();
    });

    document.querySelectorAll(".tab-btn").forEach(btn => btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => {
        b.classList.remove("active"); b.setAttribute("aria-selected", "false");
      });
      document.querySelectorAll(".tab-panel").forEach(x => x.classList.remove("active"));
      btn.classList.add("active"); btn.setAttribute("aria-selected", "true");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      if (btn.dataset.tab === "weight") { drawWeight(p); drawGirth(p); }
    }));

    renderSettings(p, plan);
    renderCalibration(p);
    renderCycle(p, phase);
    renderWeightLog(p);
    renderGirthLog(p);
    wireBackup(p);

    /* The coach links here with the tab it means in the fragment, so "Set
       starting loads" lands on the form rather than on the page containing
       the form. Following that link from this page is a fragment navigation
       and does not reload anything, so the hash is watched as well as read. */
    openTabFromHash();
  }

  function openTabFromHash() {
    const wanted = (location.hash || "").replace("#", "");
    const target = document.querySelector(`.tab-btn[data-tab="${wanted}"]`);
    if (target) target.click();
  }

  /* ---------------- Calibration ---------------- */

  /**
   * Ask what the lifter can already do, rather than deducing it from their
   * bodyweight and a three-way experience dropdown. One honest set per lift is
   * enough, and it is the difference between a first month spent training and
   * a first month spent watching the engine walk a bad guess into the right
   * ballpark.
   */
  function renderCalibration(p) {
    const panel = document.getElementById("calibratePanel");
    const targets = Store.calibrationTargets(p, 4);
    const saved = (p.calibration && p.calibration.entries) || [];
    const entryFor = id => saved.find(e => e.exerciseId === id) || {};
    const scale = Progression.calibrationScale(p);
    const trained = new Set();
    (p.sessionLog || []).forEach(s => (s.sets || []).forEach(x => trained.add(x.exerciseId)));

    if (!targets.length) {
      panel.innerHTML = `<p class="hint">${UI.t("profile.calNoPlan")}</p>`;
      return;
    }

    panel.innerHTML = `
      <p class="hint" style="margin-bottom:14px;">${UI.t("profile.calIntro")}</p>
      <form id="calForm">
        <table class="log-table cal-table">
          <thead><tr>
            <th>${UI.t("profile.calExercise")}</th>
            <th>${UI.t("profile.calWeight")}</th>
            <th>${UI.t("profile.calReps")}</th>
            <th>${UI.t("profile.calRpe")}</th>
          </tr></thead>
          <tbody>
            ${targets.map(ex => {
              const e = entryFor(ex.id);
              return `<tr>
                <td>
                  <span>${UI.esc(exName(ex.id))}</span>
                  ${trained.has(ex.id) ? `<span class="hint"> · ${UI.t("profile.calAlreadyTrained")}</span>` : ""}
                </td>
                <td><input type="number" dir="ltr" min="0" max="500" step="0.5" name="w-${ex.id}"
                           value="${e.weight != null ? e.weight : ""}" placeholder="${UI.t("common.kg")}"
                           aria-label="${UI.esc(UI.t("profile.calFieldLabel", { field: UI.t("profile.calWeight"), name: exName(ex.id) }))}"></td>
                <td><input type="number" dir="ltr" min="1" max="30" step="1" name="r-${ex.id}"
                           value="${e.reps != null ? e.reps : ""}" placeholder="${UI.t("common.reps")}"
                           aria-label="${UI.esc(UI.t("profile.calFieldLabel", { field: UI.t("profile.calReps"), name: exName(ex.id) }))}"></td>
                <td><input type="number" dir="ltr" min="5" max="10" step="0.5" name="e-${ex.id}"
                           value="${e.rpe != null ? e.rpe : ""}" placeholder="8"
                           aria-label="${UI.esc(UI.t("profile.calFieldLabel", { field: UI.t("profile.calRpe"), name: exName(ex.id) }))}"></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
        <p class="hint" style="margin:12px 0;">${UI.t("profile.calRpeHint")}</p>
        <div class="cal-actions">
          <button class="btn btn-primary btn-sm" type="submit">${UI.t("profile.calSave")}</button>
          ${saved.length ? `<button class="btn btn-ghost btn-sm" type="button" id="calClear">${UI.t("profile.calClear")}</button>` : ""}
        </div>
      </form>
      <p class="hint" style="margin-top:14px;">${
        saved.length
          ? UI.t("profile.calStatus", {
              count: I18n.t("common.exercisesCount", { count: saved.length }),
              pct: Math.round(Math.abs(scale - 1) * 100),
              direction: UI.t(scale >= 1 ? "profile.calAbove" : "profile.calBelow"),
            })
          : UI.t("profile.calStatusNone")}</p>`;

    panel.querySelector("#calForm").addEventListener("submit", e => {
      e.preventDefault();
      const data = new FormData(e.target);
      const entries = targets.map(ex => ({
        exerciseId: ex.id,
        weight: data.get(`w-${ex.id}`),
        reps: data.get(`r-${ex.id}`),
        rpe: data.get(`e-${ex.id}`),
      })).filter(x => Number(x.weight) > 0 && Number(x.reps) > 0);
      Store.setCalibration(p.id, entries);
      UI.toast(I18n.t(entries.length ? "profile.calSaved" : "profile.calCleared"));
      render();
    });

    const clear = panel.querySelector("#calClear");
    if (clear) clear.addEventListener("click", () => {
      Store.setCalibration(p.id, []);
      UI.toast(I18n.t("profile.calCleared"));
      render();
    });
  }

  /* ---------------- Settings ---------------- */

  function renderSettings(p, plan) {
    const s = p.settings;
    const eq = s.equipment || {};
    const EQ = [
      { key: "machine",    label: I18n.t("profile.eqMachine") },
      { key: "cable",      label: I18n.t("profile.eqCable") },
      { key: "dumbbell",   label: I18n.t("profile.eqDumbbell") },
      { key: "barbell",    label: I18n.t("profile.eqBarbell") },
      { key: "bodyweight", label: I18n.t("profile.eqBodyweight") },
    ];
    const TIMES = [40, 50, 60, 75, 90];
    const cardioOpts = [{ id: "rotate", name: I18n.t("profile.cardioRotate") },
      ...cardioExercises().map(c => ({ id: c.id, name: exName(c.id) }))];
    const splitOpts = [{ id: "", name: I18n.t("profile.splitAuto") },
      ...Object.values(SPLITS).map(x => ({
        id: x.id,
        name: I18n.t("profile.splitOption", {
          name: splitName(x.id), days: I18n.t("common.daysCount", { count: x.days }) }),
      }))];

    document.getElementById("settingsPanel").innerHTML = `
      <div class="settings-group">
        <h3>${UI.t("profile.setDays")}</h3>
        <p class="hint">${UI.t("profile.setDaysHint", {
          days: (s.trainingDays || []).map(d => dayShort(d)).join(" · ") || I18n.t("common.none"),
          split: plan.empty ? I18n.t("profile.setDaysNoPlan") : splitName(plan.splitId) })}</p>
        <a href="program.html" class="btn btn-ghost btn-sm">${UI.t("profile.openPicker")}</a>
      </div>

      <div class="settings-group">
        <h3>${UI.t("profile.setTime")}</h3>
        <p class="hint">${UI.t("profile.setTimeHint")}</p>
        <div class="seg" id="timeSeg" role="group" aria-label="${UI.t("profile.setTime")}">
          ${TIMES.map(t => `<button data-min="${t}" class="${s.sessionMinutes === t ? "on" : ""}"
            aria-pressed="${s.sessionMinutes === t}">${UI.t("profile.setTimeOption", { n: t })}</button>`).join("")}
        </div>
      </div>

      <div class="settings-group">
        <h3>${UI.t("profile.setEquipment")}</h3>
        <p class="hint">${UI.t("profile.setEquipmentHint")}</p>
        <div class="toggle-grid">
          ${EQ.map(e => `<label class="toggle ${eq[e.key] !== false ? "on" : ""}">
            <input type="checkbox" data-eq="${e.key}" ${eq[e.key] !== false ? "checked" : ""}> ${UI.esc(e.label)}</label>`).join("")}
        </div>
      </div>

      <div class="settings-group">
        <h3>${UI.t("profile.setCardio")}</h3>
        <div class="form-grid">
          <div class="field"><label for="cardioPref">${UI.t("profile.cardioPref")}</label>
            <select id="cardioPref">${cardioOpts.map(c =>
              `<option value="${c.id}" ${s.cardioPreference === c.id ? "selected" : ""}>${UI.esc(c.name)}</option>`).join("")}</select></div>
          <div class="field"><label for="cardioRest">${UI.t("profile.cardioRest")}</label>
            <select id="cardioRest">
              <option value="yes" ${s.cardioOnRestDays !== false ? "selected" : ""}>${UI.t("profile.cardioRestYes")}</option>
              <option value="no" ${s.cardioOnRestDays === false ? "selected" : ""}>${UI.t("profile.cardioRestNo")}</option>
            </select></div>
        </div>
      </div>

      <div class="settings-group">
        <h3>${UI.t("profile.setSplit")}</h3>
        <p class="hint">${UI.t("profile.setSplitHint")}</p>
        <div class="field" style="max-width:360px;">
          <label for="splitOverride" class="hint">${UI.t("profile.setSplit")}</label>
          <select id="splitOverride">
          ${splitOpts.map(o => `<option value="${o.id}" ${(s.splitOverride || "") === o.id ? "selected" : ""}>${UI.esc(o.name)}</option>`).join("")}
        </select></div>
      </div>

      <div class="settings-group" style="margin-bottom:0;">
        <h3>${UI.t("profile.setIncrements")}</h3>
        <p class="hint">${UI.t("profile.setIncrementsHint")}</p>
        <div class="form-grid">
          ${["machine_stack", "cable_stack", "dumbbell", "barbell", "plate_loaded"].map(k => `
            <div class="field"><label for="inc-${k}">${UI.esc(loadTypeLabel(k))}</label>
              <input id="inc-${k}" type="number" step="0.5" min="0.5" dir="ltr" data-inc="${k}"
                value="${(s.increments || {})[k] || LOAD_TYPES[k].increment}"></div>`).join("")}
        </div>
      </div>`;

    const panel = document.getElementById("settingsPanel");
    const save = patch => { Store.updateSettings(p.id, patch); UI.toast(I18n.t("profile.settingsSaved")); };

    panel.querySelectorAll("#timeSeg button").forEach(btn => btn.addEventListener("click", () => {
      save({ sessionMinutes: Number(btn.dataset.min) });
      render();
    }));
    panel.querySelectorAll("[data-eq]").forEach(cb => cb.addEventListener("change", () => {
      const next = {};
      panel.querySelectorAll("[data-eq]").forEach(x => { next[x.dataset.eq] = x.checked; });
      if (!Object.values(next).some(Boolean)) {
        UI.toast(I18n.t("profile.eqNeedOne"), "warn");
        cb.checked = true; return;
      }
      cb.closest(".toggle").classList.toggle("on", cb.checked);
      save({ equipment: next });
    }));
    panel.querySelector("#cardioPref").addEventListener("change", e => save({ cardioPreference: e.target.value }));
    panel.querySelector("#cardioRest").addEventListener("change", e => save({ cardioOnRestDays: e.target.value === "yes" }));
    panel.querySelector("#splitOverride").addEventListener("change", e => { save({ splitOverride: e.target.value || null }); render(); });
    panel.querySelectorAll("[data-inc]").forEach(inp => inp.addEventListener("change", () => {
      const inc = {};
      panel.querySelectorAll("[data-inc]").forEach(x => { inc[x.dataset.inc] = Number(x.value) || LOAD_TYPES[x.dataset.inc].increment; });
      save({ increments: inc });
    }));
  }

  /* ---------------- Mesocycle ---------------- */

  function renderCycle(p, phase) {
    document.getElementById("cyclePanel").innerHTML = `
      <p>${UI.t("profile.cycleIntro", { phase: phase.label, cycle: phase.cycle })}</p>
      <div class="phase-strip" style="margin:18px 0;">
        ${Periodization.cycleOutline(p).map(w => `
          <div class="phase-week ${w.current ? "current" : ""} ${w.type === "deload" ? "deload" : ""}">
            <b>${UI.t("profile.phaseWeek", { n: w.week })}</b><span>${UI.esc(w.label)}</span></div>`).join("")}
      </div>
      <p class="hint">${UI.esc(phase.detail)}</p>
      <div class="settings-group" style="margin:22px 0 0;">
        <h3>${UI.t("profile.cycleLength")}</h3>
        <p class="hint">${UI.t("profile.cycleLengthHint")}</p>
        <div class="seg" id="mesoSeg" role="group" aria-label="${UI.t("profile.cycleLength")}">
          ${[3, 4, 5, 6].map(w => `<button data-weeks="${w}" class="${(p.meso.weeks || 4) === w ? "on" : ""}"
            aria-pressed="${(p.meso.weeks || 4) === w}">${UI.t("profile.cycleWeeks", { n: w })}</button>`).join("")}
        </div>
        <div class="inline-actions">
          <button class="btn btn-ghost btn-sm" id="restartCycle">${UI.t("profile.cycleRestart")}</button>
        </div>
      </div>`;

    document.querySelectorAll("#mesoSeg button").forEach(btn => btn.addEventListener("click", () => {
      Store.startNewCycle(p.id, Number(btn.dataset.weeks));
      UI.toast(I18n.t("profile.cycleStarted", { weeks: btn.dataset.weeks }));
      UI.refreshChrome();
      render();
    }));
    document.getElementById("restartCycle").addEventListener("click", () => {
      Store.startNewCycle(p.id, p.meso.weeks);
      UI.toast(I18n.t("profile.cycleRestarted"));
      render();
    });
  }

  /* ---------------- Bodyweight ---------------- */

  function renderWeightLog(p) {
    const log = (p.weightLog || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    document.getElementById("weightRows").innerHTML = log.length
      ? log.slice().reverse().map((w, i, arr) => {
          const prev = arr[i + 1];
          const d = prev ? w.weightKg - prev.weightKg : null;
          return `<tr><td>${UI.esc(UI.fmt.date(w.date))}</td><td class="tnum">${I18n.num(w.weightKg)}</td>
            <td class="tnum" style="color:${d == null ? "var(--text-faint)" : d < 0 ? "var(--good)" : "var(--warn)"}">${
              d == null ? "—" : UI.fmt.deltaCell(d, I18n.t("common.kg"))}</td></tr>`;
        }).join("")
      : `<tr><td colspan="3" class="hint">${UI.t("profile.noEntries")}</td></tr>`;

    document.getElementById("weightForm").addEventListener("submit", e => {
      e.preventDefault();
      const val = document.getElementById("w-weight").value;
      if (!val) return;
      Store.addWeightEntry(p.id, val);
      UI.toast(I18n.t("profile.weightLogged"));
      render();
      document.querySelector('.tab-btn[data-tab="weight"]').click();
    });
  }

  function drawWeight(p) {
    const canvas = document.getElementById("weightChart");
    if (!canvas) return;
    UI.lineChart(canvas, (p.weightLog || []).map(w => ({ date: w.date, value: w.weightKg })),
      { color: "#9775fa", trend: true, emptyText: I18n.t("progress.weightEmpty") });
  }

  /* ---------------- Girth ---------------- */

  /**
   * The tape measure. It is here rather than on its own page because it only
   * means anything read against the scale directly above it: the two together
   * answer a question neither can answer alone.
   */
  function renderGirthLog(p) {
    const log = (p.girthLog || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    document.getElementById("girthRows").innerHTML = log.length
      ? log.slice().reverse().map((g, i, arr) => {
          const prev = arr[i + 1];
          const d = prev && prev.waistCm && g.waistCm ? g.waistCm - prev.waistCm : null;
          return `<tr><td>${UI.esc(UI.fmt.date(g.date))}</td>
            <td class="tnum">${g.waistCm ? I18n.num(g.waistCm) : "—"}</td>
            <td class="tnum">${g.hipCm ? I18n.num(g.hipCm) : "—"}</td>
            <td class="tnum" style="color:${d == null ? "var(--text-faint)" : d < 0 ? "var(--good)" : "var(--warn)"}">${
              d == null ? "—" : UI.fmt.deltaCell(d, I18n.t("profile.cm"))}</td></tr>`;
        }).join("")
      : `<tr><td colspan="4" class="hint">${UI.t("profile.noEntries")}</td></tr>`;

    const trend = Store.girthTrend(p);
    const meta = document.getElementById("girthMeta");
    meta.textContent = trend
      ? UI.t("profile.girthMeta", {
          delta: UI.fmt.signed(trend.waistDelta),
          days: trend.days,
          weight: trend.weightDelta == null ? UI.t("profile.girthNoWeight")
            : UI.t("profile.girthWithWeight", { delta: UI.fmt.signed(trend.weightDelta) }),
        })
      : UI.t("profile.girthNoTrend");

    document.getElementById("girthForm").addEventListener("submit", e => {
      e.preventDefault();
      const waist = document.getElementById("g-waist").value;
      const hip = document.getElementById("g-hip").value;
      if (!waist && !hip) return;
      Store.addGirthEntry(p.id, { waistCm: waist, hipCm: hip });
      UI.toast(I18n.t("profile.girthLogged"));
      render();
      document.querySelector('.tab-btn[data-tab="weight"]').click();
    });
  }

  function drawGirth(p) {
    const canvas = document.getElementById("girthChart");
    if (!canvas) return;
    UI.lineChart(canvas,
      (p.girthLog || []).filter(g => g.waistCm > 0).map(g => ({ date: g.date, value: g.waistCm })),
      { color: "#f783ac", trend: true, emptyText: I18n.t("profile.girthEmpty") });
  }

  /* ---------------- Backup ---------------- */

  /** One line saying exactly what a lost browser would cost right now. */
  function backupLine(b) {
    if (!b.sessions) return UI.t("profile.backupNothingYet");
    if (!b.last) return UI.t("profile.backupNever", {
      sessions: I18n.t("common.sessions", { count: b.sessions }) });
    if (!b.sessionsSince) return UI.t("profile.backupCurrent", { days: b.daysSince });
    return UI.t("profile.backupStale", {
      sessions: I18n.t("common.sessions", { count: b.sessionsSince }), days: b.daysSince });
  }

  function wireBackup(p) {
    document.getElementById("exportBtn").addEventListener("click", () => {
      const blob = new Blob([Store.exportProfile(p.id)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `gymbuddy-${p.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      Store.markBackedUp(p.id);
      UI.toast(I18n.t("profile.exported"));
      render();
    });

    document.getElementById("importInput").addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Store.importProfile(reader.result);
          UI.toast(I18n.t("profile.imported"));
          location.reload();
        } catch (err) {
          UI.toast(I18n.t("profile.importFailed", { error: err.message }), "error");
        }
      };
      reader.readAsText(file);
    });
  }

  /* ---------------- Empty ---------------- */

  function renderEmpty() {
    root.innerHTML = `
      <div class="profile-empty">
        <svg class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <h2>${UI.t("profile.emptyTitle")}</h2>
        <p style="max-width:48ch;margin:0 auto 22px;">${UI.t("profile.emptyBody")}</p>
        <button class="btn btn-primary" id="startBtn">${UI.t("profile.emptyCta")}</button>
      </div>`;
    document.getElementById("startBtn").addEventListener("click", () => { mode = "create"; render(); });
  }

  function render() {
    if (mode === "create") return renderForm(false);
    if (mode === "edit") return renderForm(true);
    if (!Store.getActiveProfile()) return renderEmpty();
    renderDashboard();
  }

  render();
  window.addEventListener("hashchange", openTabFromHash);
});
