/* ============================================================
   GymBuddy — data.js
   Source of truth for all exercise + program content.
   All facts (sets, reps, exercise selection, guidelines, notes)
   are taken directly from the uploaded training plan:
   "4-Day Fat Loss Program — Fitness Time (Standard Commercial Gym)".
   The illustrations below are original line-art diagrams drawn for
   this site (not photographs) so the whole page works fully offline
   with zero external image requests.
   ============================================================ */

const MUSCLE_COLORS = {
  chest:     "#ff6b6b",
  back:      "#4dabf7",
  shoulders: "#9775fa",
  arms:      "#ffa94d",
  legs:      "#51cf66",
  glutes:    "#f783ac",
  core:      "#ffd43b",
  cardio:    "#22d3ee",
};

const MUSCLE_LABELS = {
  chest: "Chest", back: "Back", shoulders: "Shoulders", arms: "Arms",
  legs: "Legs", glutes: "Glutes", core: "Core", cardio: "Cardio",
};

/* ---------- Reusable line-art icon set (currentColor strokes) ---------- */
const ICONS = {
  machine: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="6" y="40" width="18" height="8" rx="2"/>
    <rect x="10" y="20" width="8" height="22" rx="2"/>
    <path d="M18 26 L38 30"/>
    <circle cx="40" cy="30" r="2.5" fill="currentColor" stroke="none"/>
    <rect x="46" y="14" width="12" height="34" rx="1.5"/>
    <line x1="46" y1="21" x2="58" y2="21"/>
    <line x1="46" y1="27" x2="58" y2="27"/>
    <line x1="46" y1="33" x2="58" y2="33"/>
    <line x1="46" y1="39" x2="58" y2="39"/>
    <circle cx="52" cy="10" r="2.5"/>
  </svg>`,

  cable: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="14" y1="6" x2="14" y2="58"/>
    <circle cx="14" cy="10" r="3.5"/>
    <path d="M14 13 C14 26, 30 24, 30 38"/>
    <path d="M25 35 L30 38 L35 35" />
    <rect x="6" y="44" width="12" height="18" rx="1.5"/>
    <line x1="6" y1="49" x2="18" y2="49"/>
    <line x1="6" y1="54" x2="18" y2="54"/>
    <line x1="6" y1="59" x2="18" y2="59"/>
  </svg>`,

  dumbbell: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="20" y1="32" x2="44" y2="32"/>
    <rect x="10" y="22" width="8" height="20" rx="2"/>
    <rect x="4" y="26" width="6" height="12" rx="1.5"/>
    <rect x="46" y="22" width="8" height="20" rx="2"/>
    <rect x="54" y="26" width="6" height="12" rx="1.5"/>
  </svg>`,

  bodyweight: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="14" cy="16" r="5"/>
    <line x1="18" y1="20" x2="46" y2="34"/>
    <line x1="24" y1="24" x2="16" y2="14"/>
    <line x1="26" y1="26" x2="34" y2="16"/>
    <line x1="40" y1="31" x2="52" y2="24"/>
    <line x1="40" y1="31" x2="50" y2="42"/>
    <line x1="46" y1="34" x2="58" y2="46"/>
  </svg>`,

  treadmill: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="6" y="36" width="40" height="10" rx="5"/>
    <circle cx="12" cy="41" r="2" fill="currentColor" stroke="none"/>
    <circle cx="40" cy="41" r="2" fill="currentColor" stroke="none"/>
    <line x1="44" y1="36" x2="52" y2="14"/>
    <line x1="52" y1="14" x2="58" y2="14"/>
    <line x1="52" y1="14" x2="52" y2="22"/>
    <line x1="44" y1="46" x2="30" y2="58"/>
  </svg>`,

  bike: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="22" cy="44" r="12"/>
    <circle cx="22" cy="44" r="2" fill="currentColor" stroke="none"/>
    <path d="M22 44 L38 44 L46 20"/>
    <line x1="38" y1="44" x2="30" y2="26"/>
    <line x1="30" y1="26" x2="42" y2="26"/>
    <path d="M46 20 L52 20"/>
    <rect x="28" y="18" width="6" height="6" rx="1"/>
  </svg>`,

  elliptical: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 46 C 20 54, 44 54, 56 46" />
    <line x1="16" y1="46" x2="34" y2="20"/>
    <line x1="46" y1="46" x2="28" y2="24"/>
    <line x1="34" y1="20" x2="34" y2="10"/>
    <circle cx="34" cy="8" r="2" fill="currentColor" stroke="none"/>
    <line x1="20" y1="30" x2="30" y2="14"/>
  </svg>`,

  rower: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="6" y1="48" x2="52" y2="30"/>
    <rect x="20" y="38" width="10" height="6" rx="1.5" transform="rotate(-20 20 38)"/>
    <circle cx="52" cy="24" r="8"/>
    <line x1="30" y1="34" x2="46" y2="24"/>
    <line x1="6" y1="48" x2="12" y2="56"/>
  </svg>`,

  stairmaster: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="14" y1="10" x2="14" y2="50"/>
    <line x1="50" y1="10" x2="50" y2="50"/>
    <rect x="8" y="34" width="20" height="6" rx="1.5"/>
    <rect x="36" y="20" width="20" height="6" rx="1.5"/>
    <line x1="14" y1="10" x2="20" y2="10"/>
    <line x1="50" y1="10" x2="44" y2="10"/>
  </svg>`,
};

/* ---------- Exercise library (24 strength + 5 cardio, from the plan) ---------- */
const EXERCISES = [
  // ===== DAY 1 — Upper Body A =====
  {
    id: "chest-press-machine", name: "Chest Press Machine", day: 1, dayLabel: "Upper Body A",
    equipment: "Machine", muscle: "chest", icon: "machine", sets: "4 x 10–12",
    steps: [
      "Adjust the seat so the handles line up with mid-chest height.",
      "Sit back with shoulder blades pulled down and back against the pad.",
      "Grip the handles and press forward until your arms are extended without locking the elbows.",
      "Pause briefly, then return under control to the start position.",
      "Keep the movement controlled — no jerking or bouncing off the stack."
    ],
    tips: [
      "Rest 90–120 sec between sets (compound lift).",
      "Add weight or 1–2 reps once you hit the top of the rep range with good form on all sets."
    ]
  },
  {
    id: "lat-pulldown-wide", name: "Lat Pulldown (Wide Grip)", day: 1, dayLabel: "Upper Body A",
    equipment: "Cable", muscle: "back", icon: "cable", sets: "4 x 10–12",
    steps: [
      "Set the knee pad snug against your thighs and grip the bar wider than shoulder width.",
      "Sit tall, lean back slightly, and pull the bar down to upper chest level.",
      "Drive your elbows down and back, squeezing your shoulder blades together.",
      "Control the bar back up to a full stretch without letting the stack slam.",
    ],
    tips: [
      "Rest 90–120 sec between sets (compound lift).",
      "Focus on pulling with your back, not your arms."
    ]
  },
  {
    id: "seated-cable-row", name: "Seated Cable Row", day: 1, dayLabel: "Upper Body A",
    equipment: "Cable", muscle: "back", icon: "cable", sets: "3 x 12",
    steps: [
      "Sit with knees slightly bent, feet braced on the platform, and grab the handle.",
      "Start with arms extended and a tall, neutral spine.",
      "Pull the handle to your torso, driving elbows back and squeezing shoulder blades together.",
      "Return slowly to the stretched position without rounding your lower back."
    ],
    tips: ["Rest 60–90 sec between sets (isolation-style row)."]
  },
  {
    id: "shoulder-press-machine", name: "Shoulder Press Machine", day: 1, dayLabel: "Upper Body A",
    equipment: "Machine", muscle: "shoulders", icon: "machine", sets: "3 x 10–12",
    steps: [
      "Set the seat height so the handles start level with your shoulders.",
      "Press the handles straight overhead until arms are extended without locking out hard.",
      "Lower under control back to the starting position at shoulder level.",
      "Keep your back flat against the pad throughout — avoid arching."
    ],
    tips: ["Rest 90–120 sec between sets (compound lift)."]
  },
  {
    id: "cable-triceps-pushdown", name: "Cable Triceps Pushdown", day: 1, dayLabel: "Upper Body A",
    equipment: "Cable", muscle: "arms", icon: "cable", sets: "3 x 12–15",
    steps: [
      "Attach a bar or rope to the high pulley and grip with elbows tucked at your sides.",
      "Keeping upper arms still, extend your elbows to push the attachment down.",
      "Squeeze your triceps at the bottom, then return slowly to the start.",
      "Don't let your elbows drift forward or flare out."
    ],
    tips: ["Rest 60–90 sec between sets (isolation move)."]
  },
  {
    id: "seated-db-bicep-curl", name: "Seated Dumbbell Bicep Curl", day: 1, dayLabel: "Upper Body A",
    equipment: "Dumbbell", muscle: "arms", icon: "dumbbell", sets: "3 x 12–15",
    steps: [
      "Sit on a bench with a dumbbell in each hand, arms hanging at your sides, palms forward.",
      "Curl the weights up toward your shoulders, keeping your elbows pinned to your torso.",
      "Squeeze at the top without swinging the weight up.",
      "Lower with control back to a full arm extension."
    ],
    tips: ["Rest 60–90 sec between sets (isolation move).", "Controlled tempo — joint control matters more than speed."]
  },

  // ===== DAY 2 — Lower Body A =====
  {
    id: "leg-press", name: "Leg Press", day: 2, dayLabel: "Lower Body A",
    equipment: "Machine", muscle: "legs", icon: "machine", sets: "4 x 12",
    steps: [
      "Sit in the machine with feet shoulder-width on the platform, mid-foot centered.",
      "Release the safety and lower the platform until knees reach roughly 90°.",
      "Press through your heels to extend your legs without locking your knees.",
      "Control the descent back down — no bouncing the weight at the bottom."
    ],
    tips: ["Rest 90–120 sec between sets (compound lift)."]
  },
  {
    id: "seated-leg-curl", name: "Seated Leg Curl", day: 2, dayLabel: "Lower Body A",
    equipment: "Machine", muscle: "legs", icon: "machine", sets: "3 x 12",
    steps: [
      "Adjust the machine so the back pad of the roller sits just above your heels.",
      "Sit with knees aligned to the machine's pivot point and legs extended.",
      "Curl your heels down and under, contracting your hamstrings fully.",
      "Return slowly to the start without letting the stack slam."
    ],
    tips: ["Rest 60–90 sec between sets (isolation move)."]
  },
  {
    id: "leg-extension", name: "Leg Extension", day: 2, dayLabel: "Lower Body A",
    equipment: "Machine", muscle: "legs", icon: "machine", sets: "3 x 12–15",
    steps: [
      "Sit with the back pad set so your knees line up with the machine's pivot.",
      "Hook your ankles behind the lower roller pad.",
      "Extend your knees to lift the pad until legs are straight, without hyperextending.",
      "Lower under control back to the starting position."
    ],
    tips: ["Rest 60–90 sec between sets (isolation move)."]
  },
  {
    id: "hip-adduction-abduction", name: "Hip Adduction/Abduction Machine", day: 2, dayLabel: "Lower Body A",
    equipment: "Machine", muscle: "legs", icon: "machine", sets: "2 x 15 each",
    steps: [
      "Set the machine to the adduction (inner-thigh) or abduction (outer-thigh) mode as needed.",
      "Sit with the pads against the outside (abduction) or inside (adduction) of your knees.",
      "Push the pads outward (abduction) or squeeze them inward (adduction) through a full range.",
      "Return slowly to the start under control."
    ],
    tips: ["Rest 60–90 sec between sets (isolation move)."]
  },
  {
    id: "standing-calf-raise-machine", name: "Standing Calf Raise Machine", day: 2, dayLabel: "Lower Body A",
    equipment: "Machine", muscle: "legs", icon: "machine", sets: "3 x 15",
    steps: [
      "Position your shoulders under the pads with the balls of your feet on the platform.",
      "Let your heels drop below the platform for a full stretch.",
      "Rise onto your toes as high as possible, squeezing your calves at the top.",
      "Lower slowly back to the stretched position."
    ],
    tips: ["Rest 60–90 sec between sets (isolation move)."]
  },
  {
    id: "cable-crunch-ab-machine", name: "Cable Crunch or Ab Machine", day: 2, dayLabel: "Lower Body A",
    equipment: "Cable", muscle: "core", icon: "cable", sets: "3 x 15",
    steps: [
      "Kneel below a high cable with a rope attachment held at either side of your head (or sit in an ab machine and grip the handles).",
      "Brace your core and curl your torso down, bringing your elbows toward your knees.",
      "Focus on flexing the spine through your abs, not pulling with your arms.",
      "Return slowly to the start under control."
    ],
    tips: ["Rest 60–90 sec between sets (isolation move)."]
  },

  // ===== DAY 4 — Upper Body B =====
  {
    id: "smith-machine-incline-press", name: "Smith Machine Incline Press", day: 4, dayLabel: "Upper Body B",
    equipment: "Machine", muscle: "chest", icon: "machine", sets: "4 x 10",
    steps: [
      "Set an incline bench (around 30–45°) under the Smith machine bar.",
      "Unrack the bar with hands slightly wider than shoulder width.",
      "Lower the bar under control to the upper chest.",
      "Press back up to full extension without locking the elbows hard."
    ],
    tips: ["Rest 90–120 sec between sets (compound lift)."]
  },
  {
    id: "assisted-pull-up-machine", name: "Assisted Pull-Up Machine (or Lat Pulldown, close grip)", day: 4, dayLabel: "Upper Body B",
    equipment: "Machine", muscle: "back", icon: "machine", sets: "4 x 10",
    steps: [
      "Kneel on the platform and set an assistance level that lets you complete the target reps with control.",
      "Grip the handles with a close, neutral or shoulder-width grip.",
      "Pull your chest up toward the handles, driving elbows down and back.",
      "Lower with control to a full arm extension.",
      "Alternative: use the Lat Pulldown with a close grip if the assisted machine is unavailable."
    ],
    tips: ["Rest 90–120 sec between sets (compound lift)."]
  },
  {
    id: "chest-fly-pec-deck", name: "Chest Fly (Pec Deck)", day: 4, dayLabel: "Upper Body B",
    equipment: "Machine", muscle: "chest", icon: "machine", sets: "3 x 12–15",
    steps: [
      "Set the seat so the handles align with mid-chest height.",
      "Place forearms/hands on the pads with a slight bend in the elbows.",
      "Bring the pads together in front of your chest, squeezing your pecs.",
      "Return slowly to a comfortable stretch without letting the weight slam."
    ],
    tips: ["Rest 60–90 sec between sets (isolation move)."]
  },
  {
    id: "dumbbell-lateral-raise", name: "Dumbbell Lateral Raise", day: 4, dayLabel: "Upper Body B",
    equipment: "Dumbbell", muscle: "shoulders", icon: "dumbbell", sets: "3 x 12–15",
    steps: [
      "Stand holding a light-to-moderate dumbbell in each hand at your sides.",
      "With a slight bend in the elbows, raise both arms out to the sides to about shoulder height.",
      "Lead with your elbows, not your hands, and avoid shrugging your traps.",
      "Lower with control back to your sides."
    ],
    tips: ["Rest 60–90 sec between sets (isolation move)."]
  },
  {
    id: "cable-rope-face-pull", name: "Cable Rope Face Pull", day: 4, dayLabel: "Upper Body B",
    equipment: "Cable", muscle: "shoulders", icon: "cable", sets: "3 x 15",
    steps: [
      "Set a rope attachment at upper chest to head height on the cable machine.",
      "Grip the rope with both hands, palms facing in, and step back for tension.",
      "Pull the rope toward your face, flaring elbows out and squeezing shoulder blades together.",
      "Return slowly to the start under control."
    ],
    tips: ["Rest 60–90 sec between sets (isolation move)."]
  },
  {
    id: "db-overhead-triceps-extension", name: "Dumbbell Overhead Triceps Extension", day: 4, dayLabel: "Upper Body B",
    equipment: "Dumbbell", muscle: "arms", icon: "dumbbell", sets: "3 x 12",
    steps: [
      "Sit or stand holding one dumbbell with both hands overhead, arms extended.",
      "Keeping your upper arms still and close to your head, bend the elbows to lower the weight behind your head.",
      "Extend your elbows to press the weight back to the starting position.",
      "Keep your core braced to avoid arching your lower back."
    ],
    tips: ["Rest 60–90 sec between sets (isolation move)."]
  },

  // ===== DAY 5 — Lower Body B =====
  {
    id: "hack-squat-machine", name: "Hack Squat Machine", day: 5, dayLabel: "Lower Body B",
    equipment: "Machine", muscle: "legs", icon: "machine", sets: "4 x 10–12",
    steps: [
      "Position yourself under the shoulder pads with feet shoulder-width on the platform.",
      "Release the safety catches and lower under control until knees reach roughly 90°.",
      "Press through your heels and mid-foot to extend your legs back up.",
      "Avoid locking the knees hard at the top."
    ],
    tips: ["Rest 90–120 sec between sets (compound lift)."]
  },
  {
    id: "romanian-deadlift", name: "Romanian Deadlift (Dumbbell or Barbell)", day: 5, dayLabel: "Lower Body B",
    equipment: "Free Weight", muscle: "legs", icon: "dumbbell", sets: "3 x 10",
    steps: [
      "Hold a barbell or a dumbbell in each hand in front of your thighs, feet hip-width apart.",
      "With a soft bend in the knees, hinge at the hips and push your hips back, lowering the weight along your legs.",
      "Keep your back flat and the weight close to your body until you feel a stretch in your hamstrings.",
      "Drive your hips forward to return to standing, squeezing your glutes at the top."
    ],
    tips: ["Use light-moderate weight while building technique.", "Rest 90–120 sec between sets (compound lift)."]
  },
  {
    id: "walking-lunges", name: "Walking Lunges", day: 5, dayLabel: "Lower Body B",
    equipment: "Bodyweight", muscle: "legs", icon: "bodyweight", sets: "3 x 10 each leg",
    steps: [
      "Stand tall, optionally holding a light dumbbell in each hand.",
      "Step forward into a lunge, lowering your back knee toward the floor.",
      "Push through your front heel to stand up and step the back foot forward into the next lunge.",
      "Keep your torso upright and core braced throughout."
    ],
    tips: ["Bodyweight or light dumbbells to start.", "Rest 90–120 sec between sets (compound-style movement)."]
  },
  {
    id: "glute-kickback", name: "Glute Kickback Machine or Cable", day: 5, dayLabel: "Lower Body B",
    equipment: "Cable", muscle: "glutes", icon: "cable", sets: "3 x 12 each",
    steps: [
      "Attach an ankle cuff to a low cable, or use a glute kickback machine, and secure it around your ankle.",
      "Hinge slightly forward and hold onto the machine frame for balance.",
      "Kick your leg straight back and up, squeezing your glute at the top.",
      "Return with control to the starting position without letting the weight yank your leg forward."
    ],
    tips: ["Rest 60–90 sec between sets (isolation move)."]
  },
  {
    id: "seated-calf-raise", name: "Seated Calf Raise", day: 5, dayLabel: "Lower Body B",
    equipment: "Machine", muscle: "legs", icon: "machine", sets: "3 x 15",
    steps: [
      "Sit with the balls of your feet on the platform and the pads resting on your lower thighs.",
      "Let your heels drop for a full stretch at the bottom.",
      "Press through the balls of your feet to raise your heels as high as possible.",
      "Squeeze at the top, then lower slowly under control."
    ],
    tips: ["Rest 60–90 sec between sets (isolation move)."]
  },
  {
    id: "plank", name: "Plank", day: 5, dayLabel: "Lower Body B",
    equipment: "Bodyweight", muscle: "core", icon: "bodyweight", sets: "3 x 30–45 sec",
    steps: [
      "Set up on your forearms and toes, elbows under your shoulders.",
      "Form a straight line from head to heels — no sagging hips, no piking up.",
      "Brace your core and glutes, and breathe steadily throughout the hold.",
      "Hold for the target time, then rest and repeat."
    ],
    tips: ["Rest 60–90 sec between sets."]
  },

  // ===== Cardio finishers (used across multiple days) =====
  {
    id: "incline-treadmill-walk", name: "Incline Treadmill Walk", day: null, dayLabel: "Cardio Finisher",
    equipment: "Cardio Machine", muscle: "cardio", icon: "treadmill", sets: "15 min, moderate pace",
    steps: [
      "Set a moderate incline (roughly 6–12%) and a brisk but sustainable walking pace.",
      "Keep an upright posture — avoid gripping the handrails to take weight off your legs.",
      "Maintain a steady pace you can hold for the full duration.",
      "Cool down with 1–2 minutes at a flat, easy pace at the end."
    ],
    tips: ["Low-impact option that's easier on the knees/joints than running.", "Used as a warm-up mode too: 5–8 min light pace before every session."]
  },
  {
    id: "stationary-bike", name: "Stationary Bike", day: null, dayLabel: "Cardio Finisher",
    equipment: "Cardio Machine", muscle: "cardio", icon: "bike", sets: "15–20 min, steady pace",
    steps: [
      "Adjust the seat height so your knee has a slight bend at the bottom of the pedal stroke.",
      "Start pedaling at a steady, moderate resistance you can sustain for the full session.",
      "Keep your core braced and shoulders relaxed rather than hunched over the handlebars.",
      "Ease off resistance for a short cooldown in the last 1–2 minutes."
    ],
    tips: ["Low-impact — a good early option while building a fitness base."]
  },
  {
    id: "elliptical", name: "Elliptical", day: null, dayLabel: "Cardio Finisher",
    equipment: "Cardio Machine", muscle: "cardio", icon: "elliptical", sets: "15–20 min, steady pace",
    steps: [
      "Step onto the pedals and grip the moving handles for full-body engagement, or hold the stationary rails.",
      "Drive through your legs in a smooth, controlled elliptical motion.",
      "Keep your posture tall rather than leaning heavily on the handles.",
      "Hold a steady, sustainable pace for the full duration."
    ],
    tips: ["Low-impact alternative to running — easy on the joints."]
  },
  {
    id: "rowing-machine", name: "Rowing Machine", day: null, dayLabel: "Cardio Finisher",
    equipment: "Cardio Machine", muscle: "cardio", icon: "rower", sets: "20 min",
    steps: [
      "Strap your feet in, grab the handle, and start with legs bent, arms extended.",
      "Drive the sequence: legs first, then lean back slightly, then pull the handle to your torso.",
      "Reverse the sequence smoothly to return: arms out, lean forward, then bend the knees.",
      "Keep a steady, controlled rhythm rather than rushing the stroke."
    ],
    tips: ["Full-body, low-impact cardio option."]
  },
  {
    id: "stairmaster", name: "Stairmaster", day: null, dayLabel: "Cardio Finisher",
    equipment: "Cardio Machine", muscle: "cardio", icon: "stairmaster", sets: "15 min",
    steps: [
      "Step onto the pedals and set a sustainable stepping pace.",
      "Stand tall and let your legs do the work rather than leaning on the handrails.",
      "Keep your steps controlled rather than rushed or bouncy.",
      "Maintain a steady pace for the full duration, cooling down briefly at the end."
    ],
    tips: ["Higher-effort cardio option — build up gradually."]
  },
];

/* ---------- Program structure (guidelines, days, notes) — verbatim from the plan ---------- */
const PROGRAM = {
  title: "4-Day Fat Loss Program",
  subtitle: "Fitness Time (Standard Commercial Gym)",
  profile: { sex: "Male", age: 30, heightCm: 178, weightKg: 114, goal: "Fat loss", level: "Some experience" },
  split: "Upper/Lower x2",
  frequency: "4 days/week + optional cardio on off days",
  guidelines: [
    { title: "Warm-up (5–8 min)", text: "Light bike or incline treadmill walk + dynamic stretches (arm circles, leg swings, bodyweight squats) before every session." },
    { title: "Rest between sets", text: "60–90 sec on isolation moves, 90–120 sec on compound lifts." },
    { title: "Tempo", text: "Controlled, no jerking or bouncing — at your current bodyweight, joint control matters more than speed." },
    { title: "Progression", text: "Add weight or 1–2 reps once you hit the top of the rep range with good form on all sets." },
    { title: "Cardio", text: "Favor incline treadmill walking, stationary bike, elliptical, or rowing machine over running early on — lower impact on knees/joints while still burning calories." },
    { title: "Impact", text: "Avoid jump-heavy or high-impact moves for the first 6–8 weeks; build a base first." },
    { title: "New to a machine?", text: "Ask a Fitness Time floor trainer to show you correct setup on your first pass — cheap insurance against injury." },
  ],
  days: [
    { day: 1, label: "Upper Body A", type: "training", cardio: "15 min incline walk (moderate pace)" },
    { day: 2, label: "Lower Body A", type: "training", cardio: "15–20 min bike or elliptical (steady pace)" },
    { day: 3, label: "Rest or light cardio", type: "rest", text: "20–30 min walk/bike" },
    { day: 4, label: "Upper Body B", type: "training", cardio: "15 min stairmaster or incline walk" },
    { day: 5, label: "Lower Body B", type: "training", cardio: "20 min bike or rowing machine" },
    { day: 6, label: "Rest, or optional easy cardio", type: "rest", text: "20–30 min easy cardio (walk, bike, swim if available)" },
    { day: 7, label: "Rest, or optional easy cardio", type: "rest", text: "20–30 min easy cardio (walk, bike, swim if available)" },
  ],
  notes: [
    "This is a starting template — reassess after 4–6 weeks and adjust weights/reps as you get stronger.",
    "If any exercise causes joint pain (not muscle fatigue), swap it for the machine-based alternative listed nearby, or ask a trainer for a substitution.",
    "Consistency across all 4 sessions plus the cardio finishers will drive fat loss more than any single \"perfect\" exercise choice.",
  ],
};

/* ---------- Local media ----------
   Every exercise has a real gym photograph and a silent looping video clip
   stored locally under assets/. The clip is an animation built by
   tools/build-media.js from the source's start and end frames — a short eased
   cross-fade with holds at each end, timed like a rep. It is not filmed video,
   and the interface says so rather than implying otherwise.

   Source: free-exercise-db (github.com/yuhonas/free-exercise-db), released into
   the public domain under the Unlicense. Everything is served from this repo,
   so the site still makes zero external requests. Paths derive from the id. */
const MEDIA_CREDIT = "Photos & demonstrations: free-exercise-db (public domain / Unlicense)";

/* Cases where the pictured movement is a documented variation rather than an
   exact match — called out in the UI so nothing is misrepresented. */
const MEDIA_NOTES = {
  "assisted-pull-up-machine":
    "Pictured: the close-grip lat pulldown — the substitution this program lists for the assisted pull-up machine.",
  "hip-adduction-abduction":
    "The animation cycles through both machines: hip adduction (inner thigh) and hip abduction (outer thigh).",
  "incline-treadmill-walk":
    "Pictured: treadmill walking. This program calls for a moderate incline rather than a flat walk.",
};

function photoFor(id){ return `assets/photos/${id}.jpg`; }
function clipFor(id){ return `assets/clips/${id}.webm`; }

function exerciseById(id){ return EXERCISES.find(e => e.id === id); }
function exercisesForDay(day){ return EXERCISES.filter(e => e.day === day); }

/* ============================================================================
   ==  GymBuddy 2.0 — Coaching data layer  ===================================
   ============================================================================
   Everything above this line is the original program content, unchanged.
   Everything below adds the structured metadata the AI coaching engine needs
   to reason about the library: movement patterns, muscle contribution, load
   type and plate increments, joint stress, fatigue cost, and substitutions.

   Nothing here is invented flavour text — the numbers drive real decisions:
     · loadType + increment  → what "add weight" physically means on that machine
     · pattern               → which exercises can stand in for which
     · contribution          → weekly set counting per muscle (volume landmarks)
     · jointStress           → what to swap when the user reports pain
     · fatigue               → how much a movement costs in a session budget
   ============================================================================ */

/* ---------- Movement patterns ----------
   The substitution graph is built on these. Two exercises are interchangeable
   when they share a pattern; the coach prefers the same pattern before it
   falls back to the same primary muscle. */
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

/* ---------- Supplementary movements ----------
   The original 24 lifts cover the 4-day plan, but a 5- or 6-day split, a pain
   swap, or a plateau variation needs more options in the thin patterns
   (vertical push, horizontal pull, hinge). These are drawn from the same
   commercial-gym equipment list. Like everything else in the library, each one
   ships with a photograph and a looping demonstration. */
const SUPPLEMENTARY_EXERCISES = [
  {
    id: "seated-db-shoulder-press", name: "Seated Dumbbell Shoulder Press", day: null,
    dayLabel: "Library", equipment: "Dumbbell", muscle: "shoulders", icon: "dumbbell",
    sets: "3 x 8–12",
    steps: [
      "Set an upright bench and sit with a dumbbell in each hand at shoulder height, palms forward.",
      "Brace your core and press both dumbbells overhead until your arms are extended.",
      "Keep your ribcage down — don't arch your lower back to finish the rep.",
      "Lower under control until your upper arms are level with your shoulders.",
    ],
    tips: ["Free-weight alternative when the shoulder press machine is taken.", "Rest 90–120 sec between sets."],
  },
  {
    id: "machine-chest-supported-row", name: "Chest-Supported Machine Row", day: null,
    dayLabel: "Library", equipment: "Machine", muscle: "back", icon: "machine",
    sets: "3 x 10–12",
    steps: [
      "Set the chest pad so the handles sit at mid-chest with your arms extended.",
      "Brace your chest against the pad — this takes your lower back out of the movement.",
      "Row the handles back, driving your elbows behind your torso.",
      "Squeeze your shoulder blades together, then return to a full stretch.",
    ],
    tips: ["The lower-back-friendly row: use this if seated cable rows bother your back.", "Rest 90 sec between sets."],
  },
  {
    id: "db-romanian-deadlift", name: "Dumbbell Romanian Deadlift", day: null,
    dayLabel: "Library", equipment: "Dumbbell", muscle: "legs", icon: "dumbbell",
    sets: "3 x 10–12",
    steps: [
      "Hold a dumbbell in each hand in front of your thighs, feet hip-width apart.",
      "Soften your knees and push your hips straight back, letting the dumbbells travel down your legs.",
      "Stop when you feel a strong hamstring stretch with a flat back — depth comes from your hips, not your spine.",
      "Drive your hips forward to stand, squeezing your glutes at the top.",
    ],
    tips: ["Lighter spinal load than the barbell version — a good first hinge.", "Rest 90–120 sec between sets."],
  },
  {
    id: "back-extension", name: "45° Back Extension", day: null,
    dayLabel: "Library", equipment: "Bodyweight", muscle: "glutes", icon: "bodyweight",
    sets: "3 x 12–15",
    steps: [
      "Set the pad just below your hip bones so your hips can hinge freely.",
      "Cross your arms over your chest and hinge forward with a flat back.",
      "Drive your hips into the pad to rise until your body is in a straight line.",
      "Stop at straight — do not arch past it.",
    ],
    tips: ["Hamstring and glute work with zero knee load.", "Add a light plate to your chest once bodyweight is easy."],
  },
  {
    id: "goblet-squat", name: "Goblet Squat", day: null,
    dayLabel: "Library", equipment: "Dumbbell", muscle: "legs", icon: "dumbbell",
    sets: "3 x 10–12",
    steps: [
      "Hold one dumbbell vertically against your chest, elbows tucked underneath it.",
      "Stand a little wider than shoulder width with your toes turned slightly out.",
      "Sit down between your hips, keeping your chest tall and heels planted.",
      "Drive through your whole foot to stand back up.",
    ],
    tips: ["Squat pattern for days when the hack squat and leg press are both busy.", "Rest 90 sec between sets."],
  },
  {
    id: "hammer-curl", name: "Dumbbell Hammer Curl", day: null,
    dayLabel: "Library", equipment: "Dumbbell", muscle: "arms", icon: "dumbbell",
    sets: "3 x 10–12",
    steps: [
      "Stand holding a dumbbell in each hand with your palms facing your thighs.",
      "Keeping that neutral grip, curl the weights toward your shoulders.",
      "Keep your elbows pinned to your sides — no swinging.",
      "Lower with control to a full extension.",
    ],
    tips: ["Neutral grip is usually kinder to a sore elbow than a supinated curl."],
  },
  {
    id: "cable-lateral-raise", name: "Cable Lateral Raise", day: null,
    dayLabel: "Library", equipment: "Cable", muscle: "shoulders", icon: "cable",
    sets: "3 x 12–15",
    steps: [
      "Set a D-handle at the lowest pulley and stand side-on, grabbing it with the outside hand.",
      "With a slight elbow bend, raise your arm out to the side to shoulder height.",
      "Lead with the elbow and keep the shoulder down away from your ear.",
      "Lower slowly — the cable keeps tension at the bottom where dumbbells lose it.",
    ],
    tips: ["Smoother resistance curve than dumbbells; good when 2 kg jumps feel too big."],
  },
  {
    id: "hanging-knee-raise", name: "Hanging Knee Raise", day: null,
    dayLabel: "Library", equipment: "Bodyweight", muscle: "core", icon: "bodyweight",
    sets: "3 x 10–15",
    steps: [
      "Hang from a pull-up bar or set up in a captain's chair with your back against the pad.",
      "Brace your core and lift your knees toward your chest by curling your pelvis up.",
      "The rep is the pelvis tilt, not the knee travel — stop swinging.",
      "Lower slowly to a fully extended, controlled hang.",
    ],
    tips: ["Progress to straight legs once 15 controlled knee raises are easy."],
  },
  {
    id: "reverse-pec-deck", name: "Reverse Pec Deck", day: null,
    dayLabel: "Library", equipment: "Machine", muscle: "shoulders", icon: "machine",
    sets: "3 x 15",
    steps: [
      "Turn to face the pec deck's back pad and set the handles to shoulder height.",
      "Grip the handles with a slight elbow bend and arms extended in front of you.",
      "Sweep your arms out and back, squeezing your rear delts and mid-back.",
      "Return under control without letting the stack drop.",
    ],
    tips: ["Machine alternative to face pulls when every cable station is occupied."],
  },
  {
    id: "seated-db-shrug", name: "Seated Dumbbell Shrug", day: null,
    dayLabel: "Library", equipment: "Dumbbell", muscle: "back", icon: "dumbbell",
    sets: "3 x 12–15",
    steps: [
      "Sit on the end of a bench with a dumbbell hanging at each side.",
      "Shrug your shoulders straight up toward your ears — no rolling.",
      "Hold the top for a beat.",
      "Lower slowly to a full stretch.",
    ],
    tips: ["Sitting removes the leg drive people cheat with when standing."],
  },
];

/* ---------- Library expansion ----------
   The original plan is built on machines, which is right for someone starting
   out in a commercial gym. These add the free-weight and bodyweight movements
   the coach needs to keep progressing someone past that: barbell variants of
   every main pattern, the pull-up family, unilateral work, and enough choice in
   each pattern that a plateau swap or a pain flag has somewhere to go.
   Every one ships with a photograph and a looping demonstration. */
const EXPANSION_EXERCISES = [
  {
    id: "barbell-bench-press", name: "Barbell Bench Press", day: null, dayLabel: "Library",
    equipment: "Free Weight", muscle: "chest", icon: "dumbbell", sets: "4 x 5–8",
    steps: [
      "Lie back with your eyes under the bar, feet flat, and a slight natural arch in your lower back.",
      "Grip a little wider than shoulder width, pull your shoulder blades down and together, and unrack.",
      "Lower the bar under control to your lower chest, keeping your elbows at roughly 45° to your torso.",
      "Touch lightly, then press back up and slightly back toward your face until the arms are extended.",
    ],
    tips: [
      "Use a spotter or safety pins for anything heavy — this is the one lift you cannot bail out of.",
      "Rest 2–3 min between sets. This is a heavy compound and the reps are the point, not the pump.",
    ],
  },
  {
    id: "dumbbell-bench-press", name: "Dumbbell Bench Press", day: null, dayLabel: "Library",
    equipment: "Dumbbell", muscle: "chest", icon: "dumbbell", sets: "3 x 8–12",
    steps: [
      "Sit on the bench with a dumbbell on each thigh, then kick them up as you lie back.",
      "Start with the weights at chest level, palms facing forward, shoulder blades pinned down.",
      "Press up and slightly together until your arms are extended, without clashing the dumbbells.",
      "Lower under control until you feel a stretch across your chest, elbows at about 45°.",
    ],
    tips: [
      "A deeper stretch than the barbell, and each side has to work on its own.",
      "To finish safely, bring the dumbbells to your chest and sit up with them.",
    ],
  },
  {
    id: "incline-dumbbell-press", name: "Incline Dumbbell Press", day: null, dayLabel: "Library",
    equipment: "Dumbbell", muscle: "chest", icon: "dumbbell", sets: "3 x 8–12",
    steps: [
      "Set the bench to about 30° — steeper than that turns it into a shoulder press.",
      "Sit back with a dumbbell in each hand at shoulder height, palms forward.",
      "Press up until your arms are extended over your upper chest.",
      "Lower under control to the sides of your upper chest.",
    ],
    tips: ["Targets the upper chest, which the flat press under-trains.", "Rest 90–120 sec between sets."],
  },
  {
    id: "push-up", name: "Push-Up", day: null, dayLabel: "Library",
    equipment: "Bodyweight", muscle: "chest", icon: "bodyweight", sets: "3 x 10–20",
    steps: [
      "Set your hands slightly wider than your shoulders, body in a straight line from head to heels.",
      "Brace your core and glutes so your hips neither sag nor pike up.",
      "Lower until your chest is just off the floor, elbows at about 45° to your torso.",
      "Press back up to full arm extension without letting your hips lead.",
    ],
    tips: [
      "Hands on a bench makes it easier; feet on a bench makes it harder — no equipment needed either way.",
      "A free warm-up for any pressing session.",
    ],
  },
  {
    id: "cable-crossover", name: "Cable Crossover", day: null, dayLabel: "Library",
    equipment: "Cable", muscle: "chest", icon: "cable", sets: "3 x 12–15",
    steps: [
      "Set both pulleys high, take a handle in each hand and step forward into a split stance.",
      "With a slight bend in the elbows, bring your hands down and together in front of your hips.",
      "Squeeze your chest at the point where your hands meet.",
      "Return slowly to a stretch without letting the weight pull your shoulders back.",
    ],
    tips: ["Cables keep tension through the whole range where dumbbell flyes lose it at the top."],
  },
  {
    id: "arnold-press", name: "Arnold Press", day: null, dayLabel: "Library",
    equipment: "Dumbbell", muscle: "shoulders", icon: "dumbbell", sets: "3 x 10–12",
    steps: [
      "Sit upright holding a dumbbell in each hand at chest height, palms facing you.",
      "Press up while rotating your palms outward, finishing overhead with palms facing forward.",
      "Reverse the rotation on the way down, ending with palms facing you again.",
      "Keep the movement smooth — the rotation happens as you press, not before it.",
    ],
    tips: ["The rotation brings the front delt through a longer range than a straight press."],
  },
  {
    id: "dips-triceps", name: "Triceps Dips", day: null, dayLabel: "Library",
    equipment: "Bodyweight", muscle: "arms", icon: "bodyweight", sets: "3 x 8–12",
    steps: [
      "Support yourself on parallel bars with arms extended and torso close to upright.",
      "Keep your elbows tucked in — flaring them turns this into a chest exercise.",
      "Lower until your elbows reach about 90°, no deeper if your shoulders complain.",
      "Press back up to full extension.",
    ],
    tips: [
      "Use the assisted dip machine if you cannot yet control your bodyweight.",
      "Stop short of a deep stretch: the bottom of a dip is the position shoulders least like.",
    ],
  },
  {
    id: "pull-up", name: "Pull-Up", day: null, dayLabel: "Library",
    equipment: "Bodyweight", muscle: "back", icon: "bodyweight", sets: "4 x 5–10",
    steps: [
      "Hang from the bar with an overhand grip slightly wider than your shoulders.",
      "Start from a full hang, then pull your shoulder blades down before your arms bend.",
      "Pull until your chin clears the bar, driving your elbows down toward your ribs.",
      "Lower under control all the way back to a full hang.",
    ],
    tips: [
      "The hardest and best vertical pull there is. Use the assisted machine or bands to build up.",
      "Add weight in a belt once you can do 12 clean reps.",
    ],
  },
  {
    id: "chin-up", name: "Chin-Up", day: null, dayLabel: "Library",
    equipment: "Bodyweight", muscle: "back", icon: "bodyweight", sets: "3 x 6–12",
    steps: [
      "Hang from the bar with an underhand grip about shoulder width apart.",
      "Pull your shoulder blades down, then drive your elbows toward your ribs.",
      "Pull until your chin clears the bar, keeping your ribs down rather than swinging.",
      "Lower under control to a full hang.",
    ],
    tips: ["The supinated grip lets the biceps help, so most people manage more of these than pull-ups."],
  },
  {
    id: "straight-arm-pulldown", name: "Straight-Arm Pulldown", day: null, dayLabel: "Library",
    equipment: "Cable", muscle: "back", icon: "cable", sets: "3 x 12–15",
    steps: [
      "Stand facing a high pulley with a straight bar or rope, arms extended in front of you.",
      "Hinge forward slightly and keep a fixed, soft bend in your elbows.",
      "Pull the bar down in an arc to your thighs using your lats, not your triceps.",
      "Return slowly, letting your lats stretch at the top without shrugging.",
    ],
    tips: ["Isolates the lats with no elbow flexion, so the arms cannot take over."],
  },
  {
    id: "bent-over-barbell-row", name: "Bent-Over Barbell Row", day: null, dayLabel: "Library",
    equipment: "Free Weight", muscle: "back", icon: "dumbbell", sets: "4 x 6–10",
    steps: [
      "Stand with feet hip-width, hinge at the hips until your torso is around 45° or lower.",
      "Hold the bar with an overhand grip just outside your knees, back flat and braced.",
      "Row the bar to your lower ribs, driving your elbows back past your torso.",
      "Lower under control without letting your back round or your torso rise.",
    ],
    tips: [
      "The most demanding row there is, and the hardest on the lower back — swap for a chest-supported row if it complains.",
      "Rest 2–3 min between sets.",
    ],
  },
  {
    id: "one-arm-db-row", name: "One-Arm Dumbbell Row", day: null, dayLabel: "Library",
    equipment: "Dumbbell", muscle: "back", icon: "dumbbell", sets: "3 x 8–12 each",
    steps: [
      "Put one knee and the same-side hand on a bench, the other foot planted on the floor.",
      "Let the dumbbell hang at arm's length with your back flat and parallel to the floor.",
      "Row the weight to your hip, driving the elbow back and letting your shoulder blade travel.",
      "Lower to a full stretch without twisting your torso to help.",
    ],
    tips: ["The bench takes your lower back out of it, so you can row heavy without paying for it."],
  },
  {
    id: "t-bar-row", name: "T-Bar Row", day: null, dayLabel: "Library",
    equipment: "Free Weight", muscle: "back", icon: "dumbbell", sets: "3 x 8–12",
    steps: [
      "Straddle the bar, hinge forward with a flat back and grip the handles.",
      "Start with your arms extended and your shoulder blades stretched forward.",
      "Row the weight to your torso, driving your elbows back and squeezing your mid-back.",
      "Lower under control to a full stretch.",
    ],
    tips: ["A thicker mid-back builder than the cable row, with less lower-back load than a barbell row."],
  },
  {
    id: "barbell-back-squat", name: "Barbell Back Squat", day: null, dayLabel: "Library",
    equipment: "Free Weight", muscle: "legs", icon: "dumbbell", sets: "4 x 5–8",
    steps: [
      "Set the bar across your upper traps, grip it firmly, and step back into a shoulder-width stance.",
      "Brace your core, break at the hips and knees together, and sit down between your heels.",
      "Descend until your hip crease is at least level with your knee, keeping your chest up.",
      "Drive up through your whole foot, hips and shoulders rising at the same rate.",
    ],
    tips: [
      "Always squat inside a rack with the safety pins set — bailing out of a squat is not a plan.",
      "Rest 3 min between heavy sets.",
    ],
  },
  {
    id: "front-squat", name: "Front Squat", day: null, dayLabel: "Library",
    equipment: "Free Weight", muscle: "legs", icon: "dumbbell", sets: "3 x 6–10",
    steps: [
      "Rest the bar across your front delts with elbows high — the shelf is your shoulders, not your hands.",
      "Stand shoulder-width, brace hard, and squat straight down with an upright torso.",
      "Keep your elbows up throughout; when they drop, the bar rolls forward.",
      "Drive back up without letting your hips shoot up first.",
    ],
    tips: ["More quad and far less lower back than the back squat. Lighter loads, same effect on the legs."],
  },
  {
    id: "barbell-deadlift", name: "Barbell Deadlift", day: null, dayLabel: "Library",
    equipment: "Free Weight", muscle: "legs", icon: "dumbbell", sets: "3 x 3–6",
    steps: [
      "Stand with mid-foot under the bar, hip-width apart, and grip just outside your shins.",
      "Drop your hips until your shins touch the bar, chest up, back flat, lats engaged.",
      "Push the floor away and stand, keeping the bar dragging up your legs.",
      "Lock out by squeezing your glutes — do not lean back — then hinge the bar back down.",
    ],
    tips: [
      "The most systemically taxing lift in the gym. Three hard sets is plenty; more is rarely better.",
      "The moment your back rounds, the set is over.",
    ],
  },
  {
    id: "good-morning", name: "Good Morning", day: null, dayLabel: "Library",
    equipment: "Free Weight", muscle: "legs", icon: "dumbbell", sets: "3 x 10–12",
    steps: [
      "Set a light bar across your upper back as for a squat, feet hip-width.",
      "With soft knees, push your hips straight back and let your torso hinge forward.",
      "Go until you feel a strong hamstring stretch with a flat back — depth comes from the hips.",
      "Drive your hips forward to stand tall.",
    ],
    tips: ["Start far lighter than feels necessary. This one punishes ego more than any other lift."],
  },
  {
    id: "barbell-hip-thrust", name: "Barbell Hip Thrust", day: null, dayLabel: "Library",
    equipment: "Free Weight", muscle: "glutes", icon: "dumbbell", sets: "3 x 8–12",
    steps: [
      "Sit on the floor with your upper back against a bench and the padded bar over your hips.",
      "Plant your feet flat, shins vertical at the top of the movement.",
      "Drive through your heels to lift your hips until your torso is parallel to the floor.",
      "Squeeze your glutes hard at the top, tuck your ribs down, then lower under control.",
    ],
    tips: ["The heaviest loadable glute exercise there is, and easy on the knees."],
  },
  {
    id: "bulgarian-split-squat", name: "Bulgarian Split Squat", day: null, dayLabel: "Library",
    equipment: "Dumbbell", muscle: "legs", icon: "dumbbell", sets: "3 x 8–12 each",
    steps: [
      "Stand a stride in front of a bench and place the top of your rear foot on it.",
      "Hold a dumbbell in each hand and set your front foot far enough forward to keep the shin near vertical.",
      "Lower straight down until your rear knee is just off the floor.",
      "Drive up through your front heel without pushing off the back foot.",
    ],
    tips: [
      "Brutal for the amount of weight involved, and it exposes side-to-side differences a barbell hides.",
      "Rest 90 sec between legs, not between sets.",
    ],
  },
  {
    id: "preacher-curl", name: "Preacher Curl", day: null, dayLabel: "Library",
    equipment: "Machine", muscle: "arms", icon: "machine", sets: "3 x 10–12",
    steps: [
      "Set the seat so your armpits rest against the top of the pad with your arms flat on it.",
      "Grip the handles and start from a near-full stretch, not a locked-out elbow.",
      "Curl up until your forearms are just past vertical.",
      "Lower slowly all the way back to the stretch — this is where the pad earns its keep.",
    ],
    tips: ["The pad removes all swing, so the biceps get exactly the load you selected."],
  },
  {
    id: "concentration-curl", name: "Concentration Curl", day: null, dayLabel: "Library",
    equipment: "Dumbbell", muscle: "arms", icon: "dumbbell", sets: "3 x 12–15 each",
    steps: [
      "Sit on a bench, legs apart, and brace the back of your upper arm against your inner thigh.",
      "Let the dumbbell hang at a full stretch.",
      "Curl it toward your shoulder without letting your elbow travel off your thigh.",
      "Squeeze at the top, then lower slowly to full extension.",
    ],
    tips: ["One arm at a time, no momentum available — the cleanest biceps contraction on offer."],
  },
  {
    id: "skull-crusher", name: "Skull Crusher", day: null, dayLabel: "Library",
    equipment: "Free Weight", muscle: "arms", icon: "dumbbell", sets: "3 x 10–12",
    steps: [
      "Lie on a flat bench holding an EZ bar over your chest with a narrow overhand grip.",
      "Keeping your upper arms fixed and angled slightly back, bend your elbows to lower the bar.",
      "Bring it to just behind your forehead, not straight down to it.",
      "Extend your elbows to press back up without letting your upper arms drift.",
    ],
    tips: ["Use an EZ bar rather than a straight one — the angled grip is much kinder to the elbows."],
  },
  {
    id: "bench-dips", name: "Bench Dips", day: null, dayLabel: "Library",
    equipment: "Bodyweight", muscle: "arms", icon: "bodyweight", sets: "3 x 12–20",
    steps: [
      "Sit on the edge of a bench with your hands beside your hips, then slide your hips off the front.",
      "Keep your back close to the bench and your elbows pointing straight back.",
      "Lower until your elbows reach about 90°.",
      "Press back up through your palms to full extension.",
    ],
    tips: [
      "Feet closer makes it easier, further away or elevated makes it harder.",
      "Stop if your shoulders feel pinched at the bottom — this position is demanding on them.",
    ],
  },
  {
    id: "upright-row", name: "Upright Row", day: null, dayLabel: "Library",
    equipment: "Machine", muscle: "shoulders", icon: "machine", sets: "3 x 12–15",
    steps: [
      "Hold the bar with an overhand grip about shoulder width — narrower grips crowd the shoulder.",
      "Pull the bar straight up close to your body, leading with your elbows.",
      "Stop when your upper arms reach shoulder height. Higher buys nothing and costs the joint.",
      "Lower under control to full extension.",
    ],
    tips: ["Stop at shoulder height and use a wider grip: taken high and narrow, this is a shoulder-impingement exercise."],
  },
  {
    id: "cable-rear-delt-fly", name: "Cable Rear Delt Fly", day: null, dayLabel: "Library",
    equipment: "Cable", muscle: "shoulders", icon: "cable", sets: "3 x 15",
    steps: [
      "Set two pulleys to shoulder height and take the left handle in your right hand and vice versa.",
      "Stand centred with arms crossed in front of you and a slight bend in the elbows.",
      "Sweep your arms out and back in a wide arc, squeezing your rear delts.",
      "Return under control without letting your shoulders round forward.",
    ],
    tips: ["Rear delts are the most under-trained head of the shoulder and the one that fixes posture."],
  },
  {
    id: "ab-roller", name: "Ab Wheel Rollout", day: null, dayLabel: "Library",
    equipment: "Bodyweight", muscle: "core", icon: "bodyweight", sets: "3 x 8–12",
    steps: [
      "Kneel with the wheel under your shoulders and your hips directly over your knees.",
      "Brace hard and tuck your ribs down — the rep starts before the wheel moves.",
      "Roll forward only as far as you can go without your lower back arching.",
      "Pull yourself back with your abs, not by sitting back onto your heels.",
    ],
    tips: [
      "Range is earned. A short, braced rollout beats a long one with a sagging back.",
      "If your lower back aches afterwards, you went too far.",
    ],
  },
  {
    id: "side-plank", name: "Side Plank", day: null, dayLabel: "Library",
    equipment: "Bodyweight", muscle: "core", icon: "bodyweight", sets: "3 x 30–45 sec each",
    steps: [
      "Lie on your side, elbow directly under your shoulder, legs stacked.",
      "Lift your hips until your body forms a straight line from head to feet.",
      "Keep your top hip pushed forward so you do not rotate backwards.",
      "Hold, breathing steadily, then swap sides.",
    ],
    tips: ["Trains the side of the trunk, which the front plank misses entirely."],
  },
];

const EXPANSION_META = {
  "barbell-bench-press":     { pattern: "horizontal_push", loadType: "barbell",       role: "compound",  fatigue: 4, contribution: { chest: 1, shoulders: 0.5, arms: 0.5 }, jointStress: ["shoulder", "elbow"],            startCoef: 0.50, unilateral: false },
  "dumbbell-bench-press":    { pattern: "horizontal_push", loadType: "dumbbell",      role: "compound",  fatigue: 3, contribution: { chest: 1, shoulders: 0.5, arms: 0.5 }, jointStress: ["shoulder", "elbow"],            startCoef: 0.20, unilateral: true },
  "incline-dumbbell-press":  { pattern: "incline_push",    loadType: "dumbbell",      role: "compound",  fatigue: 3, contribution: { chest: 1, shoulders: 0.5, arms: 0.5 }, jointStress: ["shoulder", "elbow"],            startCoef: 0.17, unilateral: true },
  "push-up":                 { pattern: "horizontal_push", loadType: "bodyweight",    role: "compound",  fatigue: 2, contribution: { chest: 1, shoulders: 0.5, arms: 0.5, core: 0.25 }, jointStress: ["shoulder", "elbow"], startCoef: 0,    unilateral: false },
  "cable-crossover":         { pattern: "chest_iso",       loadType: "cable_stack",   role: "isolation", fatigue: 2, contribution: { chest: 1, shoulders: 0.25 },           jointStress: ["shoulder"],                     startCoef: 0.12, unilateral: true },
  "arnold-press":            { pattern: "vertical_push",   loadType: "dumbbell",      role: "compound",  fatigue: 3, contribution: { shoulders: 1, arms: 0.5, chest: 0.25 },jointStress: ["shoulder", "elbow"],            startCoef: 0.10, unilateral: true },
  "dips-triceps":            { pattern: "vertical_push",   loadType: "bodyweight",    role: "compound",  fatigue: 3, contribution: { arms: 1, chest: 0.5, shoulders: 0.5 }, jointStress: ["shoulder", "elbow"],            startCoef: 0,    unilateral: false },
  "pull-up":                 { pattern: "vertical_pull",   loadType: "bodyweight",    role: "compound",  fatigue: 3, contribution: { back: 1, arms: 0.5, shoulders: 0.25 }, jointStress: ["shoulder", "elbow"],            startCoef: 0,    unilateral: false },
  "chin-up":                 { pattern: "vertical_pull",   loadType: "bodyweight",    role: "compound",  fatigue: 3, contribution: { back: 1, arms: 0.75, shoulders: 0.25 },jointStress: ["shoulder", "elbow"],            startCoef: 0,    unilateral: false },
  "straight-arm-pulldown":   { pattern: "vertical_pull",   loadType: "cable_stack",   role: "isolation", fatigue: 2, contribution: { back: 1 },                             jointStress: ["shoulder"],                     startCoef: 0.16, unilateral: false },
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
  "back-extension":               { pattern: "hinge",           loadType: "bodyweight",    role: "isolation", fatigue: 2, contribution: { glutes: 1, legs: 0.5, back: 0.5 },       jointStress: ["hip"],               startCoef: 0,    unilateral: false },
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

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const DAY_SHORT  = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

/* ---------- Helpers ---------- */
function metaFor(id) { return EX_META[id] || {}; }
function hasLocalMedia(id) { const ex = exerciseById(id); return !ex || ex.hasMedia !== false; }
function strengthExercises() { return EXERCISES.filter(e => e.muscle !== "cardio"); }
function cardioExercises() { return EXERCISES.filter(e => e.muscle === "cardio"); }
function exercisesByPattern(pattern) { return EXERCISES.filter(e => e.pattern === pattern); }

/* ============================================================================
   ==  Localisation bridge  ===================================================
   ============================================================================
   The English exercise content above is the source text, so it is registered
   into the English dictionary rather than duplicated into a translation file.
   That keeps one copy of every English string and makes the parity test
   meaningful: any exercise added here without an Arabic entry shows up as a
   missing key rather than as silent English inside an Arabic page.
   ============================================================================ */

(function registerEnglishContent() {
  const exercise = {};
  EXERCISES.forEach(ex => {
    exercise[ex.id] = { name: ex.name, steps: ex.steps, tips: ex.tips };
  });

  const guideline = {};
  PROGRAM.guidelines.forEach((g, i) => { guideline[i] = { title: g.title, text: g.text }; });
  const note = {};
  PROGRAM.notes.forEach((n, i) => { note[i] = n; });

  I18n.register("en", {
    exercise,
    mediaNote: MEDIA_NOTES,
    planContent: {
      title: PROGRAM.title,
      subtitle: PROGRAM.subtitle,
      split: PROGRAM.split,
      frequency: PROGRAM.frequency,
      guideline,
      note,
    },
  });
})();

/* ---------- Language-aware accessors ----------
   Everything that renders a name, a label or a form cue goes through these
   rather than reading the English constant directly, so a language switch
   re-renders the whole app instead of leaving English islands behind. */

function exName(id)     { return I18n.t(`exercise.${id}.name`); }
function exSteps(id)    { return I18n.list(`exercise.${id}.steps`); }
function exTips(id)     { return I18n.list(`exercise.${id}.tips`); }
function exMediaNote(id){ return I18n.has(`mediaNote.${id}`) ? I18n.t(`mediaNote.${id}`) : null; }

function muscleLabel(m)   { return I18n.t(`muscle.${m}`); }
function patternLabel(p)  { return I18n.t(`pattern.${p}`); }
function loadTypeLabel(l) { return I18n.t(`loadType.${l}`); }
function equipmentLabel(e){ return I18n.has(`equipment.${e}`) ? I18n.t(`equipment.${e}`) : e; }
function jointLabel(j)    { return I18n.t(`joint.${j}`); }
function goalLabel(g)     { return I18n.has(`goal.${g}`) ? I18n.t(`goal.${g}`) : g; }
function levelLabel(l)    { return I18n.has(`level.${l}`) ? I18n.t(`level.${l}`) : l; }
function sexLabel(s)      { return I18n.has(`sex.${s}`) ? I18n.t(`sex.${s}`) : s; }
function dayLabel(d)      { return I18n.t(`day.${d}`); }
function dayShort(d)      { return I18n.t(`day.short.${d}`); }
function roleLabel(r)     { return I18n.t(`role.${r}`); }
function volumeStatusLabel(s) { return I18n.t(`volumeStatus.${s}`); }
function goalNote(goal)      { const g = GOAL_PROFILES[goal]; return g ? I18n.t(`goal.note.${g.noteKey}`) : ""; }
function cardioIntensity(goal) {
  const g = GOAL_PROFILES[goal] || GOAL_PROFILES["General fitness"];
  return I18n.t(`goal.cardioIntensity.${g.cardioIntensityKey}`);
}

function planTitle()     { return I18n.t("planContent.title"); }
function planSubtitle()  { return I18n.t("planContent.subtitle"); }
function planGuidelines() {
  return PROGRAM.guidelines.map((g, i) => ({
    title: I18n.t(`planContent.guideline.${i}.title`),
    text: I18n.t(`planContent.guideline.${i}.text`),
  }));
}
function planNotes() {
  return PROGRAM.notes.map((n, i) => I18n.t(`planContent.note.${i}`));
}

/** The plan's own "4 x 10–12" text, rebuilt in the current language. */
function prescriptionText(ex) {
  if (ex.loadType === "timed") {
    return `${ex.defaultSets} × ${ex.defaultRepLo}–${ex.defaultRepHi} ${I18n.t("common.seconds")}`;
  }
  if (ex.defaultRepLo === ex.defaultRepHi) {
    return `${ex.defaultSets} × ${ex.defaultRepLo}`;
  }
  return `${ex.defaultSets} × ${ex.defaultRepLo}–${ex.defaultRepHi}`;
}

/* ---------- Deferred-reference resolvers ----------
   Registered here because this is the module that knows how to turn an id into
   a name. The i18n layer stores the reference; these turn it into text at the
   moment it is rendered, in whatever language is in force then. */
I18n.resolver("ex",        id => exName(id));
I18n.resolver("day",       d  => dayLabel(d));
I18n.resolver("dayShort",  d  => dayShort(d));
I18n.resolver("pattern",   p  => patternLabel(p));
I18n.resolver("joint",     j  => jointLabel(j));
I18n.resolver("muscle",    m  => muscleLabel(m));
I18n.resolver("loadType",  l  => loadTypeLabel(l));
I18n.resolver("role",      r  => roleLabel(r));
I18n.resolver("template",  id => templateName(id));
I18n.resolver("split",     id => splitName(id));
I18n.resolver("goal",      g  => goalLabel(g));
/* A load is a weight plus the exercise it belongs to, because "40 kg" and
   "40 kg of assistance" are different sentences. Progression is defined later
   in load order, so this is looked up lazily rather than captured. */
I18n.resolver("load", (weight, exerciseId) =>
  Progression.fmtLoad(weight, exerciseId ? exerciseById(exerciseId) : null));

/* Composite resolvers: a bulleted list of progression lines with an optional
   overflow tail, and the "Chest Press (shoulder)" pain list. Both have to be
   assembled at render time so the joined text follows the current language. */
I18n.resolver("__lines", (lines, overflow) => {
  const body = (lines || []).map(l => I18n.tx(l)).join("\n");
  return overflow > 0 ? `${body}\n${I18n.t("common.andMore", { count: overflow })}` : body;
});
I18n.resolver("__painList", entries =>
  (entries || [])
    .map(([exerciseId, joint]) => `${exName(exerciseId)} (${jointLabel(joint)})`)
    .join(I18n.isRTL() ? "، " : ", "));
