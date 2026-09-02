/* ============================================================================
   GymBuddy 2.0 — pages/progress.js
   Analytics over the session log: strength, volume, bodyweight, attendance.
   ============================================================================ */

UI.ready(() => {
  const profile = UI.requireProfile("root", "Progress charts are drawn from your logged sessions.");
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
      <div class="kpi"><b>${log.length}</b><span>Sessions logged</span>
        <div class="sub">${totalSets} working sets in total</div></div>
      <div class="kpi"><b>${adherence.pct}%</b><span>${adherence.weeks}-week attendance</span>
        <div class="sub">${adherence.done} of ${adherence.expected} scheduled${adherence.partial ? " so far" : ""}</div></div>
      <div class="kpi"><b>${streak}</b><span>Week streak</span>
        <div class="sub">Consecutive weeks trained</div></div>
      <div class="kpi"><b>${UI.fmt.tonnage(totalTonnage)}</b><span>Total load moved</span>
        <div class="sub">Across every logged set</div></div>
      <div class="kpi"><b>${avgTrend == null ? "—" : UI.fmt.signed(avgTrend, " kg")}</b><span>Strength trend</span>
        <div class="sub">${avgTrend == null ? "Needs 3+ sessions per lift" : "Average estimated 1RM change per week"}</div></div>
      <div class="kpi"><b>${bw.length >= 2 ? UI.fmt.signed(bwDelta, " kg") : "—"}</b><span>Weight change</span>
        <div class="sub">${bw.length >= 2 ? `Since ${UI.fmt.date(bw[0].date)}` : "Log your weight on the Profile page"}</div></div>`;
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
      document.getElementById("strengthMeta").textContent =
        "Log the same exercise across two or more sessions and its strength curve will appear here.";
      UI.lineChart(document.getElementById("strengthChart"), [], { emptyText: "No lift has two logged sessions yet." });
      return;
    }

    if (!activeLift || !lifts.some(l => l.id === activeLift)) activeLift = lifts[0].id;
    picker.innerHTML = lifts.map(l =>
      `<button class="chip ${l.id === activeLift ? "active" : ""}" data-lift="${l.id}">${UI.esc(l.ex.name)}</button>`).join("");
    picker.querySelectorAll("[data-lift]").forEach(btn =>
      btn.addEventListener("click", () => { activeLift = btn.dataset.lift; renderStrength(); }));

    const lift = lifts.find(l => l.id === activeLift);
    UI.lineChart(document.getElementById("strengthChart"),
      lift.series.map(s => ({ date: s.date, value: s.e1rm })), { trend: true });

    const trend = Progression.strengthTrend(lift.series);
    const first = lift.series[0].e1rm, last = lift.series[lift.series.length - 1].e1rm;
    const rx = (p.prescriptions || {})[lift.id];
    document.getElementById("strengthMeta").innerHTML = `
      <b style="color:var(--text)">${UI.esc(lift.ex.name)}</b> —
      estimated 1RM ${first} kg → ${last} kg over ${lift.series.length} sessions
      (${UI.fmt.signed(last - first, " kg")}${trend.slopePerWeek != null ? `, ${UI.fmt.signed(trend.slopePerWeek, " kg")}/week` : ""}).
      ${rx ? `Next prescribed load: <b style="color:var(--accent)">${UI.esc(UI.fmt.load(rx.weight, lift.ex))}</b>.` : ""}
      ${lift.ex.inverseLoad ? " Plotted as bodyweight minus assistance, so a rising line means you need less help." : ""}`;
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
      { color: "#9775fa", trend: true, emptyText: "Log your bodyweight on the Profile page to see a trend." });

    if (bw.length >= 3) {
      const days = Math.max(7, (new Date(bw[bw.length - 1].date) - new Date(bw[0].date)) / 86400000);
      const perWeek = ((bw[bw.length - 1].value - bw[0].value) / days) * 7;
      document.getElementById("bwMeta").innerHTML =
        `${UI.fmt.signed(perWeek, " kg")} per week over ${Math.round(days)} days — ${
          Math.abs(perWeek / bw[bw.length - 1].value * 100).toFixed(2)}% of bodyweight a week.`;
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
      { color: "#4dabf7", emptyText: "Log two weeks of sessions to see your volume trend." });
  }

  /* ---------------- Attendance ---------------- */

  function renderAttendance() {
    const att = Adaptation.attendanceByDay(p, 6);
    const planned = new Set((p.settings.trainingDays || []));
    const max = Math.max(1, ...Object.values(att.counts));
    document.getElementById("attendance").innerHTML = `
      <div class="vol-row" style="grid-template-columns:88px 1fr 74px;font-weight:700;font-size:.72rem;
        text-transform:uppercase;letter-spacing:.05em;color:var(--text-faint);">
        <div>Day</div><div>Sessions trained</div><div>Count</div></div>
      ${DAY_KEYS.map(d => `
        <div class="vol-row" style="grid-template-columns:88px 1fr 74px;">
          <div class="vol-label">${DAY_LABELS[d]}${planned.has(d) ? ` <span class="muted" style="font-size:.7rem;">· planned</span>` : ""}</div>
          <div class="vol-track"><i class="vol-fill ${planned.has(d) ? "status-optimal" : "status-high"}"
            style="width:${(att.counts[d] / max) * 100}%"></i></div>
          <div class="vol-val">${att.counts[d]}</div>
        </div>`).join("")}
      <p class="hint" style="margin:14px 0 0;">Last ${att.weeks} week${att.weeks === 1 ? "" : "s"}. Green bars are days
      you scheduled; purple bars are days you trained on anyway. If the purple bars are taller, the Coach tab will
      offer to move your schedule to match.</p>`;
  }

  /* ---------------- History ---------------- */

  function renderHistory() {
    const host = document.getElementById("history");
    if (!log.length) {
      host.innerHTML = `<p class="hint" style="margin:0;">No sessions logged yet. Start one from the Workout tab.</p>`;
      return;
    }
    host.innerHTML = log.slice().reverse().slice(0, 30).map(s => {
      const done = (s.sets || []).filter(x => x.done);
      return `
        <div class="log-entry" data-session="${UI.esc(s.id)}" style="cursor:pointer;">
          <div class="d">${UI.fmt.date(s.date)}<br><span class="muted">${UI.fmt.relDate(s.date)}</span></div>
          <div class="n">${UI.esc(s.name)}
            <span>${[...new Set(done.map(x => x.exerciseId))].length} exercises${s.readiness ? ` · readiness ${s.readiness.score}` : ""}${s.notes ? " · has notes" : ""}</span></div>
          <div class="s">
            <span><b>${done.length}</b>sets</span>
            <span><b>${UI.fmt.tonnage(s.tonnage || 0)}</b>volume</span>
            <span><b>${s.durationMin ? s.durationMin + "m" : "—"}</b>duration</span>
          </div>
        </div>`;
    }).join("");

    host.querySelectorAll("[data-session]").forEach(el =>
      el.addEventListener("click", () => showSession(log.find(s => s.id === el.dataset.session))));
  }

  function showSession(s) {
    if (!s) return;
    const byEx = {};
    (s.sets || []).filter(x => x.done).forEach(x => { (byEx[x.exerciseId] = byEx[x.exerciseId] || []).push(x); });
    UI.modal(`
      <div class="modal-head"><div><span class="pill neutral">${UI.esc(UI.fmt.date(s.date))}</span>
        <h3 style="margin-top:10px;">${UI.esc(s.name)}</h3>
        <div class="hint">${UI.fmt.tonnage(s.tonnage || 0)} moved${s.durationMin ? ` · ${s.durationMin} minutes` : ""}${s.readiness ? ` · readiness ${s.readiness.score}/100` : ""}</div></div></div>
      <div class="modal-body">
        <table class="rx-table"><thead><tr><th>Exercise</th><th>Sets logged</th></tr></thead><tbody>
        ${Object.entries(byEx).map(([id, sets]) => {
          const ex = exerciseById(id);
          return `<tr><td class="rx-name">${UI.esc(ex ? ex.name : id)}</td>
            <td class="tnum">${sets.map(x => `${x.weight || "BW"}${ex && ex.loadType === "timed" ? "" : " kg"} x ${x.reps}${x.rpe ? ` @${x.rpe}` : ""}`).join("  ·  ")}</td></tr>`;
        }).join("")}</tbody></table>
        ${s.cardio ? `<div class="source-note">Cardio: ${UI.esc(s.cardio.name)}, ${s.cardio.minutes} min — ${s.cardio.done ? "completed" : "not marked complete"}.</div>` : ""}
        ${s.notes ? `<h4>Your notes</h4><p>${UI.esc(s.notes)}</p>` : ""}
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
