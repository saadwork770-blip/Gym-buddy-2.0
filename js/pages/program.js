/* ============================================================================
   GymBuddy 2.0 — pages/program.js
   The adaptive weekly program: pick your days, watch the split rebuild.
   ============================================================================ */

UI.ready(() => {
  const profile = UI.requireProfile("root", "The program is generated from your bodyweight, goal, experience and the days you can train.");
  if (!profile) return;

  const dayPicker = document.getElementById("dayPicker");
  const pickerSummary = document.getElementById("pickerSummary");

  /* Local, uncommitted selection so the summary can preview the consequences
     of a change before it is written to the profile. */
  let selected = new Set((profile.settings.trainingDays || []));

  function renderPhase(p, plan) {
    const phase = plan.phase || Periodization.phaseFor(p);
    document.getElementById("phaseBanner").innerHTML = `
      <div class="phase-banner ${phase.type === "deload" ? "deload" : ""}">
        <div>
          <h3>${UI.esc(phase.label)} — ${UI.esc(phase.headline)}</h3>
          <p>${UI.esc(phase.detail)}</p>
        </div>
      </div>`;
    document.getElementById("phaseStrip").innerHTML =
      Periodization.cycleOutline(p).map(w => `
        <div class="phase-week ${w.current ? "current" : ""} ${w.type === "deload" ? "deload" : ""}">
          <b>Week ${w.week}</b><span>${UI.esc(w.label)}</span>
        </div>`).join("");
  }

  function renderDayPicker() {
    dayPicker.innerHTML = DAY_KEYS.map(d => `
      <button class="day-btn ${selected.has(d) ? "on" : ""}" data-day="${d}">
        ${DAY_SHORT[d]}<small>${selected.has(d) ? "training" : "rest"}</small>
      </button>`).join("");

    dayPicker.querySelectorAll(".day-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const d = btn.dataset.day;
        if (selected.has(d)) {
          if (selected.size === 1) { UI.toast("You need at least one training day.", "warn"); return; }
          selected.delete(d);
        } else if (selected.size >= 6) {
          UI.toast("Six training days is the practical ceiling — the seventh has to be recovery.", "warn");
          return;
        } else {
          selected.add(d);
        }
        renderDayPicker();
        commit();
      });
    });
  }

  /** Show what the current selection produces, before and after committing. */
  function renderSummary(current) {
    const days = DAY_KEYS.filter(d => selected.has(d));
    const preview = Scheduler.previewForDays(Store.getActiveProfile(), days);
    if (preview.empty) { pickerSummary.innerHTML = `<span>${UI.esc(preview.warnings[0])}</span>`; return; }
    pickerSummary.innerHTML = `
      <span><b>${days.length}</b> ${days.length === 1 ? "day" : "days"} a week</span>
      <span>Split: <b>${UI.esc(preview.splitName)}</b></span>
      <span>About <b>${preview.avgMinutes} min</b> a session, door to door</span>
      <span><b>${Math.round(preview.sessions.reduce((s, x) => s + x.totalSets, 0))}</b> working sets a week</span>`;
  }

  function commit() {
    const days = DAY_KEYS.filter(d => selected.has(d));
    Store.updateSettings(profile.id, { trainingDays: days });
    render();
    UI.toast(`Program rebuilt for ${days.map(d => DAY_SHORT[d]).join(" · ")}.`);
  }

  function sessionCard(s, todayKey) {
    const isToday = s.dayKey === todayKey;
    const lines = s.blocks.map(b => {
      const ex = exerciseById(b.exerciseId);
      const delta = b.action === "increase" && b.evidence
        ? `<span class="delta up">${UI.fmt.signed(b.weight - b.evidence.weight, " kg")}</span>` : "";
      return `
        <div class="ex-line" data-hover-media data-ex="${b.exerciseId}">
          ${UI.exerciseThumb(b.exerciseId)}
          <span class="nm"><b>${UI.esc(ex.name)}</b>
            <span>${UI.esc(PATTERNS[b.pattern] || "")}${b.substitutedFrom ? " · substituted" : ""}</span></span>
          <span class="ld"><b>${UI.esc(UI.fmt.load(b.weight, ex))}${delta}</b>
            <span>${b.sets} x ${b.repLo}–${b.repHi}</span></span>
        </div>`;
    }).join("");

    return `
      <div class="session-card ${isToday ? "today" : ""}">
        <div class="sh">
          <div>
            <h3>${DAY_LABELS[s.dayKey]} — ${UI.esc(s.name)}</h3>
            <div class="sub">${UI.esc(s.emphasis)} · ${s.totalSets} sets · ~${s.estMinutes} min lifting</div>
          </div>
          ${isToday ? `<span class="pill good">Today</span>` : ""}
        </div>
        <div class="sb">${lines}
          ${s.cardio ? `<div class="ex-line">
            ${UI.exerciseThumb(s.cardio.exerciseId)}
            <span class="nm"><b>${UI.esc(s.cardio.name)}</b><span>Cardio finisher · ${UI.esc(s.cardio.intensity)}</span></span>
            <span class="ld"><b>${s.cardio.minutes} min</b><span>after lifting</span></span></div>` : ""}
        </div>
        ${s.notes && s.notes.length ? `<div class="wo-why" style="border-top:1px solid var(--border);border-bottom:none;">
            <details><summary>${s.notes.length} coaching note${s.notes.length === 1 ? "" : "s"} on this session</summary>
            <div class="body">${s.notes.map(n => `<p style="margin:0 0 8px;">${UI.esc(n)}</p>`).join("")}</div></details>
          </div>` : ""}
        <div class="sf">
          <a href="workout.html?day=${s.dayKey}" class="btn btn-primary btn-sm">Start this session</a>
          <span class="muted" style="font-size:.78rem;">~${s.totalMinutes} min with cardio</span>
        </div>
      </div>`;
  }

  function render() {
    const p = Store.getActiveProfile();
    const plan = Store.getPlan(p.id);
    const todayKey = DAY_KEYS[(new Date().getDay() + 6) % 7];

    document.getElementById("pIntro").textContent =
      `${plan.splitName} · ${plan.dayCount} training ${plan.dayCount === 1 ? "day" : "days"} a week · goal: ${p.goal} · ${p.level.toLowerCase()}`;

    renderPhase(p, plan);
    renderSummary(plan);

    document.getElementById("splitNote").innerHTML = `
      <div class="split-note">
        <b>Why ${UI.esc(plan.splitName)}?</b> ${UI.esc(plan.splitRationale)}
        ${plan.splitForced ? " (You have overridden the split manually in Settings.)" : ""}
      </div>`;

    document.getElementById("warnings").innerHTML = (plan.warnings || []).map(w =>
      `<div class="coach-card sev-info" style="margin-bottom:12px;"><p>${UI.esc(w)}</p></div>`).join("");

    const restCards = (plan.restDays || []).map(r => `
      <div class="session-card rest-card">
        <div class="sh"><div><h3>${DAY_LABELS[r.dayKey]} — Rest</h3>
          <div class="sub">Recovery day</div></div>
          ${r.dayKey === todayKey ? `<span class="pill neutral">Today</span>` : ""}</div>
        <div class="sb">${UI.esc(r.suggestion)}</div>
      </div>`).join("");

    document.getElementById("sessionGrid").innerHTML =
      plan.sessions.map(s => sessionCard(s, todayKey)).join("") + restCards;

    UI.wireThumbHover(document.getElementById("sessionGrid"));
    document.querySelectorAll("[data-ex]").forEach(el => {
      el.addEventListener("click", () => { location.href = `exercises.html?ex=${encodeURIComponent(el.dataset.ex)}`; });
      el.style.cursor = "pointer";
    });

    UI.volumeBars(document.getElementById("volumeCard"), plan.volumeReport);
    document.getElementById("volumeCard").insertAdjacentHTML("beforeend", `
      <div class="vol-legend">
        <span>Shaded band = productive range (MEV→MAV)</span>
        <span>Red line = maximum recoverable volume</span>
        <span>Counted as hard sets, with compounds credited part-sets to their secondary muscles</span>
      </div>`);

    document.getElementById("guidelines").innerHTML = PROGRAM.guidelines.map(g =>
      `<div class="guideline"><b>${UI.esc(g.title)}</b><p>${UI.esc(g.text)}</p></div>`).join("");
  }

  renderDayPicker();
  render();
});
