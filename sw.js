/* ============================================================================
   GymBuddy 2.0 — sw.js
   ----------------------------------------------------------------------------
   The service worker is what turns the site into an app you can actually use
   in a gym: it opens instantly from the home screen, and it keeps working in
   the basement squat rack where there is no signal at all. Nothing here talks
   to a server — there isn't one — so this is purely about the files.

   Two caches, deliberately separate:

     SHELL   the eight pages, the stylesheet and every script. Small, and
             replaced wholesale whenever VERSION changes.
     MEDIA   exercise photographs and clips, six megabytes of them. Filled as
             they are actually viewed and kept across shell updates, because
             re-downloading the library on every release would be rude to
             somebody on a phone plan.

   Update policy: a new worker installs in the background but does NOT take
   over mid-session — swapping the scripts under a page that is halfway
   through a set is how you lose a set. It waits, the page notices and offers
   "update ready", and the swap happens on a tap. See ui.js.

   Bump VERSION whenever a shell file changes.
   ============================================================================ */

const VERSION = "v1";
const SHELL = `gymbuddy-shell-${VERSION}`;
const MEDIA = "gymbuddy-media";

/* Relative paths, resolved against the worker's own scope, so the app works
   the same at the root of a domain or in a project subdirectory on Pages. */
const SHELL_FILES = [
  "./",
  "index.html",
  "program.html",
  "exercises.html",
  "workout.html",
  "diet.html",
  "coach.html",
  "progress.html",
  "profile.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/i18n.js",
  "js/i18n/en.js",
  "js/i18n/ar.js",
  "js/i18n/content.ar.js",
  "js/data/library.js",
  "js/data/coaching.js",
  "js/data/labels.js",
  "js/data/nutrition.js",
  "js/templates.js",
  "js/engine/periodization.js",
  "js/engine/progression.js",
  "js/engine/scheduler.js",
  "js/engine/analysis.js",
  "js/engine/adaptation.js",
  "js/engine/coach.js",
  "js/engine/nutrition.js",
  "js/storage.js",
  "js/ui.js",
  "js/pages/index.js",
  "js/pages/program.js",
  "js/pages/exercises.js",
  "js/pages/workout.js",
  "js/pages/diet.js",
  "js/pages/coach.js",
  "js/pages/progress.js",
  "js/pages/profile.js",
  "assets/img/favicon.svg",
  "assets/img/apple-touch-icon.png",
  "assets/img/icon-192.png",
  "assets/img/icon-512.png",
];

const isMedia = url => /\/assets\/(photos|clips)\//.test(url.pathname);

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    /* One failure — a file renamed and not listed here — would otherwise
       reject the whole install and leave the app with no worker at all, so
       each file is added on its own and a miss is logged rather than fatal. */
    await Promise.all(SHELL_FILES.map(file =>
      cache.add(new Request(file, { cache: "reload" }))
        .catch(err => console.warn("[sw] could not precache", file, err))));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(n => n.startsWith("gymbuddy-shell-") && n !== SHELL)
      .map(n => caches.delete(n)));
    /* Navigation preload would race the cache lookup for no gain here: every
       navigation is answered from the cache first anyway. */
    await self.clients.claim();
  })());
});

/* The page asks for the swap once the lifter has said yes to it. */
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // nothing else is ours

  /* ---- Photos and clips: cache-first, kept forever ----
     A clip never changes once built; if it is on the phone, use it. */
  if (isMedia(url)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(MEDIA)).put(request, response.clone());
        return response;
      } catch (err) {
        /* Offline and never viewed: let the <img> fall back to its own
           broken-image handling rather than hanging. */
        return Response.error();
      }
    })());
    return;
  }

  /* ---- Everything else: straight from the cache ----
     The shell is precached in full at install, so there is nothing to
     revalidate per request: every file in it changes only when a release
     changes VERSION, and the browser re-checks sw.js on every navigation
     anyway, which is what picks a release up. Revalidating each file on top of
     that was 18 redundant requests per page load — and, because the page reads
     the cached copy and never reads the network one, 18 response bodies left
     unread, which ties up connections until they are collected. */
  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const response = await fetch(request);
      /* Something in scope that the precache list does not name — keep it, so
         it is there next time whether or not there is signal. */
      if (response.ok && response.type === "basic") {
        cache.put(request, response.clone());
      }
      return response;
    } catch (err) {
      /* A page we have never seen, with no connection. The shell is cached, so
         falling back to the home page is better than the browser's dinosaur. */
      if (request.mode === "navigate") {
        const home = await cache.match("index.html");
        if (home) return home;
      }
      return Response.error();
    }
  })());
});
