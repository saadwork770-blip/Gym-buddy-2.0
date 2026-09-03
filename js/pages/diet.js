/* ============================================================================
   GymBuddy 2.0 — pages/diet.js
   Calorie and macro targets from the profile's own numbers, plus meal
   suggestions built to hit them. Same rule as the rest of the coaching
   engine: the reasoning card names the actual formula and the actual
   numbers that produced the target, not just the target.
   ============================================================================ */

UI.ready(() => {
  const p = UI.requireProfile("root", "diet");
  if (!p) return;

  const plan = Store.getPlan(p.id);
  const day = Nutrition.planFor(p, plan);

  document.getElementById("kpis").innerHTML = `
    <div class="kpi"><b>${I18n.num(Math.round(day.bmr))}</b><span>${UI.t("diet.kpiBmr")}</span></div>
    <div class="kpi"><b>${I18n.num(Math.round(day.tdee.value))}</b><span>${UI.t("diet.kpiTdee")}</span></div>
    <div class="kpi"><b>${I18n.num(Math.round(day.calorieTarget.value))}</b><span>${UI.t("diet.kpiTarget")}</span></div>
    <div class="kpi"><b>${I18n.num(day.daysPerWeek)}</b><span>${UI.t("diet.kpiDays")}</span></div>`;

  const activityLabel = UI.t(`diet.activity.${day.tdee.level.labelKey}`);
  const deltaPct = Math.round(day.calorieTarget.deltaPct * 100);
  const deltaText = deltaPct === 0
    ? UI.t("diet.reasonMaintenance")
    : UI.t(deltaPct > 0 ? "diet.reasonSurplus" : "diet.reasonDeficit", { pct: Math.abs(deltaPct) });

  document.getElementById("reasoning").innerHTML = `
    <h3>${UI.t("diet.reasoningTitle")}</h3>
    <p>${UI.t("diet.reasonBmr", {
      weight: I18n.num(Math.round(p.weightKg)), height: I18n.num(Math.round(p.heightCm)), age: I18n.num(p.age),
    })}</p>
    <p>${UI.t("diet.reasonActivity", {
      daysLabel: UI.t("diet.trainingDays", { count: day.daysPerWeek }), level: activityLabel,
    })}</p>
    <p>${deltaText}${day.calorieTarget.floored ? " " + UI.t("diet.reasonFloored") : ""}</p>`;

  const m = day.macros;
  const total = day.calorieTarget.value;
  const pct = kcal => Math.max(0, Math.round((kcal / total) * 100));
  document.getElementById("macroHint").textContent = UI.t("diet.macroHint");
  document.getElementById("macroBar").innerHTML = `
    <i class="macro-seg protein" style="width:${pct(m.protein.kcal)}%"></i>
    <i class="macro-seg carb" style="width:${pct(m.carb.kcal)}%"></i>
    <i class="macro-seg fat" style="width:${pct(m.fat.kcal)}%"></i>`;
  document.getElementById("macroLegend").innerHTML = ["protein", "carb", "fat"].map(k => `
    <div class="macro-item">
      <span class="macro-dot ${k}"></span>
      <div><b>${I18n.num(Math.round(m[k].grams))} ${UI.t("diet.gramsUnit")}</b>
        <span>${UI.t(`diet.macro.${k}`)} · ${I18n.num(Math.round(m[k].kcal))} ${UI.t("diet.kcalUnit")} · ${I18n.num(pct(m[k].kcal))}%</span></div>
    </div>`).join("");

  const SLOTS = ["breakfast", "lunch", "dinner", "snack"];
  const targets = Nutrition.mealTargets(day, SLOTS);
  document.getElementById("meals").innerHTML = SLOTS.map(slot => {
    const t = targets[slot];
    const foods = Nutrition.suggestMeal(t, slot);
    return `
      <div class="card meal-card">
        <div class="meal-head">
          <h4>${UI.t(`diet.slot.${slot}`)}</h4>
          <span class="hint">${I18n.num(Math.round(t.kcal))} ${UI.t("diet.kcalUnit")} ·
            ${UI.t("diet.macroShort", { p: Math.round(t.protein), c: Math.round(t.carb), f: Math.round(t.fat) })}</span>
        </div>
        <ul class="meal-foods">
          ${foods.map(f => `
            <li>
              <span class="mf-name">${UI.t(`food.${f.id}.name`)}</span>
              <span class="mf-serving">${UI.t(`food.${f.id}.serving`)}</span>
              <span class="mf-macro hint">${I18n.num(f.kcal)} ${UI.t("diet.kcalUnit")} ·
                ${UI.t("diet.macroShort", { p: f.protein, c: f.carb, f: f.fat })}</span>
            </li>`).join("")}
        </ul>
      </div>`;
  }).join("");

  document.getElementById("disclaimer").textContent = UI.t("diet.disclaimer");
});
