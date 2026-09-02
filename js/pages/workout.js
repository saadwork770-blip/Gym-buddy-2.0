/* ============================================================================
   GymBuddy 2.0 — pages/workout.js
   ----------------------------------------------------------------------------
   The live session. Three states:
     1. Picker    — no session running, choose which day to train
     2. Readiness — a four-question check-in that modulates the whole session
     3. Player    — set-by-set logging, rest timer, live coaching cues

   Everything is written to the active session on every interaction, so
   closing the tab mid-workout loses nothing.
   ============================================================================ */

UI.ready(() => {
  const profile = UI.requireProfile("root", "workout");
  if (!profile) return;

  const root = document.getElementById("root");
  const params = new URLSearchParams(location.search);

  let restTimer = null;
  let restEnds = 0;
  let restTotal = 0;

  /* =====================================================================
     State 1 — pick a session
     ===================================================================== */

  function renderPicker() {
    const p = Store.getActiveProfile();
    const plan = Store.getPlan(p.id);
    const todayKey = DAY_KEYS[(new Date().getDay() + 6) % 7];

    if (plan.empty) {
      root.innerHTML = `<div class="gate"><h2>${UI.t("workout.noDaysTitle")}</h2>
        <p>${UI.t("workout.noDaysBody")}</p>
        <a href="program.html" class="btn btn-primary">${UI.t("workout.noDaysCta")}</a></div>`;
      return;
    }

    const today = plan.sessions.find(s => s.dayKey === todayKey);
    root.innerHTML = `
      <div class="section-head">
        <div class="kicker">${UI.t("workout.kicker")}</div>
        <h2>${today ? UI.t("workout.todayTitle", { name: templateName(today.templateId) })
                    : UI.t("workout.noSessionTitle")}</h2>
        <p>${today ? UI.t("workout.todayBody", { sets: today.totalSets, minutes: today.estMinutes })
                   : UI.t("workout.noSessionBody")}</p>
      </div>
      <div class="session-grid">
        ${plan.sessions.map(s => `
          <div class="session-card ${s.dayKey === todayKey ? "today" : ""}">
            <div class="sh"><div><h3>${UI.esc(templateName(s.templateId))}</h3>
              <div class="sub">${UI.t("workout.cardSub", {
                day: dayLabel(s.dayKey), sets: s.totalSets, minutes: s.estMinutes })}</div></div>
              ${s.dayKey === todayKey ? `<span class="pill good">${UI.t("common.today")}</span>` : ""}</div>
            <div class="sb">${s.blocks.map(b => `
              <div class="ex-line"><span class="nm"><b>${UI.esc(exName(b.exerciseId))}</b></span>
              <span class="ld"><b>${UI.esc(UI.fmt.load(b.weight, exerciseById(b.exerciseId)))}</b>
              <span>${I18n.num(b.sets)} × ${I18n.num(b.repLo)}–${I18n.num(b.repHi)}</span></span></div>`).join("")}</div>
            <div class="sf"><button class="btn ${s.dayKey === todayKey ? "btn-primary" : "btn-ghost"} btn-sm"
              data-start="${s.dayKey}">${UI.t("workout.start", { name: templateShort(s.templateId) })}</button></div>
          </div>`).join("")}
      </div>`;

    root.querySelectorAll("[data-start]").forEach(btn =>
      btn.addEventListener("click", () => renderReadiness(btn.dataset.start)));
  }

  /* =====================================================================
     State 2 — readiness check-in
     ===================================================================== */

  function renderReadiness(dayKey) {
    const p = Store.getActiveProfile();
    const plan = Store.getPlan(p.id);
    const planned = plan.sessions.find(s => s.dayKey === dayKey);
    if (!planned) { UI.toast(I18n.t("workout.notInPlan"), "error"); return renderPicker(); }

    const answers = {};
    root.innerHTML = `
      <div style="max-width:620px;margin:0 auto;">
        <div class="section-head">
          <div class="kicker">${UI.esc(templateName(planned.templateId))}</div>
          <h2>${UI.t("workout.readinessTitle")}</h2>
          <p>${UI.t("workout.readinessBody")}</p>
        </div>
        <div class="card">
          ${Coach.READINESS_QUESTIONS.map(q => `
            <fieldset class="readiness-q">
              <legend>${UI.t(`engine.readiness.question.${q.id}`)}</legend>
              <div class="readiness-scale" data-q="${q.id}" role="group"
                   aria-label="${UI.t(`engine.readiness.question.${q.id}`)}">
                ${[1, 2, 3, 4, 5].map(v => `<button type="button" data-v="${v}"
                    aria-pressed="false">${I18n.num(v)}</button>`).join("")}
              </div>
              <div class="readiness-ends"><span>${UI.t(`engine.readiness.low_label.${q.id}`)}</span>
                <span>${UI.t(`engine.readiness.high_label.${q.id}`)}</span></div>
            </fieldset>`).join("")}
          <div id="readinessVerdict" class="hint" style="margin:6px 0 16px;" role="status"></div>
          <div class="form-actions">
            <button class="btn btn-primary" id="beginBtn" disabled>${UI.t("workout.begin")}</button>
            <button class="btn btn-ghost" id="skipBtn">${UI.t("workout.skipReadiness")}</button>
          </div>
        </div>
      </div>`;

    root.querySelectorAll(".readiness-scale").forEach(scale => {
      scale.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
          scale.querySelectorAll("button").forEach(b => {
            b.classList.remove("on"); b.setAttribute("aria-pressed", "false");
          });
          btn.classList.add("on"); btn.setAttribute("aria-pressed", "true");
          answers[scale.dataset.q] = Number(btn.dataset.v);
          const complete = Coach.READINESS_QUESTIONS.every(q => answers[q.id]);
          document.getElementById("beginBtn").disabled = !complete;
          if (complete) {
            const r = Coach.scoreReadiness(answers);
            document.getElementById("readinessVerdict").innerHTML =
              `<b style="color:var(--accent)">${UI.t("workout.readinessVerdict", { score: r.score })}</b>
               ${UI.t(r.noteKey)}`;
          }
        });
      });
    });

    document.getElementById("beginBtn").addEventListener("click", () => begin(dayKey, Coach.scoreReadiness(answers)));
    document.getElementById("skipBtn").addEventListener("click", () => begin(dayKey, null));
  }

  function begin(dayKey, readiness) {
    const p = Store.getActiveProfile();
    const session = Store.startSession(p.id, dayKey, readiness);
    if (!session) { UI.toast(I18n.t("workout.cannotStart"), "error"); return renderPicker(); }
    renderPlayer();
  }

  /* =====================================================================
     State 3 — the player
     ===================================================================== */

  function renderPlayer() {
    const p = Store.getActiveProfile();
    const session = p.activeSession;
    if (!session) return renderPicker();

    const loggedFor = exId => session.sets.filter(s => s.exerciseId === exId && s.done);
    const totalSets = session.blocks.reduce((n, b) => n + b.sets, 0);
    const doneSets = session.sets.filter(s => s.done).length;
    const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;
    const activeBlockIdx = session.blocks.findIndex(b => loggedFor(b.exerciseId).length < b.sets);

    root.innerHTML = `
      <div class="section-head" style="margin-bottom:18px;">
        <div class="kicker">${UI.esc(Periodization.phaseFor(p).label)}${session.readiness
          ? ` · ${UI.t("workout.readinessVerdict", { score: session.readiness.score })}` : ""}</div>
        <h2>${UI.esc(templateName(session.templateId))}</h2>
      </div>
      <div class="rest-bar hidden" id="restBar" role="timer" aria-live="off">
        <div class="t" id="restTime" dir="ltr">0:00</div>
        <div class="lbl"><b id="restLabel">${UI.t("workout.resting")}</b><span id="restNext"></span></div>
        <button class="btn btn-ghost btn-sm" id="restSkip">${UI.t("workout.skipRest")}</button>
        <button class="btn btn-ghost btn-sm" id="restPlus">${UI.t("workout.addRest")}</button>
        <i class="bar" id="restProgress"></i>
      </div>

      <div class="workout-shell">
        <div>
          ${session.readiness && session.readiness.score < 70 ? `
            <div class="coach-card sev-warn" style="margin-bottom:16px;">
              <h3>${UI.t("workout.scaledTitle")}</h3>
              <p>${UI.t("workout.scaledBody", { note: I18n.t(session.readiness.noteKey) })}</p>
            </div>` : ""}
          <div id="blocks"></div>
          <div class="inline-actions" style="margin-top:24px;">
            <button class="btn btn-primary" id="finishBtn">${UI.t("workout.finish")}</button>
            <button class="btn btn-danger" id="abandonBtn">${UI.t("workout.discard")}</button>
          </div>
        </div>

        <aside class="wo-side">
          <div class="card">
            <h4 id="progressHeading">${UI.t("workout.sessionProgress")}</h4>
            <div class="wo-progress-ring">
              <div class="num">${I18n.num(pct)}<span>%</span></div>
              <div style="flex:1;">
                <div class="bar" role="progressbar" aria-labelledby="progressHeading"
                     aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
                     style="height:8px;background:var(--border);border-radius:99px;overflow:hidden;">
                  <i style="display:block;height:100%;width:${pct}%;background:var(--accent);"></i></div>
                <div class="hint" style="margin:8px 0 0;">${UI.t("workout.setsLogged", { done: doneSets, total: totalSets })}</div>
              </div>
            </div>
          </div>
          <div class="card">
            <h4>${UI.t("workout.volumeSoFar")}</h4>
            <div class="num" style="font-size:1.6rem;font-weight:800;">${UI.esc(UI.fmt.tonnage(Progression.sessionTonnage(session)))}</div>
            <div class="hint" style="margin:4px 0 0;">${UI.t("workout.volumeHint")}</div>
          </div>
          ${session.cardio ? `
          <div class="card">
            <h4>${UI.t("workout.cardioTitle")}</h4>
            <p style="font-size:.9rem;margin:0 0 10px;"><b style="color:var(--text)">${UI.esc(exName(session.cardio.exerciseId))}</b><br>
              ${I18n.num(session.cardio.minutes)} ${UI.t("common.minutes")} — ${UI.esc(cardioIntensity(p.goal))}</p>
            <label class="toggle ${session.cardio.done ? "on" : ""}">
              <input type="checkbox" id="cardioDone" ${session.cardio.done ? "checked" : ""}> ${UI.t("workout.completed")}
            </label>
          </div>` : ""}
          <div class="card">
            <h4 id="notesHeading">${UI.t("workout.notesTitle")}</h4>
            <textarea id="sessionNotes" class="search-input" aria-labelledby="notesHeading"
              style="width:100%;min-height:88px;border-radius:8px;resize:vertical;"
              placeholder="${UI.t("workout.notesPlaceholder")}">${UI.esc(session.notes || "")}</textarea>
          </div>
        </aside>
      </div>`;

    renderBlocks(session, activeBlockIdx);
    wirePlayer(session);
  }

  function renderBlocks(session, activeIdx) {
    const host = document.getElementById("blocks");
    host.innerHTML = session.blocks.map((b, bi) => {
      const ex = exerciseById(b.exerciseId);
      const logged = session.sets.filter(s => s.exerciseId === b.exerciseId && s.done);
      const complete = logged.length >= b.sets;
      const isActive = bi === activeIdx;
      const cue = isActive ? Coach.setCue(b, logged.length, session.sets) : null;

      const rows = Array.from({ length: b.sets }, (_, si) => {
        const rec = session.sets.find(s => s.exerciseId === b.exerciseId && s.setIndex === si);
        const isDone = rec && rec.done;
        const prevReps = logged.length ? logged[logged.length - 1].reps : "";
        return `
          <div class="set-row ${isDone ? "logged" : ""}" data-ex="${b.exerciseId}" data-set="${si}">
            <div class="set-no" aria-hidden="true">${I18n.num(si + 1)}</div>
            <div class="f"><label for="w-${b.exerciseId}-${si}">${UI.t(
                ex.loadType === "bodyweight" ? "workout.colAddedWeight"
              : ex.loadSpec.unit === "sec" ? "workout.colSeconds" : "workout.colWeight")}</label>
              <input id="w-${b.exerciseId}-${si}" type="number" step="0.5" min="0" inputmode="decimal" dir="ltr"
                class="in-weight" value="${isDone ? rec.weight : b.weight}" ${isDone ? "disabled" : ""}></div>
            <div class="f"><label for="r-${b.exerciseId}-${si}">${UI.t(ex.loadType === "timed" ? "workout.colHeld" : "workout.colReps")}</label>
              <input id="r-${b.exerciseId}-${si}" type="number" step="1" min="0" inputmode="numeric" dir="ltr"
                class="in-reps" value="${isDone ? rec.reps : (prevReps || "")}"
                placeholder="${b.repLo}–${b.repHi}" ${isDone ? "disabled" : ""}></div>
            <div class="f"><label for="e-${b.exerciseId}-${si}">${UI.t("workout.colRpe")}</label>
              <select id="e-${b.exerciseId}-${si}" class="in-rpe" dir="ltr" ${isDone ? "disabled" : ""}>
                <option value="">—</option>
                ${[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(v =>
                  `<option value="${v}" ${isDone && Number(rec.rpe) === v ? "selected" : ""}>${v}</option>`).join("")}
              </select></div>
            <button class="log-btn ${isDone ? "undo" : ""}">${UI.t(isDone ? "workout.undo" : "workout.logSet")}</button>
          </div>`;
      }).join("");

      return `
        <div class="wo-card ${complete ? "done" : ""} ${isActive ? "active" : ""}" data-hover-media>
          <div class="wo-head">
            ${UI.exerciseThumb(b.exerciseId, "lg")}
            <div class="meta">
              <h3>${UI.esc(exName(b.exerciseId))}</h3>
              <div class="sub">${UI.t("workout.headSub", {
                pattern: patternLabel(ex.pattern), loadType: loadTypeLabel(ex.loadType), rest: b.restSec
              })}${complete ? UI.t("workout.headComplete") : ""}</div>
            </div>
            <div class="wo-target">
              <b>${UI.esc(UI.fmt.load(b.weight, ex))}</b>
              <span>${UI.t("workout.target", { sets: b.sets, lo: b.repLo, hi: b.repHi, rpeCap: b.rpeCap })}</span>
            </div>
          </div>
          ${cue ? `<div class="wo-cue">${UI.esc(cue)}</div>` : ""}
          ${b.warmups && b.warmups.length && !logged.length ? `
            <div class="wo-warmup"><b>${UI.t("workout.warmupRamp")}</b>
              ${b.warmups.map(w => `${I18n.num(w.weight)} ${UI.t("common.kg")} × ${I18n.num(w.reps)}`)
                  .concat([UI.t("workout.workingSets")]).join(UI.t("workout.rampArrow"))}</div>` : ""}
          <details class="wo-why">
            <summary>${UI.t("workout.whyWeight")}</summary>
            <div class="body">${UI.tx(b.reason)}
              ${b.readinessAdjusted ? `<p style="margin:10px 0 0;color:var(--warn)">${UI.t("workout.readinessAdjusted", {
                  from: b.readinessAdjusted.from, to: b.readinessAdjusted.to })}</p>` : ""}
              ${b.evidence ? `<div class="ev">
                <span>${UI.t("workout.lastSession")} <b>${UI.esc(UI.fmt.relDate(b.evidence.date))}</b></span>
                <span>${UI.t("workout.evReps")} <b>${UI.esc(b.evidence.reps.join(" / "))}</b></span>
                ${b.evidence.avgRpe ? `<span>${UI.t("workout.evRpe")} <b>${I18n.num(b.evidence.avgRpe)}</b></span>` : ""}
                <span>${UI.t("workout.evE1rm")} <b>${I18n.num(b.evidence.e1rm)} ${UI.t("common.kg")}</b></span>
              </div>` : ""}
            </div>
          </details>
          ${rows}
        </div>`;
    }).join("");
    UI.wireThumbHover(host);
  }

  function wirePlayer(session) {
    const p = Store.getActiveProfile();

    document.querySelectorAll(".set-row").forEach(row => {
      const btn = row.querySelector(".log-btn");
      btn.addEventListener("click", () => {
        const exId = row.dataset.ex;
        const setIndex = Number(row.dataset.set);
        const current = Store.getActiveProfile().activeSession;
        const existingIdx = current.sets.findIndex(s => s.exerciseId === exId && s.setIndex === setIndex);

        if (existingIdx !== -1 && current.sets[existingIdx].done) {
          current.sets.splice(existingIdx, 1);                 // undo
          Store.saveActiveSession(p.id, current);
          stopRest();
          return renderPlayer();
        }

        const weight = Number(row.querySelector(".in-weight").value);
        const reps = Number(row.querySelector(".in-reps").value);
        const rpeRaw = row.querySelector(".in-rpe").value;
        if (!reps || reps <= 0) { UI.toast(I18n.t("workout.needReps"), "warn"); return; }

        const entry = { exerciseId: exId, setIndex, weight, reps, rpe: rpeRaw === "" ? null : Number(rpeRaw), done: true, at: Date.now() };
        if (existingIdx !== -1) current.sets[existingIdx] = entry; else current.sets.push(entry);
        Store.saveActiveSession(p.id, current);

        const block = current.blocks.find(b => b.exerciseId === exId);
        const remaining = block.sets - current.sets.filter(s => s.exerciseId === exId && s.done).length;
        renderPlayer();
        if (remaining > 0) startRest(block.restSec, I18n.t("workout.restNext", {
          name: exName(exId), n: setIndex + 2, total: block.sets }));
        else startRest(Math.round(block.restSec * 0.8), I18n.t("workout.restNextExercise"));
      });
    });

    const notes = document.getElementById("sessionNotes");
    if (notes) notes.addEventListener("change", () => {
      const current = Store.getActiveProfile().activeSession;
      current.notes = notes.value;
      Store.saveActiveSession(p.id, current);
    });

    const cardio = document.getElementById("cardioDone");
    if (cardio) cardio.addEventListener("change", () => {
      const current = Store.getActiveProfile().activeSession;
      current.cardio.done = cardio.checked;
      Store.saveActiveSession(p.id, current);
      cardio.closest(".toggle").classList.toggle("on", cardio.checked);
    });

    document.getElementById("finishBtn").addEventListener("click", finish);
    document.getElementById("abandonBtn").addEventListener("click", () => {
      if (!confirm(I18n.t("workout.discardConfirm"))) return;
      stopRest();
      Store.discardActiveSession(p.id);
      renderPicker();
    });

    const restBar = document.getElementById("restBar");
    restBar.querySelector("#restSkip").addEventListener("click", stopRest);
    restBar.querySelector("#restPlus").addEventListener("click", () => { restEnds += 30000; restTotal += 30; });
  }

  /* ---------------- Rest timer ---------------- */

  function startRest(seconds, nextLabel) {
    stopRest();
    restTotal = seconds;
    restEnds = Date.now() + seconds * 1000;
    const bar = document.getElementById("restBar");
    if (!bar) return;
    bar.classList.remove("hidden");
    document.getElementById("restNext").textContent = nextLabel || "";
    tickRest();
    restTimer = setInterval(tickRest, 250);
  }

  function tickRest() {
    const left = (restEnds - Date.now()) / 1000;
    const timeEl = document.getElementById("restTime");
    if (!timeEl) return stopRest();
    if (left <= 0) {
      timeEl.textContent = "0:00";
      document.getElementById("restLabel").textContent = I18n.t("workout.restDone");
      document.getElementById("restProgress").style.width = "100%";
      UI.beep(2);
      clearInterval(restTimer); restTimer = null;
      setTimeout(() => { const b = document.getElementById("restBar"); if (b) b.classList.add("hidden"); }, 4000);
      return;
    }
    timeEl.textContent = UI.fmt.clock(left);
    document.getElementById("restLabel").textContent = I18n.t("workout.resting");
    document.getElementById("restProgress").style.width = `${Math.min(100, ((restTotal - left) / restTotal) * 100)}%`;
  }

  function stopRest() {
    if (restTimer) { clearInterval(restTimer); restTimer = null; }
    const bar = document.getElementById("restBar");
    if (bar) bar.classList.add("hidden");
  }

  /* ---------------- Finish ---------------- */

  function finish() {
    const p = Store.getActiveProfile();
    const session = p.activeSession;
    const logged = session.sets.filter(s => s.done);
    if (!logged.length) { UI.toast(I18n.t("workout.needOneSet"), "warn"); return; }

    const notes = document.getElementById("sessionNotes");
    if (notes) session.notes = notes.value;

    const debrief = Coach.sessionDebrief(p, session);
    stopRest();
    Store.completeSession(p.id, session);
    const after = Store.getActiveProfile();

    // What changed for next time, computed from the session just saved.
    const phase = Periodization.phaseFor(after);
    const changes = [...new Set(logged.map(s => s.exerciseId))].map(exId => {
      const ex = exerciseById(exId);
      const rx = after.prescriptions[exId];
      if (!rx) return null;
      return { ex, rx };
    }).filter(Boolean);

    UI.modal(`
      <div class="modal-head"><div>
        <span class="pill good">${UI.t("workout.saved")}</span>
        <h3 style="margin-top:10px;">${UI.esc(debrief.headline)}</h3>
        <div class="hint">${UI.t("workout.debriefStats", {
          sets: debrief.setsLogged, tonnage: UI.fmt.tonnage(debrief.tonnage),
          duration: session.durationMin ? I18n.t("workout.debriefDuration", { minutes: session.durationMin }) : "",
        })}</div>
      </div></div>
      <div class="modal-body">
        ${debrief.lines.length ? `<h4>${UI.t("workout.stoodOut")}</h4><ul class="tips">${debrief.lines.map(l =>
          `<li style="color:${l.kind === "warn" ? "var(--warn)" : l.kind === "pr" ? "var(--good)" : "var(--text-dim)"}">${UI.esc(l.text)}</li>`).join("")}</ul>` : ""}
        <h4>${UI.t("workout.nextLoads")}</h4>
        <table class="rx-table">
          ${changes.map(c => `<tr>
            <td class="rx-name">${UI.esc(exName(c.ex.id))}</td>
            <td class="rx-load">${UI.esc(UI.fmt.load(c.rx.weight, c.ex))}
              ${c.rx.delta ? `<span class="delta ${c.rx.delta > 0 ? "up" : "down"}">${UI.esc(UI.fmt.signed(c.rx.delta, " " + I18n.t("common.kg")))}</span>` : ""}</td>
            <td style="text-align:${I18n.isRTL() ? "left" : "right"};">${UI.actionBadge(c.rx.action)}</td>
          </tr>`).join("")}
        </table>
        <div class="source-note">${UI.t("workout.debriefNote")}</div>
        <div class="form-actions">
          <a href="coach.html" class="btn btn-primary">${UI.t("workout.seeReasoning")}</a>
          <a href="program.html" class="btn btn-ghost">${UI.t("workout.backToProgram")}</a>
        </div>
      </div>`, { wide: true });

    renderPicker();
  }

  /* ---------------- Boot ---------------- */

  const existing = Store.getActiveSession(profile.id);
  if (existing) renderPlayer();
  else if (params.get("day")) renderReadiness(params.get("day"));
  else renderPicker();
});
