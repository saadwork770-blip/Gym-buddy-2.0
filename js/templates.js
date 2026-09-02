/* ============================================================================
   GymBuddy 2.0 — templates.js
   ----------------------------------------------------------------------------
   Session blueprints, expressed as movement-pattern slots rather than fixed
   exercises. The scheduler fills each slot with a concrete lift from the
   library based on what equipment you have, what hurts, and what you have
   already been doing — which is what makes the plan adaptable instead of a
   static printout.

   `prefer` names the exercise the original Fitness Time plan used for that
   slot, so a 4-day week with default settings reproduces that plan exactly,
   move for move. Change a setting and the blueprint bends; leave it alone and
   you get the plan you already know.
   ============================================================================ */

/* role drives set/rep assignment and ordering within the session:
     primary   — the heavy compound the session is built around (first, most rest)
     secondary — a second compound or a heavy accessory
     accessory — isolation work
     finisher  — core / calves, cheap to add, first to be cut on a short session */
const SESSION_TEMPLATES = {
  /* ---------------- Upper / Lower ---------------- */
  upper_a: {
    id: "upper_a",
    slots: [
      { pattern: "horizontal_push", role: "primary",   prefer: "chest-press-machine" },
      { pattern: "vertical_pull",   role: "primary",   prefer: "lat-pulldown-wide" },
      { pattern: "horizontal_pull", role: "secondary", prefer: "seated-cable-row" },
      { pattern: "vertical_push",   role: "secondary", prefer: "shoulder-press-machine" },
      { pattern: "triceps_iso",     role: "accessory", prefer: "cable-triceps-pushdown" },
      { pattern: "biceps_iso",      role: "accessory", prefer: "seated-db-bicep-curl" },
    ],
  },
  lower_a: {
    id: "lower_a",
    slots: [
      { pattern: "squat",          role: "primary",   prefer: "leg-press" },
      { pattern: "knee_flexion",   role: "secondary", prefer: "seated-leg-curl" },
      { pattern: "knee_extension", role: "accessory", prefer: "leg-extension" },
      { pattern: "hip_abduction",  role: "accessory", prefer: "hip-adduction-abduction" },
      { pattern: "calf",           role: "finisher",  prefer: "standing-calf-raise-machine" },
      { pattern: "core_flexion",   role: "finisher",  prefer: "cable-crunch-ab-machine" },
    ],
  },
  upper_b: {
    id: "upper_b",
    slots: [
      { pattern: "incline_push",  role: "primary",   prefer: "smith-machine-incline-press" },
      { pattern: "vertical_pull", role: "primary",   prefer: "assisted-pull-up-machine" },
      { pattern: "chest_iso",     role: "secondary", prefer: "chest-fly-pec-deck" },
      { pattern: "lateral_raise", role: "accessory", prefer: "dumbbell-lateral-raise" },
      { pattern: "rear_delt",     role: "accessory", prefer: "cable-rope-face-pull" },
      { pattern: "triceps_iso",   role: "accessory", prefer: "db-overhead-triceps-extension" },
    ],
  },
  lower_b: {
    id: "lower_b",
    slots: [
      { pattern: "squat",      role: "primary",   prefer: "hack-squat-machine" },
      { pattern: "hinge",      role: "primary",   prefer: "romanian-deadlift" },
      { pattern: "lunge",      role: "secondary", prefer: "walking-lunges" },
      { pattern: "glute_iso",  role: "accessory", prefer: "glute-kickback" },
      { pattern: "calf",       role: "finisher",  prefer: "seated-calf-raise" },
      { pattern: "core_brace", role: "finisher",  prefer: "plank" },
    ],
  },

  /* ---------------- Full body ---------------- */
  full_a: {
    id: "full_a",
    slots: [
      { pattern: "squat",           role: "primary",   prefer: "leg-press" },
      { pattern: "horizontal_push", role: "primary",   prefer: "chest-press-machine" },
      { pattern: "vertical_pull",   role: "primary",   prefer: "lat-pulldown-wide" },
      { pattern: "knee_flexion",    role: "secondary", prefer: "seated-leg-curl" },
      { pattern: "lateral_raise",   role: "accessory", prefer: "dumbbell-lateral-raise" },
      { pattern: "core_flexion",    role: "finisher",  prefer: "cable-crunch-ab-machine" },
    ],
  },
  full_b: {
    id: "full_b",
    slots: [
      { pattern: "hinge",           role: "primary",   prefer: "romanian-deadlift" },
      { pattern: "incline_push",    role: "primary",   prefer: "smith-machine-incline-press" },
      { pattern: "horizontal_pull", role: "primary",   prefer: "seated-cable-row" },
      { pattern: "knee_extension",  role: "secondary", prefer: "leg-extension" },
      { pattern: "triceps_iso",     role: "accessory", prefer: "cable-triceps-pushdown" },
      { pattern: "core_brace",      role: "finisher",  prefer: "plank" },
    ],
  },
  full_c: {
    id: "full_c",
    slots: [
      { pattern: "lunge",         role: "primary",   prefer: "walking-lunges" },
      { pattern: "vertical_push", role: "primary",   prefer: "shoulder-press-machine" },
      { pattern: "vertical_pull", role: "primary",   prefer: "assisted-pull-up-machine" },
      { pattern: "chest_iso",     role: "secondary", prefer: "chest-fly-pec-deck" },
      { pattern: "biceps_iso",    role: "accessory", prefer: "seated-db-bicep-curl" },
      { pattern: "calf",          role: "finisher",  prefer: "standing-calf-raise-machine" },
    ],
  },

  /* ---------------- Push / Pull / Legs ---------------- */
  push_a: {
    id: "push_a",
    slots: [
      { pattern: "horizontal_push", role: "primary",   prefer: "chest-press-machine" },
      { pattern: "vertical_push",   role: "primary",   prefer: "shoulder-press-machine" },
      { pattern: "chest_iso",       role: "secondary", prefer: "chest-fly-pec-deck" },
      { pattern: "lateral_raise",   role: "accessory", prefer: "dumbbell-lateral-raise" },
      { pattern: "triceps_iso",     role: "accessory", prefer: "cable-triceps-pushdown" },
    ],
  },
  push_b: {
    id: "push_b",
    slots: [
      { pattern: "incline_push",    role: "primary",   prefer: "smith-machine-incline-press" },
      { pattern: "vertical_push",   role: "primary",   prefer: "seated-db-shoulder-press" },
      { pattern: "horizontal_push", role: "secondary", prefer: "chest-press-machine" },
      { pattern: "lateral_raise",   role: "accessory", prefer: "cable-lateral-raise" },
      { pattern: "triceps_iso",     role: "accessory", prefer: "db-overhead-triceps-extension" },
    ],
  },
  pull_a: {
    id: "pull_a",
    slots: [
      { pattern: "vertical_pull",   role: "primary",   prefer: "lat-pulldown-wide" },
      { pattern: "horizontal_pull", role: "primary",   prefer: "seated-cable-row" },
      { pattern: "rear_delt",       role: "secondary", prefer: "cable-rope-face-pull" },
      { pattern: "biceps_iso",      role: "accessory", prefer: "seated-db-bicep-curl" },
      { pattern: "core_flexion",    role: "finisher",  prefer: "cable-crunch-ab-machine" },
    ],
  },
  pull_b: {
    id: "pull_b",
    slots: [
      { pattern: "horizontal_pull", role: "primary",   prefer: "machine-chest-supported-row" },
      { pattern: "vertical_pull",   role: "primary",   prefer: "assisted-pull-up-machine" },
      { pattern: "rear_delt",       role: "secondary", prefer: "reverse-pec-deck" },
      { pattern: "biceps_iso",      role: "accessory", prefer: "hammer-curl" },
      { pattern: "core_brace",      role: "finisher",  prefer: "plank" },
    ],
  },
  legs_a: {
    id: "legs_a",
    slots: [
      { pattern: "squat",          role: "primary",   prefer: "leg-press" },
      { pattern: "knee_flexion",   role: "secondary", prefer: "seated-leg-curl" },
      { pattern: "knee_extension", role: "accessory", prefer: "leg-extension" },
      { pattern: "hip_abduction",  role: "accessory", prefer: "hip-adduction-abduction" },
      { pattern: "calf",           role: "finisher",  prefer: "standing-calf-raise-machine" },
    ],
  },
  legs_b: {
    id: "legs_b",
    slots: [
      { pattern: "hinge",     role: "primary",   prefer: "romanian-deadlift" },
      { pattern: "squat",     role: "primary",   prefer: "hack-squat-machine" },
      { pattern: "lunge",     role: "secondary", prefer: "walking-lunges" },
      { pattern: "glute_iso", role: "accessory", prefer: "glute-kickback" },
      { pattern: "calf",      role: "finisher",  prefer: "seated-calf-raise" },
    ],
  },
};

/* ---------------- Split definitions ----------------
   `days` is the training-day count the split is designed for. `pick` decides
   between two splits that fit the same day count — a 3-day beginner is better
   served by full body than by a PPL rotation, and a 6-day week only makes
   sense for someone with training history. */
const SPLITS = {
  full_1: {
    id: "full_1", days: 1, sequence: ["full_a"],
  },
  full_2: {
    id: "full_2", days: 2, sequence: ["full_a", "full_b"],
  },
  full_3: {
    id: "full_3", days: 3, sequence: ["full_a", "full_b", "full_c"],
  },
  ppl_3: {
    id: "ppl_3", days: 3, sequence: ["push_a", "pull_a", "legs_a"],
  },
  upper_lower_4: {
    id: "upper_lower_4", days: 4, sequence: ["upper_a", "lower_a", "upper_b", "lower_b"],
  },
  ul_ppl_5: {
    id: "ul_ppl_5", days: 5, sequence: ["upper_a", "lower_a", "push_b", "pull_b", "legs_b"],
  },
  ppl_6: {
    id: "ppl_6", days: 6, sequence: ["push_a", "pull_a", "legs_a", "push_b", "pull_b", "legs_b"],
  },
};

/* Which split to use for a given day count, experience and goal. */
function selectSplit(dayCount, levelId, goalId) {
  const n = Math.max(1, Math.min(6, dayCount));
  if (n === 1) return SPLITS.full_1;
  if (n === 2) return SPLITS.full_2;
  if (n === 3) {
    // Beginners and fat-loss trainees do better with frequency than with
    // per-session specialisation; advanced lifters can use the PPL rotation.
    return levelId === "advanced" ? SPLITS.ppl_3 : SPLITS.full_3;
  }
  if (n === 4) return SPLITS.upper_lower_4;
  if (n === 5) return SPLITS.ul_ppl_5;
  return SPLITS.ppl_6;
}

/* Muscle-overlap matrix between two templates, 0 (unrelated) → 1 (identical).
   Drives recovery-aware day placement: two sessions that overlap heavily need
   to be pushed as far apart in the week as possible. */
function templateOverlap(aId, bId) {
  const a = SESSION_TEMPLATES[aId], b = SESSION_TEMPLATES[bId];
  if (!a || !b) return 0;
  if (aId === bId) return 1;
  const load = t => {
    const acc = {};
    t.slots.forEach(s => {
      const ex = exerciseById(s.prefer);
      const contrib = (ex && ex.contribution) || {};
      Object.entries(contrib).forEach(([m, v]) => { acc[m] = (acc[m] || 0) + v; });
    });
    return acc;
  };
  const la = load(a), lb = load(b);
  const muscles = new Set([...Object.keys(la), ...Object.keys(lb)]);
  let dot = 0, na = 0, nb = 0;
  muscles.forEach(m => {
    const x = la[m] || 0, y = lb[m] || 0;
    dot += x * y; na += x * x; nb += y * y;
  });
  return (na && nb) ? dot / Math.sqrt(na * nb) : 0;   // cosine similarity
}

/* ---------- Language-aware names ----------
   Template and split names live in the dictionaries; the structures above keep
   only ids, slots and the numbers the scheduler reasons about. */
function templateName(id)     { return I18n.t(`template.${id}.name`); }
function templateShort(id)    { return I18n.t(`template.${id}.short`); }
function templateEmphasis(id) { return I18n.t(`template.${id}.emphasis`); }
function splitName(id)        { return I18n.t(`split.${id}.name`); }
function splitRationale(id)   { return I18n.t(`split.${id}.rationale`); }
