/* ============================================================================
   GymBuddy 2.0 — data/coaching.js
   ----------------------------------------------------------------------------
   The structured metadata the coaching engine reasons about, merged onto the
   library that data/library.js defines.

   Nothing here is flavour text — every field drives a real decision:
     · loadType + increment  → what "add weight" physically means on that machine
     · pattern               → which exercises can stand in for which
     · contribution          → weekly set counting per muscle (volume landmarks)
     · jointStress           → what to swap when the user reports pain
     · fatigue               → how much a movement costs in a session budget
     · skill                 → whether to hand this movement to a beginner

   Requires data/library.js to have loaded first.
   ============================================================================ */


const PATTERNS = {
  horizontal_push: "Horizontal Push",
  incline_push:    "Incline Push",
  vertical_push:   "Vertical Push",
  chest_iso:       "Chest Isolation",
  vertical_pull:   "Vertical Pull",
  horizontal_pull: "Horizontal Pull",
  rear_delt:       "Rear Delt / Upper Back",
  lateral_raise:   "Lateral Raise",
  triceps_iso:     "Triceps Isolation",
  biceps_iso:      "Biceps Isolation",
  squat:           "Squat Pattern",
  hinge:           "Hip Hinge",
  lunge:           "Single-Leg / Lunge",
  knee_flexion:    "Knee Flexion (Hamstring)",
  knee_extension:  "Knee Extension (Quad)",
  hip_abduction:   "Hip Abduction / Adduction",
  glute_iso:       "Glute Isolation",
  calf:            "Calf Raise",
  core_flexion:    "Trunk Flexion",
  core_brace:      "Anti-Extension / Bracing",
  cardio:          "Cardio",
};

/* ---------- Load types & default increments (kg) ----------
   The smallest honest jump on each piece of equipment in a commercial gym.
   A machine stack you can only move in 5 kg pins should never be told to
   "add 2 kg" — the whole progression engine rounds through this table. */
const LOAD_TYPES = {
  machine_stack: { label: "Selectorised stack", increment: 5,   min: 5,  unit: "kg" },
  cable_stack:   { label: "Cable stack",        increment: 2.5, min: 2.5,unit: "kg" },
  plate_loaded:  { label: "Plate loaded",       increment: 5,   min: 0,  unit: "kg" },
  barbell:       { label: "Barbell / Smith",    increment: 2.5, min: 20, unit: "kg" },
  dumbbell:      { label: "Dumbbells (pair)",   increment: 2,   min: 2,  unit: "kg" },
  assisted:      { label: "Assistance (inverse)",increment: 5,  min: 0,  unit: "kg" },
  bodyweight:    { label: "Bodyweight",         increment: 0,   min: 0,  unit: "reps" },
  timed:         { label: "Timed hold",         increment: 0,   min: 0,  unit: "sec" },
  cardio_time:   { label: "Duration",           increment: 0,   min: 0,  unit: "min" },
};

/* ---------- Per-exercise coaching metadata ----------
   contribution: fraction of a "set" credited to each muscle for weekly volume
     counting. A chest press gives chest a full set and front delts/triceps a
     half set each — that is how volume landmarks are actually tallied.
   fatigue: systemic cost, 1 (trivial) → 5 (very taxing). Used by the session
     budget and by readiness-based volume cuts.
   jointStress: joints put under meaningful load — the pain-swap key.
   startCoef: fraction of bodyweight used to seed a first working weight when
     there is no history at all. Deliberately conservative; the first session
     is a calibration session, never a max. */
const EX_META = {
  "chest-press-machine": {
    pattern: "horizontal_push", loadType: "machine_stack", role: "compound", fatigue: 3,
    contribution: { chest: 1, shoulders: 0.5, arms: 0.5 }, jointStress: ["shoulder", "elbow"],
    startCoef: 0.32, unilateral: false,
  },
  "lat-pulldown-wide": {
    pattern: "vertical_pull", loadType: "machine_stack", role: "compound", fatigue: 3,
    contribution: { back: 1, arms: 0.5, shoulders: 0.25 }, jointStress: ["shoulder", "elbow"],
    startCoef: 0.38, unilateral: false,
  },
  "seated-cable-row": {
    pattern: "horizontal_pull", loadType: "cable_stack", role: "compound", fatigue: 3,
    contribution: { back: 1, arms: 0.5, shoulders: 0.25 }, jointStress: ["shoulder", "elbow", "lower_back"],
    startCoef: 0.36, unilateral: false,
  },
  "shoulder-press-machine": {
    pattern: "vertical_push", loadType: "machine_stack", role: "compound", fatigue: 3,
    contribution: { shoulders: 1, arms: 0.5, chest: 0.25 }, jointStress: ["shoulder", "elbow"],
    startCoef: 0.20, unilateral: false,
  },
  "cable-triceps-pushdown": {
    pattern: "triceps_iso", loadType: "cable_stack", role: "isolation", fatigue: 1,
    contribution: { arms: 1 }, jointStress: ["elbow"],
    startCoef: 0.18, unilateral: false,
  },
  "seated-db-bicep-curl": {
    pattern: "biceps_iso", loadType: "dumbbell", role: "isolation", fatigue: 1,
    contribution: { arms: 1 }, jointStress: ["elbow"],
    startCoef: 0.08, unilateral: true,
  },
  "leg-press": {
    pattern: "squat", loadType: "plate_loaded", role: "compound", fatigue: 4,
    contribution: { legs: 1, glutes: 0.5 }, jointStress: ["knee", "hip"],
    startCoef: 0.80, unilateral: false,
  },
  "seated-leg-curl": {
    pattern: "knee_flexion", loadType: "machine_stack", role: "isolation", fatigue: 2,
    contribution: { legs: 1, glutes: 0.25 }, jointStress: ["knee"],
    startCoef: 0.20, unilateral: false,
  },
  "leg-extension": {
    pattern: "knee_extension", loadType: "machine_stack", role: "isolation", fatigue: 2,
    contribution: { legs: 1 }, jointStress: ["knee"],
    startCoef: 0.22, unilateral: false,
  },
  "hip-adduction-abduction": {
    pattern: "hip_abduction", loadType: "machine_stack", role: "isolation", fatigue: 1,
    contribution: { glutes: 0.75, legs: 0.5 }, jointStress: ["hip"],
    startCoef: 0.25, unilateral: false,
  },
  "standing-calf-raise-machine": {
    pattern: "calf", loadType: "machine_stack", role: "isolation", fatigue: 1,
    contribution: { legs: 0.5 }, jointStress: ["ankle"],
    startCoef: 0.35, unilateral: false,
  },
  "cable-crunch-ab-machine": {
    pattern: "core_flexion", loadType: "cable_stack", role: "isolation", fatigue: 1,
    contribution: { core: 1 }, jointStress: ["lower_back"],
    startCoef: 0.20, unilateral: false,
  },
  "smith-machine-incline-press": {
    pattern: "incline_push", loadType: "barbell", role: "compound", fatigue: 3,
    contribution: { chest: 1, shoulders: 0.5, arms: 0.5 }, jointStress: ["shoulder", "elbow"],
    startCoef: 0.28, unilateral: false,
  },
  "assisted-pull-up-machine": {
    pattern: "vertical_pull", loadType: "assisted", role: "compound", fatigue: 3,
    contribution: { back: 1, arms: 0.5, shoulders: 0.25 }, jointStress: ["shoulder", "elbow"],
    startCoef: 0.55, unilateral: false,
    /* On an assisted machine the number on the stack is help, not resistance:
       progress means REMOVING weight. The engine special-cases this. */
    inverseLoad: true,
  },
  "chest-fly-pec-deck": {
    pattern: "chest_iso", loadType: "machine_stack", role: "isolation", fatigue: 2,
    contribution: { chest: 1, shoulders: 0.25 }, jointStress: ["shoulder"],
    startCoef: 0.20, unilateral: false,
  },
  "dumbbell-lateral-raise": {
    pattern: "lateral_raise", loadType: "dumbbell", role: "isolation", fatigue: 1,
    contribution: { shoulders: 1 }, jointStress: ["shoulder"],
    startCoef: 0.05, unilateral: true,
  },
  "cable-rope-face-pull": {
    pattern: "rear_delt", loadType: "cable_stack", role: "isolation", fatigue: 1,
    contribution: { shoulders: 0.75, back: 0.5 }, jointStress: ["shoulder"],
    startCoef: 0.14, unilateral: false,
  },
  "db-overhead-triceps-extension": {
    pattern: "triceps_iso", loadType: "dumbbell", role: "isolation", fatigue: 1,
    contribution: { arms: 1 }, jointStress: ["elbow", "shoulder"],
    startCoef: 0.12, unilateral: false,
  },
  "hack-squat-machine": {
    pattern: "squat", loadType: "plate_loaded", role: "compound", fatigue: 4,
    contribution: { legs: 1, glutes: 0.5 }, jointStress: ["knee", "hip", "lower_back"],
    startCoef: 0.45, unilateral: false,
  },
  "romanian-deadlift": {
    pattern: "hinge", loadType: "barbell", role: "compound", fatigue: 4,
    contribution: { legs: 1, glutes: 1, back: 0.5 }, jointStress: ["lower_back", "hip"],
    startCoef: 0.35, unilateral: false,
  },
  "walking-lunges": {
    pattern: "lunge", loadType: "dumbbell", role: "compound", fatigue: 3,
    contribution: { legs: 1, glutes: 0.75 }, jointStress: ["knee", "hip"],
    startCoef: 0.06, unilateral: true,
  },
  "glute-kickback": {
    pattern: "glute_iso", loadType: "cable_stack", role: "isolation", fatigue: 1,
    contribution: { glutes: 1 }, jointStress: ["hip", "lower_back"],
    startCoef: 0.10, unilateral: true,
  },
  "seated-calf-raise": {
    pattern: "calf", loadType: "plate_loaded", role: "isolation", fatigue: 1,
    contribution: { legs: 0.5 }, jointStress: ["ankle", "knee"],
    startCoef: 0.20, unilateral: false,
  },
  "plank": {
    pattern: "core_brace", loadType: "timed", role: "isolation", fatigue: 1,
    contribution: { core: 1 }, jointStress: [],
    startCoef: 0, unilateral: false,
  },

  /* Cardio finishers — no load progression, duration/intensity progression. */
  "incline-treadmill-walk": { pattern: "cardio", loadType: "cardio_time", role: "cardio", fatigue: 2, contribution: {}, jointStress: ["knee", "ankle"], impact: "low",  startCoef: 0 },
  "stationary-bike":        { pattern: "cardio", loadType: "cardio_time", role: "cardio", fatigue: 2, contribution: {}, jointStress: ["knee"],          impact: "very_low", startCoef: 0 },
  "elliptical":             { pattern: "cardio", loadType: "cardio_time", role: "cardio", fatigue: 2, contribution: {}, jointStress: [],               impact: "very_low", startCoef: 0 },
  "rowing-machine":         { pattern: "cardio", loadType: "cardio_time", role: "cardio", fatigue: 3, contribution: { back: 0.25 }, jointStress: ["lower_back", "knee"], impact: "low", startCoef: 0 },
  "stairmaster":            { pattern: "cardio", loadType: "cardio_time", role: "cardio", fatigue: 3, contribution: { legs: 0.25 }, jointStress: ["knee", "hip"], impact: "moderate", startCoef: 0 },
};

const EXPANSION_META = {
  "barbell-bench-press":     { pattern: "horizontal_push", loadType: "barbell",       role: "compound",  fatigue: 4, contribution: { chest: 1, shoulders: 0.5, arms: 0.5 }, jointStress: ["shoulder", "elbow"],            startCoef: 0.50, unilateral: false },
  "dumbbell-bench-press":    { pattern: "horizontal_push", loadType: "dumbbell",      role: "compound",  fatigue: 3, contribution: { chest: 1, shoulders: 0.5, arms: 0.5 }, jointStress: ["shoulder", "elbow"],            startCoef: 0.20, unilateral: true },
  "incline-dumbbell-press":  { pattern: "incline_push",    loadType: "dumbbell",      role: "compound",  fatigue: 3, contribution: { chest: 1, shoulders: 0.5, arms: 0.5 }, jointStress: ["shoulder", "elbow"],            startCoef: 0.17, unilateral: true },
  "push-up":                 { pattern: "horizontal_push", loadType: "bodyweight",    role: "compound",  fatigue: 2, contribution: { chest: 1, shoulders: 0.5, arms: 0.5, core: 0.25 }, jointStress: ["shoulder", "elbow"], startCoef: 0,    unilateral: false },
  "cable-crossover":         { pattern: "chest_iso",       loadType: "cable_stack",   role: "isolation", fatigue: 2, contribution: { chest: 1, shoulders: 0.25 },           jointStress: ["shoulder"],                     startCoef: 0.12, unilateral: true },
  "arnold-press":            { pattern: "vertical_push",   loadType: "dumbbell",      role: "compound",  fatigue: 3, contribution: { shoulders: 1, arms: 0.5, chest: 0.25 },jointStress: ["shoulder", "elbow"],            startCoef: 0.10, unilateral: true },
  "dips-triceps":            { pattern: "triceps_iso",     loadType: "bodyweight",    role: "compound",  fatigue: 3, contribution: { arms: 1, chest: 0.5, shoulders: 0.5 }, jointStress: ["shoulder", "elbow"],            startCoef: 0,    unilateral: false },
  "pull-up":                 { pattern: "vertical_pull",   loadType: "bodyweight",    role: "compound",  fatigue: 3, contribution: { back: 1, arms: 0.5, shoulders: 0.25 }, jointStress: ["shoulder", "elbow"],            startCoef: 0,    unilateral: false },
  "chin-up":                 { pattern: "vertical_pull",   loadType: "bodyweight",    role: "compound",  fatigue: 3, contribution: { back: 1, arms: 0.75, shoulders: 0.25 },jointStress: ["shoulder", "elbow"],            startCoef: 0,    unilateral: false },
  "straight-arm-pulldown":   { pattern: "rear_delt",        loadType: "cable_stack",   role: "isolation", fatigue: 2, contribution: { back: 1 },                             jointStress: ["shoulder"],                     startCoef: 0.16, unilateral: false },
  "bent-over-barbell-row":   { pattern: "horizontal_pull", loadType: "barbell",       role: "compound",  fatigue: 4, contribution: { back: 1, arms: 0.5, shoulders: 0.25 }, jointStress: ["lower_back", "shoulder", "elbow"], startCoef: 0.40, unilateral: false },
  "one-arm-db-row":          { pattern: "horizontal_pull", loadType: "dumbbell",      role: "compound",  fatigue: 3, contribution: { back: 1, arms: 0.5 },                  jointStress: ["shoulder", "elbow"],            startCoef: 0.22, unilateral: true },
  "t-bar-row":               { pattern: "horizontal_pull", loadType: "barbell",       role: "compound",  fatigue: 4, contribution: { back: 1, arms: 0.5, shoulders: 0.25 }, jointStress: ["lower_back", "shoulder"],       startCoef: 0.35, unilateral: false },
  "barbell-back-squat":      { pattern: "squat",           loadType: "barbell",       role: "compound",  fatigue: 5, contribution: { legs: 1, glutes: 0.75, core: 0.25 },   jointStress: ["knee", "hip", "lower_back"],    startCoef: 0.55, unilateral: false },
  "front-squat":             { pattern: "squat",           loadType: "barbell",       role: "compound",  fatigue: 5, contribution: { legs: 1, glutes: 0.5, core: 0.5 },     jointStress: ["knee", "hip"],                  startCoef: 0.40, unilateral: false },
  "barbell-deadlift":        { pattern: "hinge",           loadType: "barbell",       role: "compound",  fatigue: 5, contribution: { legs: 1, glutes: 1, back: 0.75 },      jointStress: ["lower_back", "hip", "knee"],    startCoef: 0.65, unilateral: false },
  "good-morning":            { pattern: "hinge",           loadType: "barbell",       role: "compound",  fatigue: 3, contribution: { legs: 1, glutes: 0.75, back: 0.5 },    jointStress: ["lower_back", "hip"],            startCoef: 0.22, unilateral: false },
  "barbell-hip-thrust":      { pattern: "glute_iso",       loadType: "barbell",       role: "compound",  fatigue: 3, contribution: { glutes: 1, legs: 0.5 },                jointStress: ["hip"],                          startCoef: 0.55, unilateral: false },
  "bulgarian-split-squat":   { pattern: "lunge",           loadType: "dumbbell",      role: "compound",  fatigue: 4, contribution: { legs: 1, glutes: 0.75 },               jointStress: ["knee", "hip"],                  startCoef: 0.10, unilateral: true },
  "preacher-curl":           { pattern: "biceps_iso",      loadType: "machine_stack", role: "isolation", fatigue: 1, contribution: { arms: 1 },                             jointStress: ["elbow"],                        startCoef: 0.16, unilateral: false },
  "concentration-curl":      { pattern: "biceps_iso",      loadType: "dumbbell",      role: "isolation", fatigue: 1, contribution: { arms: 1 },                             jointStress: ["elbow"],                        startCoef: 0.08, unilateral: true },
  "skull-crusher":           { pattern: "triceps_iso",     loadType: "barbell",       role: "isolation", fatigue: 2, contribution: { arms: 1 },                             jointStress: ["elbow"],                        startCoef: 0.18, unilateral: false },
  "bench-dips":              { pattern: "triceps_iso",     loadType: "bodyweight",    role: "isolation", fatigue: 2, contribution: { arms: 1, chest: 0.25 },                jointStress: ["shoulder", "elbow"],            startCoef: 0,    unilateral: false },
  "upright-row":             { pattern: "lateral_raise",   loadType: "machine_stack", role: "compound",  fatigue: 2, contribution: { shoulders: 1, back: 0.5, arms: 0.25 }, jointStress: ["shoulder", "elbow"],            startCoef: 0.22, unilateral: false },
  "cable-rear-delt-fly":     { pattern: "rear_delt",       loadType: "cable_stack",   role: "isolation", fatigue: 1, contribution: { shoulders: 0.75, back: 0.5 },          jointStress: ["shoulder"],                     startCoef: 0.10, unilateral: true },
  "ab-roller":               { pattern: "core_brace",      loadType: "bodyweight",    role: "isolation", fatigue: 3, contribution: { core: 1, shoulders: 0.25 },            jointStress: ["lower_back", "shoulder"],       startCoef: 0,    unilateral: false },
  "side-plank":              { pattern: "core_brace",      loadType: "timed",         role: "isolation", fatigue: 1, contribution: { core: 1 },                             jointStress: ["shoulder"],                     startCoef: 0,    unilateral: true },
};

const SUPPLEMENTARY_META = {
  "seated-db-shoulder-press":     { pattern: "vertical_push",   loadType: "dumbbell",      role: "compound",  fatigue: 3, contribution: { shoulders: 1, arms: 0.5, chest: 0.25 }, jointStress: ["shoulder", "elbow"], startCoef: 0.11, unilateral: true },
  "machine-chest-supported-row":  { pattern: "horizontal_pull", loadType: "machine_stack", role: "compound",  fatigue: 3, contribution: { back: 1, arms: 0.5, shoulders: 0.25 },  jointStress: ["shoulder", "elbow"], startCoef: 0.34, unilateral: false },
  "db-romanian-deadlift":         { pattern: "hinge",           loadType: "dumbbell",      role: "compound",  fatigue: 3, contribution: { legs: 1, glutes: 1, back: 0.25 },        jointStress: ["hip", "lower_back"], startCoef: 0.15, unilateral: true },
  "back-extension":               { pattern: "glute_iso",       loadType: "bodyweight",    role: "isolation", fatigue: 2, contribution: { glutes: 1, legs: 0.5, back: 0.5 },       jointStress: ["hip"],               startCoef: 0,    unilateral: false },
  "goblet-squat":                 { pattern: "squat",           loadType: "dumbbell",      role: "compound",  fatigue: 3, contribution: { legs: 1, glutes: 0.5, core: 0.25 },      jointStress: ["knee", "hip"],       startCoef: 0.18, unilateral: false },
  "hammer-curl":                  { pattern: "biceps_iso",      loadType: "dumbbell",      role: "isolation", fatigue: 1, contribution: { arms: 1 },                               jointStress: ["elbow"],             startCoef: 0.09, unilateral: true },
  "cable-lateral-raise":          { pattern: "lateral_raise",   loadType: "cable_stack",   role: "isolation", fatigue: 1, contribution: { shoulders: 1 },                          jointStress: ["shoulder"],          startCoef: 0.06, unilateral: true },
  "hanging-knee-raise":           { pattern: "core_flexion",    loadType: "bodyweight",    role: "isolation", fatigue: 2, contribution: { core: 1 },                               jointStress: ["shoulder"],          startCoef: 0,    unilateral: false },
  "reverse-pec-deck":             { pattern: "rear_delt",       loadType: "machine_stack", role: "isolation", fatigue: 1, contribution: { shoulders: 0.75, back: 0.5 },            jointStress: ["shoulder"],          startCoef: 0.16, unilateral: false },
  "seated-db-shrug":              { pattern: "horizontal_pull", loadType: "dumbbell",      role: "isolation", fatigue: 1, contribution: { back: 0.75 },                            jointStress: [],                    startCoef: 0.16, unilateral: true },
};

/* ---------- Merge metadata onto the library ---------- */
EXERCISES.push(...SUPPLEMENTARY_EXERCISES, ...EXPANSION_EXERCISES);
Object.assign(EX_META, SUPPLEMENTARY_META, EXPANSION_META);

EXERCISES.forEach(ex => {
  const meta = EX_META[ex.id] || {};
  Object.assign(ex, meta);
  if (ex.hasMedia === undefined) ex.hasMedia = true;
  ex.loadSpec = LOAD_TYPES[ex.loadType] || LOAD_TYPES.machine_stack;
  /* Parse "4 x 10–12" / "3 x 30–45 sec" / "2 x 15 each" into machine-readable
     defaults so the generator does not have to re-derive them every render. */
  const parsed = parsePrescriptionText(ex.sets);
  ex.defaultSets = parsed.sets;
  ex.defaultRepLo = parsed.repLo;
  ex.defaultRepHi = parsed.repHi;
  ex.restSec = ex.role === "compound" ? 105 : 75;
});

function parsePrescriptionText(text) {
  const out = { sets: 3, repLo: 10, repHi: 12 };
  if (!text) return out;
  const setsMatch = text.match(/^\s*(\d+)\s*[x×]/i);
  if (setsMatch) out.sets = Number(setsMatch[1]);
  const rangeMatch = text.match(/[x×]\s*(\d+)\s*[–\-]\s*(\d+)/);
  const singleMatch = text.match(/[x×]\s*(\d+)/);
  if (rangeMatch) { out.repLo = Number(rangeMatch[1]); out.repHi = Number(rangeMatch[2]); }
  else if (singleMatch) { out.repLo = Number(singleMatch[1]); out.repHi = Number(singleMatch[1]); }
  return out;
}

/* ---------- Weekly volume landmarks (hard sets per muscle per week) ----------
   MV  = maintenance volume, the floor that holds what you have
   MEV = minimum effective volume, the floor for growth
   MAV = adaptive volume, the productive middle
   MRV = maximum recoverable volume, the ceiling before recovery debt
   These are the widely used hypertrophy-literature ranges (Israetel et al.),
   rounded and applied per muscle group. The coach uses them to flag a muscle
   that is under-stimulated or being buried, and to size volume ramps. */
const VOLUME_LANDMARKS = {
  chest:     { mv: 4, mev: 8,  mav: 16, mrv: 22 },
  back:      { mv: 6, mev: 10, mav: 18, mrv: 25 },
  shoulders: { mv: 4, mev: 8,  mav: 16, mrv: 24 },
  arms:      { mv: 4, mev: 8,  mav: 16, mrv: 24 },
  legs:      { mv: 4, mev: 8,  mav: 16, mrv: 22 },
  glutes:    { mv: 0, mev: 4,  mav: 12, mrv: 18 },
  core:      { mv: 0, mev: 4,  mav: 10, mrv: 16 },
};

/* ---------- Goal profiles ----------
   Rep ranges, rest, cardio dose and the rate of load progression all change
   with the goal. This is the single place those differences live. */
const GOAL_PROFILES = {
  "Fat loss": {
    id: "fat_loss",
    repRange: { compound: [8, 12], isolation: [12, 15] },
    restScale: 0.9,
    cardioMinutes: { training: 15, rest: 25 },
    cardioIntensityKey: "moderate",
    progressionRate: 0.6,   // smaller jumps: in a deficit, strength climbs slower
    volumeTarget: "mav",
    noteKey: "fat_loss",
  },
  "Muscle gain": {
    id: "hypertrophy",
    repRange: { compound: [6, 10], isolation: [10, 15] },
    restScale: 1.15,
    cardioMinutes: { training: 10, rest: 20 },
    cardioIntensityKey: "easy",
    progressionRate: 1.0,
    volumeTarget: "mav",
    noteKey: "hypertrophy",
  },
  "Strength": {
    id: "strength",
    repRange: { compound: [4, 6], isolation: [8, 12] },
    restScale: 1.4,
    cardioMinutes: { training: 8, rest: 20 },
    cardioIntensityKey: "easy",
    progressionRate: 1.2,
    volumeTarget: "mev",
    noteKey: "strength",
  },
  "General fitness": {
    id: "general",
    repRange: { compound: [8, 12], isolation: [10, 15] },
    restScale: 1.0,
    cardioMinutes: { training: 12, rest: 25 },
    cardioIntensityKey: "moderate",
    progressionRate: 0.8,
    volumeTarget: "mav",
    noteKey: "general",
  },
};

/* ---------- Experience calibration ----------
   Scales the seed weight, how fast the coach is willing to add load, and how
   deep into fatigue it will let you train. */
const LEVEL_PROFILES = {
  "New to training":  { id: "beginner",     strengthScale: 0.75, progressionMultiplier: 1.35, rpeCap: 8.0, maxSetsPerSession: 18 },
  "Some experience":  { id: "intermediate", strengthScale: 1.00, progressionMultiplier: 1.00, rpeCap: 8.5, maxSetsPerSession: 22 },
  "Experienced":      { id: "advanced",     strengthScale: 1.25, progressionMultiplier: 0.75, rpeCap: 9.5, maxSetsPerSession: 26 },
};

/* ============================================================================
   How much technique a movement asks for
   ----------------------------------------------------------------------------
   Not difficulty, and not a ranking of how good an exercise is — a fixed-path
   machine and a barbell squat can train the same muscle equally well. What
   this scores is how much of the result depends on doing it right:

     1 — fixed path, or trivially learnable. Machines, cables, most isolation.
     2 — free weight with real balance and set-up, but forgiving when it goes
         wrong. Dumbbell presses, goblet squats, chin-ups.
     3 — loaded spine, and a technique that fails badly rather than gently.
         Barbell squats, hinges, standing presses.

   A beginner training alone is better served by two months of tier 1 and 2
   before the plan starts handing them tier 3, and an experienced lifter is
   badly served by a program made entirely of machines. Only the exceptions are
   listed; everything else falls out of the equipment and the role.
   ============================================================================ */

const EX_SKILL = {
  "barbell-back-squat": 3, "front-squat": 3, "barbell-deadlift": 3,
  "romanian-deadlift": 3, "good-morning": 3, "bent-over-barbell-row": 3,
  "t-bar-row": 2,                    // chest-supported or braced, far kinder on the back
  "barbell-hip-thrust": 2,           // heavy, but the spine is not the limiter
  "smith-machine-incline-press": 1,  // fixed path — a machine with a bar on it
  "barbell-bench-press": 2,          // forgiving with a spotter or safety pins
  "pull-up": 2, "chin-up": 2, "dips-triceps": 2,
  "bulgarian-split-squat": 2, "walking-lunges": 2,
  "ab-roller": 2,                    // easy to do, easy to do to your lower back
};

/** Technique demand for one exercise, 1–3. See EX_SKILL above. */
function exerciseSkill(ex) {
  if (!ex) return 1;
  if (EX_SKILL[ex.id]) return EX_SKILL[ex.id];
  if (ex.loadType === "barbell") return ex.role === "compound" ? 3 : 2;
  if (ex.loadType === "dumbbell" || ex.loadType === "bodyweight") return ex.role === "compound" ? 2 : 1;
  return 1;
}

/* ---------- Helpers ---------- */
function metaFor(id) { return EX_META[id] || {}; }
function hasLocalMedia(id) { const ex = exerciseById(id); return !ex || ex.hasMedia !== false; }
function strengthExercises() { return EXERCISES.filter(e => e.muscle !== "cardio"); }
function cardioExercises() { return EXERCISES.filter(e => e.muscle === "cardio"); }
function exercisesByPattern(pattern) { return EXERCISES.filter(e => e.pattern === pattern); }
