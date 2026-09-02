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
          <div class="kicker">${editing ? "Edit profile" : "New profile"}</div>
          <h2>${editing ? "Update your details" : "Tell the coach about you"}</h2>
          <p>Bodyweight, experience and goal are what the engine uses to seed your first working weights and to choose
          your rep ranges. Nothing here leaves this browser.</p>
        </div>
        <form class="card" id="profileForm">
          <div class="form-grid">
            <div class="field"><label for="f-name">Name</label>
              <input id="f-name" required value="${p ? UI.esc(p.name) : ""}" placeholder="e.g. Alex"></div>
            <div class="field"><label for="f-email">Email (optional)</label>
              <input id="f-email" type="email" value="${p ? UI.esc(p.email) : ""}" placeholder="you@example.com"></div>
            <div class="field"><label for="f-age">Age</label>
              <input id="f-age" type="number" min="12" max="100" required value="${p ? p.age : ""}"></div>
            <div class="field"><label for="f-sex">Sex</label><select id="f-sex">
              ${SEXES.map(s => `<option ${p && p.sex === s ? "selected" : ""}>${s}</option>`).join("")}</select>
              <span class="hint">Only used to scale the first estimated weights.</span></div>
            <div class="field"><label for="f-height">Height (cm)</label>
              <input id="f-height" type="number" min="120" max="230" required value="${p ? p.heightCm : ""}"></div>
            <div class="field"><label for="f-weight">Bodyweight (kg)</label>
              <input id="f-weight" type="number" min="30" max="300" step="0.1" required value="${p ? p.weightKg : ""}"></div>
            <div class="field"><label for="f-goal">Goal</label><select id="f-goal">
              ${GOALS.map(g => `<option ${p && p.goal === g ? "selected" : ""}>${g}</option>`).join("")}</select></div>
            <div class="field"><label for="f-level">Experience</label><select id="f-level">
              ${LEVELS.map(l => `<option ${p && p.level === l ? "selected" : ""}>${l}</option>`).join("")}</select></div>
          </div>
          <div id="goalNote" class="split-note" style="margin:18px 0 0;"></div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${editing ? "Save changes" : "Create profile"}</button>
            ${editing || Store.listProfiles().length ? `<button type="button" class="btn btn-ghost" id="cancelBtn">Cancel</button>` : ""}
          </div>
        </form>
      </div>`;

    const goalSel = document.getElementById("f-goal");
    const noteGoal = () => {
      const g = GOAL_PROFILES[goalSel.value];
      document.getElementById("goalNote").innerHTML =
        `<b>${UI.esc(goalSel.value)}:</b> ${UI.esc(g.note)} Compounds run ${g.repRange.compound[0]}–${g.repRange.compound[1]} reps,
         isolation ${g.repRange.isolation[0]}–${g.repRange.isolation[1]}.`;
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
        UI.toast("Profile updated — your plan has been rebuilt.");
        UI.refreshChrome();
      } else {
        Store.createProfile(data);
        UI.toast("Profile created. Next: pick your training days on the Program page.");
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

    root.innerHTML = `
      <div class="section-head">
        <div class="kicker">Profile &amp; settings</div>
        <h2>${UI.esc(p.name)}</h2>
        <p>${UI.esc(p.goal)} · ${UI.esc(p.level.toLowerCase())} · ${UI.esc(phase.label)} ·
          ${plan.empty ? "no training days picked yet" : `${UI.esc(plan.splitName)} on ${(p.settings.trainingDays || []).map(d => DAY_SHORT[d]).join(" · ")}`}</p>
      </div>
      <div class="profile-shell">
        <div>
          <div class="card profile-card">
            <div class="avatar">${UI.esc(p.name.trim().charAt(0).toUpperCase() || "?")}</div>
            <div class="name">${UI.esc(p.name)}</div>
            <div class="meta">${UI.esc(p.goal)} · ${UI.esc(p.level)}</div>
            <button class="btn btn-ghost btn-sm" id="editBtn" style="width:100%;">Edit details</button>
            <button class="btn btn-danger btn-sm" id="deleteBtn" style="width:100%;margin-top:8px;">Delete profile</button>
            <div class="profile-switch">
              <div class="hint" style="margin-bottom:8px;">Local profiles on this device</div>
              <ul class="plist" id="profileList"></ul>
              <button class="btn btn-ghost btn-sm" id="newProfileBtn" style="width:100%;">+ New profile</button>
            </div>
          </div>
          <div class="card">
            <h4 style="font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-faint);margin:0 0 12px;">Backup</h4>
            <p class="hint" style="margin-bottom:12px;">Your log lives only in this browser. Export it before clearing
            site data or moving to another device.</p>
            <button class="btn btn-ghost btn-sm" id="exportBtn" style="width:100%;">Export as JSON</button>
            <label class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;cursor:pointer;">
              Import a backup<input type="file" id="importInput" accept="application/json" hidden></label>
          </div>
        </div>

        <div>
          <div class="stat-row">
            <div class="stat-tile"><b>${p.age}</b><span>Age</span></div>
            <div class="stat-tile"><b>${p.heightCm} cm</b><span>Height</span></div>
            <div class="stat-tile"><b>${p.weightKg} kg</b><span>Bodyweight</span></div>
            <div class="stat-tile"><b>${bmiVal}</b><span>BMI (reference only)</span></div>
          </div>

          <div class="tabs">
            <button class="tab-btn active" data-tab="settings">Training settings</button>
            <button class="tab-btn" data-tab="weight">Bodyweight log</button>
            <button class="tab-btn" data-tab="cycle">Mesocycle</button>
          </div>

          <div class="tab-panel active" id="tab-settings"><div class="card" id="settingsPanel"></div></div>

          <div class="tab-panel" id="tab-weight"><div class="card">
            <form class="weight-form" id="weightForm">
              <div class="field"><label for="w-weight">Log today's bodyweight (kg)</label>
                <input id="w-weight" type="number" min="30" max="300" step="0.1" required></div>
              <button class="btn btn-primary btn-sm" type="submit">Add entry</button>
            </form>
            <canvas class="chart" id="weightChart" data-height="190"></canvas>
            <table class="log-table"><thead><tr><th>Date</th><th>Weight (kg)</th><th>Change</th></tr></thead>
              <tbody id="weightRows"></tbody></table>
          </div></div>

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
      if (!confirm(`Delete "${p.name}" and everything logged under it? This cannot be undone.`)) return;
      Store.deleteProfile(p.id); location.reload();
    });

    document.querySelectorAll(".tab-btn").forEach(btn => btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      if (btn.dataset.tab === "weight") drawWeight(p);
    }));

    renderSettings(p, plan);
    renderCycle(p, phase);
    renderWeightLog(p);
    wireBackup(p);
  }

  /* ---------------- Settings ---------------- */

  function renderSettings(p, plan) {
    const s = p.settings;
    const eq = s.equipment || {};
    const EQ = [
      { key: "machine",    label: "Selectorised & plate machines" },
      { key: "cable",      label: "Cable stations" },
      { key: "dumbbell",   label: "Dumbbells" },
      { key: "barbell",    label: "Barbells / Smith machine" },
      { key: "bodyweight", label: "Floor & bodyweight space" },
    ];
    const TIMES = [40, 50, 60, 75, 90];
    const cardioOpts = [{ id: "rotate", name: "Rotate low-impact options" }, ...cardioExercises().map(c => ({ id: c.id, name: c.name }))];
    const splitOpts = [{ id: "", name: "Let the coach choose (recommended)" },
      ...Object.values(SPLITS).map(x => ({ id: x.id, name: `${x.name} (${x.days} ${x.days === 1 ? "day" : "days"})` }))];

    document.getElementById("settingsPanel").innerHTML = `
      <div class="settings-group">
        <h3>Training days</h3>
        <p class="hint">Currently <b>${(s.trainingDays || []).map(d => DAY_SHORT[d]).join(" · ") || "none"}</b> —
          ${UI.esc(plan.empty ? "no plan yet" : plan.splitName)}. Change them on the Program page, where you can see
          the split rebuild as you pick.</p>
        <a href="program.html" class="btn btn-ghost btn-sm">Open the day picker</a>
      </div>

      <div class="settings-group">
        <h3>Time per session</h3>
        <p class="hint">Lifting time, not counting the cardio finisher. Sessions longer than this get trimmed — the
        main compounds are kept and the finishers go first.</p>
        <div class="seg" id="timeSeg">
          ${TIMES.map(t => `<button data-min="${t}" class="${s.sessionMinutes === t ? "on" : ""}">${t} min</button>`).join("")}
        </div>
      </div>

      <div class="settings-group">
        <h3>Equipment at your gym</h3>
        <p class="hint">Turn anything off and the coach substitutes around it, telling you what it changed and why.</p>
        <div class="toggle-grid">
          ${EQ.map(e => `<label class="toggle ${eq[e.key] !== false ? "on" : ""}">
            <input type="checkbox" data-eq="${e.key}" ${eq[e.key] !== false ? "checked" : ""}> ${e.label}</label>`).join("")}
        </div>
      </div>

      <div class="settings-group">
        <h3>Cardio</h3>
        <div class="form-grid">
          <div class="field"><label>Preferred machine</label>
            <select id="cardioPref">${cardioOpts.map(c =>
              `<option value="${c.id}" ${s.cardioPreference === c.id ? "selected" : ""}>${UI.esc(c.name)}</option>`).join("")}</select></div>
          <div class="field"><label>On rest days</label>
            <select id="cardioRest">
              <option value="yes" ${s.cardioOnRestDays !== false ? "selected" : ""}>Suggest optional easy cardio</option>
              <option value="no" ${s.cardioOnRestDays === false ? "selected" : ""}>Full rest, no suggestion</option>
            </select></div>
        </div>
      </div>

      <div class="settings-group">
        <h3>Split override</h3>
        <p class="hint">The coach picks a split from your day count, experience and goal. Override it only if you have
        a reason — the automatic choice is based on how many times a week each muscle ends up being trained.</p>
        <div class="field" style="max-width:360px;"><select id="splitOverride">
          ${splitOpts.map(o => `<option value="${o.id}" ${(s.splitOverride || "") === o.id ? "selected" : ""}>${UI.esc(o.name)}</option>`).join("")}
        </select></div>
      </div>

      <div class="settings-group" style="margin-bottom:0;">
        <h3>Weight increments</h3>
        <p class="hint">The smallest jump available on each piece of equipment at your gym. Every load the coach
        prescribes is rounded to these, so getting them right matters more than it looks.</p>
        <div class="form-grid">
          ${["machine_stack", "cable_stack", "dumbbell", "barbell", "plate_loaded"].map(k => `
            <div class="field"><label>${UI.esc(LOAD_TYPES[k].label)}</label>
              <input type="number" step="0.5" min="0.5" data-inc="${k}"
                value="${(s.increments || {})[k] || LOAD_TYPES[k].increment}"></div>`).join("")}
        </div>
      </div>`;

    const panel = document.getElementById("settingsPanel");
    const save = patch => { Store.updateSettings(p.id, patch); UI.toast("Saved — plan rebuilt."); };

    panel.querySelectorAll("#timeSeg button").forEach(btn => btn.addEventListener("click", () => {
      save({ sessionMinutes: Number(btn.dataset.min) });
      render();
    }));
    panel.querySelectorAll("[data-eq]").forEach(cb => cb.addEventListener("change", () => {
      const next = {};
      panel.querySelectorAll("[data-eq]").forEach(x => { next[x.dataset.eq] = x.checked; });
      if (!Object.values(next).some(Boolean)) {
        UI.toast("You need at least one kind of equipment available.", "warn");
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
      <p>Your training runs in blocks: loading weeks that ramp volume and effort, then a planned deload that clears
      the fatigue before it turns into a stall. You are in <b style="color:var(--accent)">${UI.esc(phase.label)}</b>,
      cycle ${phase.cycle}.</p>
      <div class="phase-strip" style="margin:18px 0;">
        ${Periodization.cycleOutline(p).map(w => `
          <div class="phase-week ${w.current ? "current" : ""} ${w.type === "deload" ? "deload" : ""}">
            <b>Week ${w.week}</b><span>${UI.esc(w.label)}</span></div>`).join("")}
      </div>
      <p class="hint">${UI.esc(phase.detail)}</p>
      <div class="settings-group" style="margin:22px 0 0;">
        <h3>Block length</h3>
        <p class="hint">Including the deload. Four weeks suits most people; three is better if you recover slowly.</p>
        <div class="seg" id="mesoSeg">
          ${[3, 4, 5, 6].map(w => `<button data-weeks="${w}" class="${(p.meso.weeks || 4) === w ? "on" : ""}">${w} weeks</button>`).join("")}
        </div>
        <div class="inline-actions">
          <button class="btn btn-ghost btn-sm" id="restartCycle">Restart the block from this week</button>
        </div>
      </div>`;

    document.querySelectorAll("#mesoSeg button").forEach(btn => btn.addEventListener("click", () => {
      Store.startNewCycle(p.id, Number(btn.dataset.weeks));
      UI.toast(`New ${btn.dataset.weeks}-week block started from this week.`);
      UI.refreshChrome();
      render();
    }));
    document.getElementById("restartCycle").addEventListener("click", () => {
      Store.startNewCycle(p.id, p.meso.weeks);
      UI.toast("Block restarted — you are back in week 1.");
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
          return `<tr><td>${UI.esc(w.date)}</td><td class="tnum">${w.weightKg}</td>
            <td class="tnum" style="color:${d == null ? "var(--text-faint)" : d < 0 ? "var(--good)" : "var(--warn)"}">${
              d == null ? "—" : UI.fmt.signed(d, " kg")}</td></tr>`;
        }).join("")
      : `<tr><td colspan="3" class="hint">No entries yet.</td></tr>`;

    document.getElementById("weightForm").addEventListener("submit", e => {
      e.preventDefault();
      const val = document.getElementById("w-weight").value;
      if (!val) return;
      Store.addWeightEntry(p.id, val);
      UI.toast("Bodyweight logged.");
      render();
      document.querySelector('.tab-btn[data-tab="weight"]').click();
    });
  }

  function drawWeight(p) {
    const canvas = document.getElementById("weightChart");
    if (!canvas) return;
    UI.lineChart(canvas, (p.weightLog || []).map(w => ({ date: w.date, value: w.weightKg })),
      { color: "#9775fa", trend: true, emptyText: "Log two or more entries to see the trend." });
  }

  /* ---------------- Backup ---------------- */

  function wireBackup(p) {
    document.getElementById("exportBtn").addEventListener("click", () => {
      const blob = new Blob([Store.exportProfile(p.id)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `gymbuddy-${p.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      UI.toast("Backup downloaded.");
    });

    document.getElementById("importInput").addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Store.importProfile(reader.result);
          UI.toast("Backup imported as a new profile.");
          location.reload();
        } catch (err) {
          UI.toast(`Could not import that file: ${err.message}`, "error");
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
        <h2>Set up your profile</h2>
        <p style="max-width:48ch;margin:0 auto 22px;">The coach needs your bodyweight, goal and experience to seed your
        first working weights and pick your rep ranges. It takes twenty seconds, and everything stays in this browser.</p>
        <button class="btn btn-primary" id="startBtn">Create profile</button>
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
});
