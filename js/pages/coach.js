/* ============================================================================
   GymBuddy 2.0 — pages/coach.js
   The coach's feed, plus the full prescription table with its reasoning.
   ============================================================================ */

UI.ready(() => {
  const profile = UI.requireProfile("root", "coach");
  if (!profile) return;

  function renderFeed() {
    const p = Store.getActiveProfile();
    const feed = Coach.buildFeed(p);
    const host = document.getElementById("feed");

    if (!feed.length) {
      host.innerHTML = `<div class="coach-card sev-info"><h3>${UI.t("engine.coach.emptyTitle")}</h3>
        <p>${UI.t("engine.coach.emptyBody")}</p></div>`;
      return;
    }

    host.innerHTML = feed.map(m => `
      <div class="coach-card sev-${m.severity}">
        <div class="ch">
          <h3>${UI.tx(m.title)}</h3>
          <span class="coach-cat">${UI.t(`engine.coach.category.${m.category}`)}</span>
        </div>
        <p>${UI.tx(m.body)}</p>
        <div class="ca">
          ${m.cta ? `<a href="${m.cta.href}" class="btn btn-primary btn-sm">${UI.t(m.cta.labelKey)}</a>` : ""}
          ${m.apply ? `<button class="btn btn-primary btn-sm" data-apply="${UI.esc(m.key)}">${
              m.applyLabel ? UI.tx(m.applyLabel) : UI.t("common.apply")}</button>` : ""}
          <button class="btn btn-ghost btn-sm" data-dismiss="${UI.esc(m.key)}">${UI.t("common.dismiss")}</button>
        </div>
      </div>`).join("");

    host.querySelectorAll("[data-apply]").forEach(btn => {
      btn.addEventListener("click", () => {
        const msg = feed.find(m => m.key === btn.dataset.apply);
        if (!msg || !msg.apply) return;
        const result = Adaptation.apply(p.id, msg.apply);
        if (!result) {
          // The suggestion referred to something no longer in the plan — say so
          // rather than claiming a change that did not happen.
          UI.toast(I18n.t("coachPage.outOfDate"), "warn");
          Store.dismissInsight(p.id, msg.key);
          renderFeed(); renderTable();
          return;
        }
        Store.dismissInsight(p.id, msg.key);
        UI.toast(I18n.t("coachPage.applied"));
        renderFeed(); renderTable();
      });
    });
    host.querySelectorAll("[data-dismiss]").forEach(btn => {
      btn.addEventListener("click", () => {
        Store.dismissInsight(p.id, btn.dataset.dismiss);
        renderFeed();
      });
    });
  }

  /* ---------------- Prescription table ---------------- */

  function renderTable() {
    const p = Store.getActiveProfile();
    const plan = Store.getPlan(p.id);
    const table = document.getElementById("rxTable");

    if (plan.empty) {
      table.innerHTML = `<tr><td class="hint" style="padding:22px;">${UI.t("coachPage.noPlan")}</td></tr>`;
      return;
    }

    const rows = [];
    plan.sessions.forEach(s => {
      rows.push(`<tr><td colspan="5" style="background:var(--bg-alt);font-size:.74rem;text-transform:uppercase;
        letter-spacing:.06em;color:var(--text-faint);font-weight:800;">${UI.esc(dayShort(s.dayKey))} · ${UI.esc(templateName(s.templateId))}</td></tr>`);
      s.blocks.forEach(b => {
        const ex = exerciseById(b.exerciseId);
        const key = `${s.templateId}|${b.exerciseId}`;
        rows.push(`
          <tr class="rx-row" data-key="${key}">
            <td><div class="rx-name">${UI.exerciseThumb(b.exerciseId)}<span>${UI.esc(exName(b.exerciseId))}</span></div></td>
            <td class="tnum">${I18n.num(b.sets)} × ${I18n.num(b.repLo)}–${I18n.num(b.repHi)}</td>
            <td class="rx-load">${UI.esc(UI.fmt.load(b.weight, ex))}
              ${b.evidence && b.weight !== b.evidence.weight
                ? `<span class="delta ${b.weight > b.evidence.weight ? (ex.inverseLoad ? "down" : "up") : (ex.inverseLoad ? "up" : "down")}">${UI.esc(UI.fmt.signed(b.weight - b.evidence.weight, " " + I18n.t("common.kg")))}</span>` : ""}</td>
            <td>${b.manual ? `<span class="pill info">Your weight</span>` : UI.actionBadge(b.action)}</td>
            <td style="text-align:${I18n.isRTL() ? "left" : "right"};color:var(--text-faint);font-size:.8rem;">${UI.t("common.details")} ▾</td>
          </tr>
          <tr class="rx-why" data-why="${key}" hidden>
            <td colspan="5">
              ${UI.tx(b.reason)}
              ${b.evidence ? `<div class="ev">
                <span>${UI.t("coachPage.evLast", { when: UI.fmt.relDate(b.evidence.date) })}</span>
                <span>${UI.t("coachPage.evDid", { reps: b.evidence.reps.join(" / "), weight: I18n.num(b.evidence.weight) })}</span>
                ${b.evidence.avgRpe ? `<span>${UI.t("coachPage.evRpe", { rpe: b.evidence.avgRpe })}</span>` : ""}
                <span>${UI.t("coachPage.evE1rm", { value: b.evidence.e1rm })}</span>
                <span>${UI.t("coachPage.evTarget", { range: b.evidence.target })}</span>
              </div>` : `<div class="ev"><span>${UI.t("coachPage.evNone")}</span></div>`}
              <div class="inline-actions">
                <button class="btn btn-ghost btn-sm" data-override="${b.exerciseId}">${UI.t("coachPage.overrideBtn")}</button>
                <button class="btn btn-ghost btn-sm" data-swap="${b.exerciseId}" data-tpl="${s.templateId}" data-pat="${b.pattern}">${UI.t("coachPage.swapBtn")}</button>
                <a class="btn btn-ghost btn-sm" href="exercises.html?ex=${encodeURIComponent(b.exerciseId)}">${UI.t("coachPage.howToBtn")}</a>
              </div>
            </td>
          </tr>`);
      });
    });

    table.innerHTML = `<thead><tr><th>${UI.t("coachPage.colExercise")}</th><th>${UI.t("coachPage.colSetsReps")}</th><th>${UI.t("coachPage.colNextLoad")}</th><th>${UI.t("coachPage.colDecision")}</th><th></th></tr></thead>
      <tbody>${rows.join("")}</tbody>`;

    table.querySelectorAll(".rx-row").forEach(row => {
      row.addEventListener("click", e => {
        if (e.target.closest("a,button")) return;
        const why = table.querySelector(`[data-why="${CSS.escape(row.dataset.key)}"]`);
        if (why) why.hidden = !why.hidden;
      });
    });
    table.querySelectorAll("[data-override]").forEach(btn =>
      btn.addEventListener("click", () => overrideDialog(btn.dataset.override)));
    table.querySelectorAll("[data-swap]").forEach(btn =>
      btn.addEventListener("click", () => swapDialog(btn.dataset.swap, btn.dataset.tpl, btn.dataset.pat)));
    UI.wireThumbHover(table);
  }

  /* ---------------- Dialogs ---------------- */

  function overrideDialog(exId) {
    const p = Store.getActiveProfile();
    const ex = exerciseById(exId);
    const rx = (p.prescriptions || {})[exId] || {};
    const current = rx.weight != null ? rx.weight : 0;
    const plates = ex.loadType === "barbell" ? Progression.plateBreakdown(current, 20) : null;

    const m = UI.modal(`
      <div class="modal-head"><div><span class="pill info">${UI.t("coachPage.overrideTitle")}</span>
        <h3 style="margin-top:10px;">${UI.esc(exName(exId))}</h3>
        <div class="hint">${UI.t("coachPage.overrideSub", {
          loadType: loadTypeLabel(ex.loadType), increment: ex.loadSpec.increment || "—" })}</div></div></div>
      <div class="modal-body">
        <p>${UI.t("coachPage.overrideBody")}</p>
        ${plates ? `<div class="source-note">${UI.t("coachPage.overridePlates", {
            weight: I18n.num(current),
            plates: plates.perSide.length ? plates.perSide.join(" + ") : I18n.t("coachPage.overridePlatesNone"),
            approx: plates.exact ? "" : I18n.t("coachPage.overrideApprox") })}</div>` : ""}
        <div class="form-grid" style="margin-top:16px;">
          <div class="field"><label for="ovWeight">${UI.t("coachPage.overrideWeight")}</label>
            <input type="number" id="ovWeight" step="0.5" min="0" inputmode="decimal" dir="ltr" value="${current}"></div>
          <div class="field"><label for="ovSets">${UI.t("coachPage.overrideSets")}</label>
            <input type="number" id="ovSets" min="1" max="6" inputmode="numeric" dir="ltr" value="${rx.sets || ex.defaultSets}"></div>
          <div class="field"><label for="ovLo">${UI.t("coachPage.overrideLo")}</label>
            <input type="number" id="ovLo" min="1" max="50" inputmode="numeric" dir="ltr" value="${rx.repLo || ex.defaultRepLo}"></div>
          <div class="field"><label for="ovHi">${UI.t("coachPage.overrideHi")}</label>
            <input type="number" id="ovHi" min="1" max="60" inputmode="numeric" dir="ltr" value="${rx.repHi || ex.defaultRepHi}"></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" id="ovSave">${UI.t("coachPage.overrideSave")}</button>
          <button class="btn btn-ghost" id="ovReset">${UI.t("coachPage.overrideReset")}</button>
        </div>
      </div>`);

    m.el.querySelector("#ovSave").addEventListener("click", () => {
      const lo = Number(m.el.querySelector("#ovLo").value);
      const hi = Number(m.el.querySelector("#ovHi").value);
      if (hi < lo) { UI.toast(I18n.t("coachPage.overrideBadRange"), "warn"); return; }
      Store.setPrescription(p.id, exId, {
        weight: Number(m.el.querySelector("#ovWeight").value),
        sets: Number(m.el.querySelector("#ovSets").value),
        repLo: lo, repHi: hi, action: "hold",
        reason: I18n.m("coachPage.overrideReason"),
      });
      m.close(); UI.toast(I18n.t("coachPage.overrideSaved")); renderTable(); renderFeed();
    });
    m.el.querySelector("#ovReset").addEventListener("click", () => {
      Store.setPrescription(p.id, exId, { manual: false, stalls: 0 });
      m.close(); UI.toast(I18n.t("coachPage.overrideReturned")); renderTable();
    });
  }

  function swapDialog(exId, templateId, pattern) {
    const p = Store.getActiveProfile();
    const ex = exerciseById(exId);
    const alts = Adaptation.alternativesFor(exId, p, { limit: 6 });

    const m = UI.modal(`
      <div class="modal-head"><div><span class="pill info">${UI.t("coachPage.swapTitle")}</span>
        <h3 style="margin-top:10px;">${UI.t("coachPage.swapHeading", { name: exName(exId) })}</h3>
        <div class="hint">${UI.t("coachPage.swapSub", {
          session: templateName(templateId), pattern: patternLabel(pattern) })}</div></div></div>
      <div class="modal-body">
        ${alts.length ? `<p>${UI.t("coachPage.swapBody")}</p>
        <table class="rx-table">${alts.map(a => `
          <tr class="rx-row">
            <td><div class="rx-name">${UI.exerciseThumb(a.exercise.id)}<span>${UI.esc(exName(a.exercise.id))}</span></div>
              <div class="hint" style="margin-top:6px;">${UI.tx(a.why)}</div></td>
            <td style="text-align:${I18n.isRTL() ? "left" : "right"};vertical-align:top;">
              <button class="btn btn-primary btn-sm" data-pick="${a.exercise.id}">${UI.t("coachPage.swapUse")}</button></td>
          </tr>`).join("")}</table>`
        : `<p>${UI.t("coachPage.swapNone")}</p>`}
      </div>`, { wide: true });

    m.el.querySelectorAll("[data-pick]").forEach(btn => btn.addEventListener("click", () => {
      Adaptation.apply(p.id, { type: "swap_exercise", templateId, pattern, toId: btn.dataset.pick, fromId: exId });
      m.close();
      UI.toast(I18n.t("coachPage.swapDone", { name: exName(btn.dataset.pick) }));
      renderTable(); renderFeed();
    }));
    UI.wireThumbHover(m.el);
  }

  renderFeed();
  renderTable();
});
