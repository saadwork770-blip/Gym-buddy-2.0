/* ============================================================================
   GymBuddy 2.0 — data/nutrition.js
   ----------------------------------------------------------------------------
   The constants behind the diet section. Same rule as everywhere else in this
   app: every number traces back to a stated formula or a cited guideline,
   not a black box. Nothing here is medical advice — it is the same kind of
   general population estimate a gym trainer or a nutrition app gives, built
   from equations that are decades old and still the standard because nothing
   simple has beaten them.

   The formulas:
     · BMR — Mifflin-St Jeor (1990), the equation the Academy of Nutrition and
       Dietetics recommends over the older Harris-Benedict formula for most
       adults; it is what MET_ACTIVITY multiplies into an activity estimate.
     · Protein — 1.6–2.2 g/kg for people who resistance train, from the
       International Society of Sports Nutrition's 2017 position stand; the
       high end for a calorie deficit, where more protein measurably protects
       lean mass (Helms et al., 2014).
     · Fat — a flat 25% of calories, inside the 20–35% range most guidelines
       treat as adequate for hormone production without crowding out carbs.
     · Carbs — whatever calories are left once protein and fat are set.
   ============================================================================ */

/* Mifflin-St Jeor: BMR = 10·kg + 6.25·cm − 5·age + s
   s is +5 for men and −161 for women; the female constant already reflects a
   lower average lean-mass fraction at the same weight and height, which is
   what actually drives the difference in resting energy use. A profile that
   prefers not to say sex is given the midpoint rather than forced to pick —
   it is off by a similar amount in both directions, which is the least wrong
   a single number can be. */
const BMR_SEX_CONSTANT = {
  Male: 5,
  Female: -161,
  "Prefer not to say": -78,
};

/* Physical Activity Level multipliers (Mifflin-St Jeor's own companion
   scale, the same one most TDEE calculators use). Keyed off how many days a
   week the plan actually trains — the app already knows this, so the diet
   section reads it from the same plan rather than asking a second survey
   question a profile might answer differently than it trains. */
const ACTIVITY_LEVEL = [
  { maxDays: 1, multiplier: 1.2,  labelKey: "sedentary" },
  { maxDays: 3, multiplier: 1.375, labelKey: "light" },
  { maxDays: 5, multiplier: 1.55, labelKey: "moderate" },
  { maxDays: 6, multiplier: 1.725, labelKey: "active" },
  { maxDays: Infinity, multiplier: 1.9, labelKey: "veryActive" },
];

/* How far off maintenance the target sits, and how much protein per
   kilogram of bodyweight backs it — both goal-dependent, same GOAL_PROFILES
   ids used everywhere else in the app. A surplus for muscle gain is kept
   deliberately small: the literature on lean bulking (Garthe et al., 2013;
   Slater & Phillips, 2011) finds a big surplus buys mostly fat, not more
   muscle, once training and protein are already in place. */
const CALORIE_ADJUST = {
  fat_loss:   { deltaPct: -0.20, proteinPerKg: 2.2 },
  hypertrophy:{ deltaPct: 0.10,  proteinPerKg: 1.8 },
  strength:   { deltaPct: 0.05,  proteinPerKg: 1.8 },
  general:    { deltaPct: 0,     proteinPerKg: 1.6 },
};

const FAT_PCT_OF_CALORIES = 0.25;

/* A floor under any deficit. Guidelines (e.g. the UK NHS, and the general
   clinical consensus behind most fat-loss programs) treat sustained intake
   below this as needing supervision rather than an app — so the engine stops
   the deficit here and says why, instead of quietly recommending it. */
const CALORIE_FLOOR = { Male: 1500, Female: 1200, "Prefer not to say": 1350 };

const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 };

/* ---------- Food suggestions ----------
   A modest set of dishes common on a Gulf table — the same regional anchor
   the exercise library's Arabic already uses for gym-floor terms — each with
   a realistic per-serving macro estimate (USDA FoodData Central where the
   dish maps to a plain ingredient; otherwise a typical restaurant/home
   portion). Tagged by which meal it usually sits in and which macro it leads
   with, so the diet page can pick combinations that lean toward whatever the
   day's target is short of, rather than a fixed menu everyone gets.

   Every food's Arabic name mirrors the same gym-floor convention already
   used in the exercise library: written the way it is actually ordered. */
const FOODS = [
  // ---- protein-forward ----
  { id: "grilled-chicken-breast", meals: ["lunch", "dinner"], lead: "protein",
    serving: "150g grilled", kcal: 248, protein: 46, carb: 0, fat: 5 },
  { id: "grilled-fish-hammour", meals: ["lunch", "dinner"], lead: "protein",
    serving: "150g grilled hammour", kcal: 195, protein: 36, carb: 0, fat: 5 },
  { id: "shawarma-chicken-plate", meals: ["lunch", "dinner"], lead: "protein",
    serving: "1 plate, no bread, light sauce", kcal: 380, protein: 42, carb: 12, fat: 18 },
  { id: "grilled-shrimp", meals: ["lunch", "dinner"], lead: "protein",
    serving: "150g grilled", kcal: 170, protein: 32, carb: 2, fat: 3 },
  { id: "boiled-eggs", meals: ["breakfast", "snack"], lead: "protein",
    serving: "3 whole eggs", kcal: 234, protein: 19, carb: 1, fat: 16 },
  { id: "labneh-bowl", meals: ["breakfast", "snack"], lead: "protein",
    serving: "150g labneh", kcal: 173, protein: 8, carb: 6, fat: 13 },
  { id: "greek-yogurt", meals: ["breakfast", "snack"], lead: "protein",
    serving: "200g plain, low-fat", kcal: 146, protein: 20, carb: 12, fat: 2 },
  { id: "lentil-soup", meals: ["lunch", "dinner"], lead: "protein",
    serving: "1 bowl, ~300ml", kcal: 180, protein: 12, carb: 27, fat: 3 },
  { id: "grilled-kofta", meals: ["lunch", "dinner"], lead: "protein",
    serving: "3 skewers, ~150g", kcal: 300, protein: 26, carb: 2, fat: 21 },
  { id: "cottage-cheese", meals: ["breakfast", "snack"], lead: "protein",
    serving: "150g", kcal: 130, protein: 17, carb: 5, fat: 4 },

  // ---- carb-forward ----
  { id: "white-rice", meals: ["lunch", "dinner"], lead: "carb",
    serving: "1 cup cooked, ~200g", kcal: 260, protein: 5, carb: 57, fat: 0.5 },
  { id: "brown-rice", meals: ["lunch", "dinner"], lead: "carb",
    serving: "1 cup cooked, ~200g", kcal: 216, protein: 5, carb: 45, fat: 1.8 },
  { id: "khubz-arabi", meals: ["breakfast", "lunch", "dinner"], lead: "carb",
    serving: "1 loaf, ~65g", kcal: 175, protein: 6, carb: 35, fat: 1 },
  { id: "oats-bowl", meals: ["breakfast"], lead: "carb",
    serving: "60g dry, cooked", kcal: 225, protein: 8, carb: 39, fat: 4 },
  { id: "dates", meals: ["breakfast", "snack"], lead: "carb",
    serving: "5 pieces", kcal: 115, protein: 1, carb: 31, fat: 0 },
  { id: "banana", meals: ["breakfast", "snack"], lead: "carb",
    serving: "1 medium", kcal: 105, protein: 1, carb: 27, fat: 0.4 },
  { id: "sweet-potato", meals: ["lunch", "dinner"], lead: "carb",
    serving: "200g baked", kcal: 180, protein: 4, carb: 41, fat: 0.2 },
  { id: "freekeh", meals: ["lunch", "dinner"], lead: "carb",
    serving: "1 cup cooked, ~180g", kcal: 227, protein: 8, carb: 44, fat: 2 },

  // ---- balanced / mixed ----
  { id: "fattoush-salad", meals: ["lunch", "dinner"], lead: "balanced",
    serving: "1 bowl with olive oil dressing", kcal: 180, protein: 3, carb: 18, fat: 11 },
  { id: "tabbouleh", meals: ["lunch", "dinner"], lead: "balanced",
    serving: "1 cup", kcal: 198, protein: 4, carb: 20, fat: 12 },
  { id: "hummus-bowl", meals: ["lunch", "snack"], lead: "balanced",
    serving: "150g with a little olive oil", kcal: 250, protein: 9, carb: 22, fat: 14 },
  { id: "mixed-nuts", meals: ["snack"], lead: "balanced",
    serving: "30g", kcal: 175, protein: 6, carb: 6, fat: 15 },
  { id: "avocado-half", meals: ["breakfast", "snack"], lead: "balanced",
    serving: "1/2 avocado", kcal: 120, protein: 1.5, carb: 6, fat: 11 },
  { id: "grilled-vegetables", meals: ["lunch", "dinner"], lead: "balanced",
    serving: "1 plate, ~250g", kcal: 130, protein: 3, carb: 15, fat: 7 },
  { id: "olive-oil-drizzle", meals: ["lunch", "dinner"], lead: "balanced",
    serving: "1 tbsp", kcal: 119, protein: 0, carb: 0, fat: 14 },
];

/* Roughly how the day's calories are usually spread across meals when there
   are four: a light breakfast, the two anchor meals, and a snack to close
   the gap. Adjusted proportionally if the profile logs fewer meal slots. */
const MEAL_SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.30, snack: 0.10 };
