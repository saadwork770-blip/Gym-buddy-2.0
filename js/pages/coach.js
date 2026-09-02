/* ============================================================================
   GymBuddy 2.0 — pages/coach.js
   The coach's feed, plus the full prescription table with its reasoning.
   ============================================================================ */

UI.ready(() => {
  const profile = UI.requireProfile("root", "The coach reasons about your training history, so it needs a profile to reason about.");
  if (!profile) return;

  function renderFeed() {
    const p = Store.getActiveProfile();
    const feed = Coach.buildFeed(p);
    const host = document.getElementById("feed");

    if (!feed.length) {
      host.innerHTML = `<div class="coach-card sev-info"><h3>Nothing to flag</h3>
        <p>No stalls, no volume problems, no schedule drift. Log a few sessions and the coach will have more to say.</p></div>`;
      return;
    }

    host.innerHTML = feed.map(m => `
      <div class="coach-card sev-${m.severity}">
        <div class="ch">
          <h3>${UI.esc(m.title)}</h3>
          <span class="coach-cat">${UI.esc(m.category)}</span>
        </div>
        <p>${UI.esc(m.body)}</p>
        <div class="ca">
          ${m.cta ? `<a href="${m.cta.href}" class="btn btn-primary btn-sm">${UI.esc(m.cta.label)}</a>` : ""}
          ${m.apply ? `<button class="btn btn-primary btn-sm" data-apply="${UI.esc(m.key)}">${UI.esc(m.applyLabel || "Apply")}</button>` : ""}
          <button class="btn btn-ghost btn-sm" data-dismiss="${UI.esc(m.key)}">Dismiss</button>
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
          UI.toast("That suggestion is out of date — your plan has already moved on. Dismissing it.", "warn");
          Store.dismissInsight(p.id, msg.key);
          renderFeed(); renderTable();
          return;
        }
        Store.dismissInsight(p.id, msg.key);
        UI.toast("Applied — your plan has been rebuilt.");
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
      table.innerHTML = `<tr><td class="hint" style="padding:22px;">Pick your training days on the Program page first.</td></tr>`;
      return;
    }

    const rows = [];
    plan.sessions.forEach(s => {
      rows.push(`<tr><td colspan="5" style="background:var(--bg-alt);font-size:.74rem;text-transform:uppercase;
        letter-spacing:.06em;color:var(--text-faint);font-weight:800;">${DAY_SHORT[s.dayKey]} · ${UI.esc(s.name)}</td></tr>`);
      s.blocks.forEach(b => {
        const ex = exerciseById(b.exerciseId);
        const key = `${s.templateId}|${b.exerciseId}`;
        rows.push(`
          <tr class="rx-row" data-key="${key}">
            <td><div class="rx-name">${UI.exerciseThumb(b.exerciseId)}<span>${UI.esc(ex.name)}</span></div></td>
            <td class="tnum">${b.sets} x ${b.repLo}–${b.repHi}</td>
            <td class="rx-load">${UI.esc(UI.fmt.load(b.weight, ex))}
              ${b.evidence && b.weight !== b.evidence.weight
                ? `<span class="delta ${b.weight > b.evidence.weight ? (ex.inverseLoad ? "down" : "up") : (ex.inverseLoad ? "up" : "down")}">${UI.fmt.signed(b.weight - b.evidence.weight, " kg")}</span>` : ""}</td>
            <td>${b.manual ? `<span class="pill info">Your weight</span>` : UI.actionBadge(b.action)}</td>
            <td style="text-align:right;color:var(--text-faint);font-size:.8rem;">details ▾</td>
          </tr>
          <tr class="rx-why" data-why="${key}" hidden>
            <td colspan="5">
              ${UI.esc(b.reason)}
              ${b.evidence ? `<div class="ev">
                <span>Last <b>${UI.fmt.relDate(b.evidence.date)}</b></span>
                <span>Did <b>${b.evidence.reps.join(" / ")}</b> at <b>${b.evidence.weight} kg</b></span>
                ${b.evidence.avgRpe ? `<span>Avg RPE <b>${b.evidence.avgRpe}</b></span>` : ""}
                <span>Est. 1RM <b>${b.evidence.e1rm} kg</b></span>
                <span>Target was <b>${b.evidence.target}</b></span>
              </div>` : `<div class="ev"><span>No logged history for this movement yet.</span></div>`}
              <div class="inline-actions">
                <button class="btn btn-ghost btn-sm" data-override="${b.exerciseId}">Override the weight</button>
                <button class="btn btn-ghost btn-sm" data-swap="${b.exerciseId}" data-tpl="${s.templateId}" data-pat="${b.pattern}">Swap this exercise</button>
                <a class="btn btn-ghost btn-sm" href="exercises.html?ex=${encodeURIComponent(b.exerciseId)}">How to perform it</a>
              </div>
            </td>
          </tr>`);
      });
    });

    table.innerHTML = `<thead><tr><th>Exercise</th><th>Sets x reps</th><th>Next load</th><th>Decision</th><th></th></tr></thead>
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
      <div class="modal-head"><div><span class="pill info">Manual override</span>
        <h3 style="margin-top:10px;">${UI.esc(ex.name)}</h3>
        <div class="hint">${UI.esc(ex.loadSpec.label)} · moves in ${ex.loadSpec.increment || "—"} kg steps</div></div></div>
      <div class="modal-body">
        <p>If the coach's number feels wrong, it is wrong — you are the one under the bar. Set it here and progression
        continues from your figure, not the engine's.</p>
        ${plates ? `<div class="source-note">At ${current} kg that is a 20 kg bar plus ${plates.perSide.join(" + ") || "nothing"} per side${plates.exact ? "" : " (nearest loadable)"}.</div>` : ""}
        <div class="form-grid" style="margin-top:16px;">
          <div class="field"><label>Working weight (kg)</label>
            <input type="number" id="ovWeight" step="0.5" min="0" value="${current}"></div>
          <div class="field"><label>Sets</label>
            <input type="number" id="ovSets" min="1" max="6" value="${rx.sets || ex.defaultSets}"></div>
          <div class="field"><label>Rep range low</label>
            <input type="number" id="ovLo" min="1" max="50" value="${rx.repLo || ex.defaultRepLo}"></div>
          <div class="field"><label>Rep range high</label>
            <input type="number" id="ovHi" min="1" max="60" value="${rx.repHi || ex.defaultRepHi}"></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" id="ovSave">Save override</button>
          <button class="btn btn-ghost" id="ovReset">Hand it back to the coach</button>
        </div>
      </div>`);

    m.el.querySelector("#ovSave").addEventListener("click", () => {
      const lo = Number(m.el.querySelector("#ovLo").value);
      const hi = Number(m.el.querySelector("#ovHi").value);
      if (hi < lo) { UI.toast("The top of the rep range has to be at least the bottom.", "warn"); return; }
      Store.setPrescription(p.id, exId, {
        weight: Number(m.el.querySelector("#ovWeight").value),
        sets: Number(m.el.querySelector("#ovSets").value),
        repLo: lo, repHi: hi, action: "hold",
        reason: "You set this weight manually. The coach will progress from here as normal once you log a session on it.",
      });
      m.close(); UI.toast("Override saved."); renderTable(); renderFeed();
    });
    m.el.querySelector("#ovReset").addEventListener("click", () => {
      Store.setPrescription(p.id, exId, { manual: false, stalls: 0 });
      m.close(); UI.toast("Back under the coach's control."); renderTable();
    });
  }

  function swapDialog(exId, templateId, pattern) {
    const p = Store.getActiveProfile();
    const ex = exerciseById(exId);
    const alts = Adaptation.alternativesFor(exId, p, { limit: 6 });

    const m = UI.modal(`
      <div class="modal-head"><div><span class="pill info">Swap exercise</span>
        <h3 style="margin-top:10px;">Replace ${UI.esc(ex.name)}</h3>
        <div class="hint">In ${UI.esc((SESSION_TEMPLATES[templateId] || {}).name || "this session")}, ${UI.esc((PATTERNS[pattern] || "").toLowerCase())} slot</div></div></div>
      <div class="modal-body">
        ${alts.length ? `<p>These train the same thing. Picking one pins it to this slot until you swap it back — the
          rest of the plan is untouched.</p>
        <table class="rx-table">${alts.map(a => `
          <tr class="rx-row">
            <td><div class="rx-name">${UI.exerciseThumb(a.exercise.id)}<span>${UI.esc(a.exercise.name)}</span></div>
              <div class="hint" style="margin:6px 0 0 64px;">${UI.esc(a.why)}</div></td>
            <td style="text-align:right;vertical-align:top;">
              <button class="btn btn-primary btn-sm" data-pick="${a.exercise.id}">Use this</button></td>
          </tr>`).join("")}</table>`
        : `<p>No alternatives are available under your current equipment and pain settings. Re-enable equipment on the
             Profile page to widen the options.</p>`}
      </div>`, { wide: true });

    m.el.querySelectorAll("[data-pick]").forEach(btn => btn.addEventListener("click", () => {
      Adaptation.apply(p.id, { type: "swap_exercise", templateId, pattern, toId: btn.dataset.pick, fromId: exId });
      m.close();
      UI.toast(`${exerciseById(btn.dataset.pick).name} is now in that slot.`);
      renderTable(); renderFeed();
    }));
    UI.wireThumbHover(m.el);
  }

  renderFeed();
  renderTable();
});
