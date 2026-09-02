/* ============================================================================
   GymBuddy 2.0 — pages/index.js
   The landing page adapts to whether there is a profile and a plan yet.
   ============================================================================ */

UI.ready(() => {
  const p = Store.getActiveProfile();
  const actions = document.getElementById("heroActions");
  const stats = document.getElementById("heroStats");
  const card = document.getElementById("heroCard");

  if (!p) {
    actions.innerHTML = `
      <a href="profile.html" class="btn btn-primary">${UI.t("home.setupCta")}</a>
      <a href="exercises.html" class="btn btn-ghost">${UI.t("home.browseCta")}</a>`;
    stats.innerHTML = `
      <div class="stat"><b>${I18n.num(EXERCISES.length)}</b><span>${UI.t("home.statExercises")}</span></div>
      <div class="stat"><b>1–6</b><span>${UI.t("home.statDays")}</span></div>
      <div class="stat"><b>${I18n.num(Object.keys(SPLITS).length)}</b><span>${UI.t("home.statSplits")}</span></div>`;
    const preview = [
      { day: 1, name: templateName("upper_a") }, { day: 2, name: templateName("lower_a") },
      { day: 3, name: I18n.t("program.recoveryDay") }, { day: 4, name: templateName("upper_b") },
      { day: 5, name: templateName("lower_b") },
    ];
    card.innerHTML = `
      <h2>${UI.t("home.origTitle")}</h2>
      ${preview.map(r => `<div class="day-row"><b>${UI.t("library.dayOf", { n: r.day, name: "" }).replace(" · ", "")}</b>
        <span>${UI.esc(r.name)}</span></div>`).join("")}
      <p class="hint" style="margin:14px 0 0;">${UI.t("home.origNote")}</p>`;
    renderExplain();
    return;
  }

  const plan = Store.getPlan(p.id);
  const phase = Periodization.phaseFor(p);
  const todayKey = DAY_KEYS[(new Date().getDay() + 6) % 7];
  const today = plan.empty ? null : plan.sessions.find(s => s.dayKey === todayKey);
  const adherence = Store.adherence(p, 4);

  actions.innerHTML = `
    ${today ? `<a href="workout.html?day=${todayKey}" class="btn btn-primary">${
                UI.t("home.startCta", { name: templateName(today.templateId) })}</a>`
            : `<a href="program.html" class="btn btn-primary">${UI.t("home.weekCta")}</a>`}
    <a href="coach.html" class="btn btn-ghost">${UI.t("home.coachCta")}</a>`;

  stats.innerHTML = `
    <div class="stat"><b>${I18n.num((p.sessionLog || []).length)}</b><span>${UI.t("home.statSessions")}</span></div>
    <div class="stat"><b>${plan.empty ? "—" : I18n.num(plan.dayCount)}</b><span>${UI.t("home.statDaysWeek")}</span></div>
    <div class="stat"><b>${I18n.num(adherence.pct)}%</b><span>${UI.t("home.statAttendance")}</span></div>`;

  card.innerHTML = `
    <h2>${UI.esc(phase.label)}</h2>
    ${plan.empty
      ? `<p style="margin:10px 0 0;">${UI.t("home.noDays")}</p>
         <a href="program.html" class="btn btn-primary btn-sm" style="margin-top:12px;">${UI.t("home.pickDays")}</a>`
      : plan.sessions.map(s => `
          <div class="day-row">
            <b>${UI.esc(dayShort(s.dayKey))} — ${UI.esc(templateShort(s.templateId))}</b>
            <span>${UI.t("common.setsCount", { count: s.totalSets })} · ${I18n.num(s.estMinutes)} ${UI.t("common.minutes")}</span>
          </div>`).join("") +
        `<p class="hint" style="margin:14px 0 0;">${UI.t("home.cardMeta", {
           split: splitName(plan.splitId), when: UI.fmt.relDate(plan.generatedAt) })}</p>`}`;

  renderExplain();
});

/** Three short, honest explanations of the mechanisms — no hand-waving. */
function renderExplain() {
  const host = document.getElementById("explainGrid");
  if (!host) return;
  host.innerHTML = ["e1", "e2", "e3"].map(k => `
    <div class="card"><h3 style="font-size:1.02rem;">${UI.t(`home.${k}t`)}</h3>
      <p style="font-size:.9rem;margin:0;">${UI.t(`home.${k}b`)}</p></div>`).join("");
}
