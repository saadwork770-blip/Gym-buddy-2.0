/* ============================================================================
   GymBuddy — data/library.js
   ----------------------------------------------------------------------------
   The exercise library and the source program, and nothing else.

   Everything here is content: what each movement is called, how to do it,
   what it looks like, and the four-day plan the app was originally built
   around — "4-Day Fat Loss Program, Fitness Time (Standard Commercial Gym)".
   The English text in this file is the source text; it is registered into the
   English dictionary by data/labels.js rather than being duplicated into a
   translation file.

   What is NOT here is anything the coaching engine reasons about. Movement
   patterns, load types, joint stress and volume landmarks all live in
   data/coaching.js, which merges them onto these entries at load time. The two
   change for completely different reasons — one when a new exercise is added,
   the other when the coaching model changes — and keeping them apart is what
   stopped this being a 1500-line file.

   Load order: library.js, then coaching.js, then labels.js.
   ============================================================================ */


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
    "Pictured: the abduction (outer thigh) machine. Adduction is the same machine set the other way, with the pads inside your knees instead of outside them.",
  "machine-chest-supported-row":
    "Pictured: a leverage high row — the same chest-supported setup, pulling from a higher angle.",
  "incline-treadmill-walk":
    "Pictured: treadmill walking. This program calls for a moderate incline rather than a flat walk.",
};

function photoFor(id){ return `assets/photos/${id}.jpg`; }
function clipFor(id){ return `assets/clips/${id}.webm`; }

function exerciseById(id){ return EXERCISES.find(e => e.id === id); }
function exercisesForDay(day){ return EXERCISES.filter(e => e.day === day); }

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
    id: "cable-lateral-raise", name: "Seated Cable Lateral Raise", day: null,
    dayLabel: "Library", equipment: "Cable", muscle: "shoulders", icon: "cable",
    sets: "3 x 12–15",
    steps: [
      "Sit on a low bench between two low pulleys and take the left handle in your right hand and the right handle in your left, so the cables cross in front of your shins.",
      "With a slight, fixed bend in each elbow, raise both arms out to the side to shoulder height.",
      "Lead with the elbows and keep your shoulders down away from your ears.",
      "Lower slowly — crossed cables keep tension at the bottom, where dumbbells lose it entirely.",
    ],
    tips: [
      "Sitting takes the legs and lower back out of it, so nothing helps you cheat the weight up.",
      "Smoother resistance curve than dumbbells; good when 2 kg jumps feel too big.",
    ],
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

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const DAY_SHORT  = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
