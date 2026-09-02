/* ============================================================================
   GymBuddy 2.0 — pages/progress.js
   Analytics over the session log: strength, volume, bodyweight, attendance.
   ============================================================================ */

UI.ready(() => {
  const profile = UI.requireProfile("root", "progress");
  if (!profile) return;

  const p = Store.getActiveProfile();
  const log = p.sessionLog || [];

  /* ---------------- KPIs ---------------- */

  function renderKpis() {
    const adherence = Store.adherence(p, 4);
    const streak = Store.streakWeeks(p);
    const totalTonnage = log.reduce((s, x) => s + (x.tonnage || 0), 0);
    const totalSets = log.reduce((s, x) => s + (x.sets || []).filter(y => y.done).length, 0);

    // Average e1RM change per week across every lift with enough history.
    const trends = Object.keys(p.prescriptions || {})
      .map(id => Progression.strengthTrend(Progression.strengthSeries(p, id)))
      .filter(t => t.slopePerWeek != null);
    const avgTrend = trends.length ? trends.reduce((s, t) => s + t.slopePerWeek, 0) / trends.length : null;

    const bw = sortedWeightLog();
    const bwDelta = bw.length >= 2 ? bw[bw.length - 1].weightKg - bw[0].weightKg : 0;

    document.getElementById("kpis").innerHTML = `
      <div class="kpi"><b>${I18n.num(log.length)}</b><span>${UI.t("progress.kpiSessions")}</span>
        <div class="sub">${UI.t("progress.kpiSessionsSub", { count: totalSets })}</div></div>
      <div class="kpi"><b>${I18n.num(adherence.pct)}%</b><span>${UI.t("progress.kpiAttendance", { weeks: adherence.weeks })}</span>
        <div class="sub">${UI.t("progress.kpiAttendanceSub", {
          done: adherence.done, expected: adherence.expected,
          partial: adherence.partial ? I18n.t("progress.kpiPartial") : "" })}</div></div>
      <div class="kpi"><b>${I18n.num(streak)}</b><span>${UI.t("progress.kpiStreak")}</span>
        <div class="sub">${UI.t("progress.kpiStreakSub")}</div></div>
      <div class="kpi"><b>${UI.esc(UI.fmt.tonnage(totalTonnage))}</b><span>${UI.t("progress.kpiTonnage")}</span>
        <div class="sub">${UI.t("progress.kpiTonnageSub")}</div></div>
      <div class="kpi"><b>${avgTrend == null ? "—" : UI.esc(UI.fmt.signed(avgTrend, " " + I18n.t("common.kg")))}</b><span>${UI.t("progress.kpiTrend")}</span>
        <div class="sub">${UI.t(avgTrend == null ? "progress.kpiTrendNone" : "progress.kpiTrendSub")}</div></div>
      <div class="kpi"><b>${bw.length >= 2 ? UI.esc(UI.fmt.signed(bwDelta, " " + I18n.t("common.kg"))) : "—"}</b><span>${UI.t("progress.kpiWeight")}</span>
        <div class="sub">${bw.length >= 2 ? UI.t("progress.kpiWeightSub", { date: UI.fmt.date(bw[0].date) })
                                          : UI.t("progress.kpiWeightNone")}</div></div>`;
  }

  /* ---------------- Strength chart ---------------- */

  let activeLift = null;

  function liftsWithHistory() {
    const ids = [...new Set(log.flatMap(s => (s.sets || []).filter(x => x.done).map(x => x.exerciseId)))];
    return ids
      .map(id => ({ id, ex: exerciseById(id), series: Progression.strengthSeries(p, id) }))
      .filter(x => x.ex && x.series.length >= 2)
      .sort((a, b) => b.series.length - a.series.length);
  }

  function renderStrength() {
    const lifts = liftsWithHistory();
    const picker = document.getElementById("liftPicker");

    if (!lifts.length) {
      picker.innerHTML = "";
      document.getElementById("strengthMeta").textContent = I18n.t("progress.e1rmNoHistory");
      UI.lineChart(document.getElementById("strengthChart"), [], { emptyText: I18n.t("progress.e1rmEmpty") });
      return;
    }

    if (!activeLift || !lifts.some(l => l.id === activeLift)) activeLift = lifts[0].id;
    picker.innerHTML = lifts.map(l =>
      `<button class="chip ${l.id === activeLift ? "active" : ""}" data-lift="${l.id}"
          aria-pressed="${l.id === activeLift}">${UI.esc(exName(l.id))}</button>`).join("");
    picker.querySelectorAll("[data-lift]").forEach(btn =>
      btn.addEventListener("click", () => { activeLift = btn.dataset.lift; renderStrength(); }));

    const lift = lifts.find(l => l.id === activeLift);
    UI.lineChart(document.getElementById("strengthChart"),
      lift.series.map(s => ({ date: s.date, value: s.e1rm })), { trend: true });

    const trend = Progression.strengthTrend(lift.series);
    const first = lift.series[0].e1rm, last = lift.series[lift.series.length - 1].e1rm;
    const rx = (p.prescriptions || {})[lift.id];
    document.getElementById("strengthMeta").innerHTML =
      UI.t("progress.e1rmMeta", {
        name: exName(lift.id), first, last, sessions: lift.series.length,
        delta: UI.fmt.signed(last - first),
        rate: trend.slopePerWeek != null
          ? I18n.t("progress.e1rmRate", { slope: UI.fmt.signed(trend.slopePerWeek) }) : "",
      })
      + (rx ? UI.t("progress.e1rmNext", { load: UI.fmt.load(rx.weight, lift.ex) }) : "")
      + (lift.ex.inverseLoad ? UI.t("progress.e1rmAssisted") : "");
  }

  /* ---------------- Bodyweight & tonnage ---------------- */

  /** Chronological, de-duplicated bodyweight entries. */
  function sortedWeightLog() {
    const byDate = {};
    (p.weightLog || []).forEach(w => { byDate[w.date] = w; });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }

  function renderWeight() {
    const bw = sortedWeightLog().map(w => ({ date: w.date, value: w.weightKg }));
    UI.lineChart(document.getElementById("weightChart"), bw,
      { color: "#9775fa", trend: true, emptyText: I18n.t("progress.weightEmpty") });

    if (bw.length >= 3) {
      const days = Math.max(7, (new Date(bw[bw.length - 1].date) - new Date(bw[0].date)) / 86400000);
      const perWeek = ((bw[bw.length - 1].value - bw[0].value) / days) * 7;
      document.getElementById("bwMeta").textContent = I18n.t("progress.weightMeta", {
        rate: UI.fmt.signed(perWeek), days: Math.round(days),
        pct: Math.abs(perWeek / bw[bw.length - 1].value * 100).toFixed(2),
      });
    }
  }

  function renderTonnage() {
    const byWeek = {};
    log.forEach(s => {
      const d = new Date(s.date);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = d.toISOString().slice(0, 10);
      byWeek[key] = (byWeek[key] || 0) + (s.tonnage || 0);
    });
    const series = Object.entries(byWeek).sort().map(([date, value]) => ({ date, value: Math.round(value) }));
    UI.lineChart(document.getElementById("tonnageChart"), series,
      { color: "#4dabf7", emptyText: I18n.t("progress.tonnageEmpty") });
  }

  /* ---------------- Attendance ---------------- */

  function renderAttendance() {
    const att = Adaptation.attendanceByDay(p, 6);
    const planned = new Set((p.settings.trainingDays || []));
    const max = Math.max(1, ...Object.values(att.counts));
    document.getElementById("attendance").innerHTML = `
      <div class="vol-row" style="grid-template-columns:88px 1fr 74px;font-weight:700;font-size:.72rem;
        text-transform:uppercase;letter-spacing:.05em;color:var(--text-faint);">
        <div>${UI.t("progress.attendanceDay")}</div><div>${UI.t("progress.attendanceSessions")}</div><div>${UI.t("progress.attendanceCount")}</div></div>
      ${DAY_KEYS.map(d => `
        <div class="vol-row" style="grid-template-columns:88px 1fr 74px;">
          <div class="vol-label">${UI.esc(dayLabel(d))}${planned.has(d)
            ? ` <span class="muted" style="font-size:.7rem;">${UI.t("progress.attendancePlanned")}</span>` : ""}</div>
          <div class="vol-track"><i class="vol-fill ${planned.has(d) ? "status-optimal" : "status-high"}"
            style="width:${(att.counts[d] / max) * 100}%"></i></div>
          <div class="vol-val">${I18n.num(att.counts[d])}</div>
        </div>`).join("")}
      <p class="hint" style="margin:14px 0 0;">${UI.t("progress.attendanceNote", {
        weeks: I18n.t("common.weeksCount", { count: att.weeks }) })}</p>`;
  }

  /* ---------------- History ---------------- */

  function renderHistory() {
    const host = document.getElementById("history");
    if (!log.length) {
      host.innerHTML = `<p class="hint" style="margin:0;">${UI.t("progress.historyEmpty")}</p>`;
      return;
    }
    host.innerHTML = log.slice().reverse().slice(0, 30).map(s => {
      const done = (s.sets || []).filter(x => x.done);
      return `
        <div class="log-entry" data-session="${UI.esc(s.id)}" role="button" tabindex="0" style="cursor:pointer;">
          <div class="d">${UI.esc(UI.fmt.date(s.date))}<br><span class="muted">${UI.esc(UI.fmt.relDate(s.date))}</span></div>
          <div class="n">${UI.esc(templateName(s.templateId))}
            <span>${UI.t("progress.historyExercises", {
              count: [...new Set(done.map(x => x.exerciseId))].length,
              readiness: s.readiness ? I18n.t("progress.historyReadiness", { score: s.readiness.score }) : "",
              notes: s.notes ? I18n.t("progress.historyNotes") : "" })}</span></div>
          <div class="s">
            <span><b>${I18n.num(done.length)}</b>${UI.t("progress.historySets")}</span>
            <span><b>${UI.esc(UI.fmt.tonnage(s.tonnage || 0))}</b>${UI.t("progress.historyVolume")}</span>
            <span><b>${s.durationMin ? I18n.num(s.durationMin) + " " + I18n.t("common.minutes") : "—"}</b>${UI.t("progress.historyDuration")}</span>
          </div>
        </div>`;
    }).join("");

    host.querySelectorAll("[data-session]").forEach(el => {
      const open = () => showSession(log.find(s => s.id === el.dataset.session));
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });
  }

  function showSession(s) {
    if (!s) return;
    const byEx = {};
    (s.sets || []).filter(x => x.done).forEach(x => { (byEx[x.exerciseId] = byEx[x.exerciseId] || []).push(x); });
    UI.modal(`
      <div class="modal-head"><div><span class="pill neutral">${UI.esc(UI.fmt.date(s.date))}</span>
        <h3 style="margin-top:10px;">${UI.esc(templateName(s.templateId))}</h3>
        <div class="hint">${UI.t("workout.debriefStats", {
          sets: (s.sets || []).filter(x => x.done).length,
          tonnage: UI.fmt.tonnage(s.tonnage || 0),
          duration: s.durationMin ? I18n.t("workout.debriefDuration", { minutes: s.durationMin }) : "",
        })}</div></div></div>
      <div class="modal-body">
        <table class="rx-table"><thead><tr><th>${UI.t("coachPage.colExercise")}</th><th>${UI.t("progress.sessionSetsLogged")}</th></tr></thead><tbody>
        ${Object.entries(byEx).map(([id, sets]) => {
          const ex = exerciseById(id);
          return `<tr><td class="rx-name">${UI.esc(ex ? exName(id) : id)}</td>
            <td class="tnum" dir="ltr">${UI.esc(sets.map(x =>
              `${x.weight || "BW"}${ex && ex.loadType === "timed" ? "" : " kg"} × ${x.reps}${x.rpe ? ` @${x.rpe}` : ""}`
            ).join("  ·  "))}</td></tr>`;
        }).join("")}</tbody></table>
        ${s.cardio ? `<div class="source-note">${UI.t("progress.sessionCardio", {
            name: exName(s.cardio.exerciseId), minutes: s.cardio.minutes,
            status: I18n.t(s.cardio.done ? "progress.sessionCardioDone" : "progress.sessionCardioNot") })}</div>` : ""}
        ${s.notes ? `<h4>${UI.t("progress.sessionNotes")}</h4><p>${UI.esc(s.notes)}</p>` : ""}
      </div>`, { wide: true });
  }

  renderKpis();
  renderStrength();
  renderWeight();
  renderTonnage();
  renderAttendance();
  renderHistory();

  // Canvas sizing is measured from layout, so redraw when the layout changes.
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { renderStrength(); renderWeight(); renderTonnage(); }, 180);
  });
});
