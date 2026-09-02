/* ============================================================================
   GymBuddy 2.0 — pages/program.js
   The adaptive weekly program: pick your days, watch the split rebuild.
   ============================================================================ */

UI.ready(() => {
  const profile = UI.requireProfile("root", "program");
  if (!profile) return;

  const dayPicker = document.getElementById("dayPicker");
  const pickerSummary = document.getElementById("pickerSummary");

  /* Local, uncommitted selection so the summary can preview the consequences
     of a change before it is written to the profile. */
  let selected = new Set((profile.settings.trainingDays || []));

  function renderPhase(p) {
    // Derived fresh every render: the stored plan keeps only the week number,
    // so the label and copy follow whichever language is in force now.
    const phase = Periodization.phaseFor(p);
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
          <b>${UI.t("profile.phaseWeek", { n: w.week })}</b><span>${UI.esc(w.label)}</span>
        </div>`).join("");
  }

  function renderDayPicker() {
    dayPicker.innerHTML = DAY_KEYS.map(d => `
      <button class="day-btn ${selected.has(d) ? "on" : ""}" data-day="${d}"
              aria-pressed="${selected.has(d)}">
        ${UI.esc(dayShort(d))}<small>${UI.t(selected.has(d) ? "program.dayTraining" : "program.dayRest")}</small>
      </button>`).join("");

    dayPicker.querySelectorAll(".day-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const d = btn.dataset.day;
        if (selected.has(d)) {
          if (selected.size === 1) { UI.toast(I18n.t("program.minOneDay"), "warn"); return; }
          selected.delete(d);
        } else if (selected.size >= 6) {
          UI.toast(I18n.t("program.maxDays"), "warn");
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
    if (preview.empty) { pickerSummary.innerHTML = `<span>${UI.tx(preview.warnings[0])}</span>`; return; }
    pickerSummary.innerHTML = `
      <span>${UI.t("program.summaryDays", { count: days.length })}</span>
      <span>${UI.t("program.summarySplit", { name: splitName(preview.splitId) })}</span>
      <span>${UI.t("program.summaryTime", { minutes: preview.avgMinutes })}</span>
      <span>${UI.t("program.summarySets", { count: Math.round(preview.sessions.reduce((s, x) => s + x.totalSets, 0)) })}</span>`;
  }

  function commit() {
    const days = DAY_KEYS.filter(d => selected.has(d));
    Store.updateSettings(profile.id, { trainingDays: days });
    render();
    UI.toast(I18n.t("program.rebuilt", { days: days.map(d => dayShort(d)).join(" · ") }));
  }

  function sessionCard(s, todayKey, profileData) {
    const isToday = s.dayKey === todayKey;
    const lines = s.blocks.map(b => {
      const ex = exerciseById(b.exerciseId);
      const delta = b.action === "increase" && b.evidence
        ? `<span class="delta up">${UI.fmt.signed(b.weight - b.evidence.weight, " kg")}</span>` : "";
      return `
        <div class="ex-line" data-hover-media data-ex="${b.exerciseId}" role="button" tabindex="0">
          ${UI.exerciseThumb(b.exerciseId)}
          <span class="nm"><b>${UI.esc(exName(b.exerciseId))}</b>
            <span>${UI.esc(patternLabel(b.pattern))}${b.substitutedFrom ? ` · ${UI.t("program.substituted")}` : ""}</span></span>
          <span class="ld"><b>${UI.esc(UI.fmt.load(b.weight, ex))}${delta}</b>
            <span>${I18n.num(b.sets)} × ${I18n.num(b.repLo)}–${I18n.num(b.repHi)}</span></span>
        </div>`;
    }).join("");

    return `
      <div class="session-card ${isToday ? "today" : ""}">
        <div class="sh">
          <div>
            <h3>${UI.esc(dayLabel(s.dayKey))} — ${UI.esc(templateName(s.templateId))}</h3>
            <div class="sub">${UI.t("program.cardSub", {
              emphasis: templateEmphasis(s.templateId), sets: s.totalSets, minutes: s.estMinutes })}</div>
          </div>
          ${isToday ? `<span class="pill good">${UI.t("common.today")}</span>` : ""}
        </div>
        <div class="sb">${lines}
          ${s.cardio ? `<div class="ex-line">
            ${UI.exerciseThumb(s.cardio.exerciseId)}
            <span class="nm"><b>${UI.esc(exName(s.cardio.exerciseId))}</b>
              <span>${UI.t("program.cardioFinisher", { intensity: cardioIntensity(profileData.goal) })}</span></span>
            <span class="ld"><b>${I18n.num(s.cardio.minutes)} ${UI.t("common.minutes")}</b>
              <span>${UI.t("program.afterLifting")}</span></span></div>` : ""}
        </div>
        ${s.notes && s.notes.length ? `<div class="wo-why" style="border-top:1px solid var(--border);border-bottom:none;">
            <details><summary>${UI.t("program.notes", { count: s.notes.length })}</summary>
            <div class="body">${s.notes.map(n => `<p style="margin:0 0 8px;">${UI.tx(n)}</p>`).join("")}</div></details>
          </div>` : ""}
        <div class="sf">
          <a href="workout.html?day=${s.dayKey}" class="btn btn-primary btn-sm">${UI.t("program.startSession")}</a>
          <span class="muted" style="font-size:.78rem;">${UI.t("program.withCardio", { minutes: s.totalMinutes })}</span>
        </div>
      </div>`;
  }

  function render() {
    const p = Store.getActiveProfile();
    const plan = Store.getPlan(p.id);
    const todayKey = DAY_KEYS[(new Date().getDay() + 6) % 7];

    document.getElementById("pIntro").textContent = I18n.t("program.intro", {
      split: splitName(plan.splitId),
      days: I18n.t("common.daysCount", { count: plan.dayCount }),
      goal: goalLabel(p.goal), level: levelLabel(p.level),
    });

    renderPhase(p);
    renderSummary(plan);

    document.getElementById("splitNote").innerHTML = `
      <div class="split-note">
        <b>${UI.t("program.whySplit", { name: splitName(plan.splitId) })}</b>
        ${UI.esc(splitRationale(plan.splitId))}${plan.splitForced ? UI.t("program.splitForced") : ""}
      </div>`;

    document.getElementById("warnings").innerHTML = (plan.warnings || []).map(w =>
      `<div class="coach-card sev-info" style="margin-bottom:12px;"><p>${UI.tx(w)}</p></div>`).join("");

    const restCards = (plan.restDays || []).map(r => `
      <div class="session-card rest-card">
        <div class="sh"><div><h3>${UI.t("program.restDay", { day: dayLabel(r.dayKey) })}</h3>
          <div class="sub">${UI.t("program.recoveryDay")}</div></div>
          ${r.dayKey === todayKey ? `<span class="pill neutral">${UI.t("common.today")}</span>` : ""}</div>
        <div class="sb">${UI.tx(r.suggestion)}</div>
      </div>`).join("");

    document.getElementById("sessionGrid").innerHTML =
      plan.sessions.map(s => sessionCard(s, todayKey, p)).join("") + restCards;

    UI.wireThumbHover(document.getElementById("sessionGrid"));
    document.querySelectorAll("[data-ex]").forEach(el => {
      const open = () => { location.href = `exercises.html?ex=${encodeURIComponent(el.dataset.ex)}`; };
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
      el.style.cursor = "pointer";
    });

    UI.volumeBars(document.getElementById("volumeCard"), plan.volumeReport);
    document.getElementById("volumeCard").insertAdjacentHTML("beforeend", `
      <div class="vol-legend">
        <span>${UI.t("program.volumeLegendBand")}</span>
        <span>${UI.t("program.volumeLegendLine")}</span>
        <span>${UI.t("program.volumeLegendCount")}</span>
      </div>`);

    document.getElementById("guidelines").innerHTML = planGuidelines().map(g =>
      `<div class="guideline"><b>${UI.esc(g.title)}</b><p>${UI.esc(g.text)}</p></div>`).join("");
  }

  renderDayPicker();
  render();
});
