/* ============================================================================
   GymBuddy 2.0 — engine/nutrition.js
   ----------------------------------------------------------------------------
   Turns a profile's own numbers into a calorie and macro target, the same
   transparent-formula way the training engine turns them into a working
   weight. Every function here is pure — given the same inputs it returns the
   same output — so the reasoning is exactly the formulas in data/nutrition.js,
   nothing hidden between the two.
   ============================================================================ */

const Nutrition = (function () {

  /** Mifflin-St Jeor basal metabolic rate, in kcal/day. */
  function bmr(profile) {
    const s = BMR_SEX_CONSTANT[profile.sex] ?? BMR_SEX_CONSTANT["Prefer not to say"];
    return 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + s;
  }

  /** The activity bracket a plan's days/week falls into. */
  function activityLevel(daysPerWeek) {
    return ACTIVITY_LEVEL.find(a => daysPerWeek <= a.maxDays) || ACTIVITY_LEVEL[ACTIVITY_LEVEL.length - 1];
  }

  /** Total daily energy expenditure: BMR scaled by how often the plan trains. */
  function tdee(profile, daysPerWeek) {
    const level = activityLevel(daysPerWeek);
    return { value: bmr(profile) * level.multiplier, level };
  }

  /** Goal id (GOAL_PROFILES' own ids — fat_loss, hypertrophy, strength, general). */
  function goalId(goalName) {
    const g = GOAL_PROFILES[goalName];
    return g ? g.id : "general";
  }

  /** The day's calorie target: TDEE plus the goal's adjustment, never let
      below the sex-specific floor regardless of how large a deficit the
      percentage would otherwise ask for. */
  function calorieTarget(tdeeValue, profile) {
    const adjust = CALORIE_ADJUST[goalId(profile.goal)] || CALORIE_ADJUST.general;
    const raw = tdeeValue * (1 + adjust.deltaPct);
    const floor = CALORIE_FLOOR[profile.sex] ?? CALORIE_FLOOR["Prefer not to say"];
    return { value: Math.max(raw, floor), raw, floored: raw < floor, deltaPct: adjust.deltaPct };
  }

  /** Grams and kcal of each macro for a given calorie target and bodyweight.
      Protein is set first, in g/kg, because that is the macro the literature
      actually pins to bodyweight; fat is a percentage of total calories;
      carbs take whatever calories are left. */
  function macros(kcalTarget, profile) {
    const adjust = CALORIE_ADJUST[goalId(profile.goal)] || CALORIE_ADJUST.general;
    const proteinG = adjust.proteinPerKg * profile.weightKg;
    const proteinKcal = proteinG * KCAL_PER_G.protein;
    const fatKcal = kcalTarget * FAT_PCT_OF_CALORIES;
    const fatG = fatKcal / KCAL_PER_G.fat;
    const carbKcal = Math.max(kcalTarget - proteinKcal - fatKcal, 0);
    const carbG = carbKcal / KCAL_PER_G.carb;
    return {
      protein: { grams: proteinG, kcal: proteinKcal },
      fat: { grams: fatG, kcal: fatKcal },
      carb: { grams: carbG, kcal: carbKcal },
    };
  }

  /** The full plan for one profile: BMR, TDEE, calorie target and macros,
      built from the same plan the training engine already generated — one
      set of numbers a profile has to keep straight, not two disagreeing
      apps' worth. */
  function planFor(profile, plan) {
    const daysPerWeek = plan && !plan.empty ? plan.dayCount : 3;
    const b = bmr(profile);
    const t = tdee(profile, daysPerWeek);
    const cal = calorieTarget(t.value, profile);
    const m = macros(cal.value, profile);
    return { bmr: b, tdee: t, calorieTarget: cal, macros: m, daysPerWeek };
  }

  /** Meal-slot targets: the day's calories split by MEAL_SHARE, renormalized
      to whichever slots are actually in use, and each macro split the same
      share as calories — so a 30%-of-the-day dinner gets 30% of the protein
      target too, not an even three-way split that ignores meal size. */
  function mealTargets(dayPlan, slots) {
    const share = {};
    let total = 0;
    slots.forEach(s => { share[s] = MEAL_SHARE[s] || 0; total += share[s]; });
    if (total <= 0) return {};
    const out = {};
    slots.forEach(s => {
      const frac = share[s] / total;
      out[s] = {
        kcal: dayPlan.calorieTarget.value * frac,
        protein: dayPlan.macros.protein.grams * frac,
        carb: dayPlan.macros.carb.grams * frac,
        fat: dayPlan.macros.fat.grams * frac,
      };
    });
    return out;
  }

  /** Two or three foods from that meal slot whose combined macros land
      closest to the slot's target — favoring whichever lead (protein/carb/
      balanced) the slot is furthest short of, rather than a fixed menu.
      Simple nearest-fit over a small, curated list; not a solver, because a
      solver would suggest combinations nobody would actually cook or order. */
  function suggestMeal(slotTarget, slot) {
    const pool = FOODS.filter(f => f.meals.includes(slot));
    if (!pool.length) return [];

    const proteinShare = slotTarget.protein * KCAL_PER_G.protein / (slotTarget.kcal || 1);
    const leadOrder = proteinShare >= 0.35
      ? ["protein", "balanced", "carb"]
      : ["carb", "protein", "balanced"];

    const picks = [];
    let remaining = { kcal: slotTarget.kcal, protein: slotTarget.protein, carb: slotTarget.carb, fat: slotTarget.fat };
    const used = new Set();

    for (let round = 0; round < 3 && remaining.kcal > slotTarget.kcal * 0.15; round++) {
      const lead = leadOrder[round] || leadOrder[leadOrder.length - 1];
      const candidates = pool.filter(f => !used.has(f.id) && f.lead === lead);
      if (!candidates.length) continue;
      /* Closest single food to what's left, by kcal — good enough for a
         three-item meal and keeps the reasoning inspectable. */
      candidates.sort((a, b) => Math.abs(a.kcal - remaining.kcal * 0.6) - Math.abs(b.kcal - remaining.kcal * 0.6));
      const pick = candidates[0];
      picks.push(pick);
      used.add(pick.id);
      remaining = {
        kcal: remaining.kcal - pick.kcal,
        protein: remaining.protein - pick.protein,
        carb: remaining.carb - pick.carb,
        fat: remaining.fat - pick.fat,
      };
    }
    return picks;
  }

  return { bmr, activityLevel, tdee, calorieTarget, macros, planFor, mealTargets, suggestMeal };
})();
