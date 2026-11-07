/* Halves landing page: looping hero phone + scroll-driven story phone. Vanilla JS, no deps. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var names = ["Priorities", "Introduction", "After-date feedback"];

  function show(screens, idx) {
    screens.forEach(function (el, i) {
      el.classList.toggle("is-active", i === idx);
      el.classList.toggle("is-past", i < idx);
    });
  }

  /* Strip phones are static: show their only screen. */
  $$(".phone-sm .screen").forEach(function (el) { el.classList.add("is-active"); });

  /* 1. Hero loop ------------------------------------------------------- */
  (function hero() {
    var stage = $("#hero-stage");
    if (!stage) return;
    var screens = $$(".screen", stage);
    var dots = $$(".dots button", stage);
    var pause = $("#loop-pause");
    var live = $("#loop-live");
    var DUR = 4600;
    var idx = 0, userPaused = false, visible = true, tabVisible = !document.hidden;
    var start = 0, elapsed = 0, raf = 0, running = false;

    function paint() {
      show(screens, idx);
      dots.forEach(function (d, i) { d.classList.toggle("on", i === idx); d.setAttribute("aria-current", i === idx ? "true" : "false"); });
    }
    function setProg(f) {
      var d = dots[idx];
      if (d) d.style.setProperty("--prog", f.toFixed(3));
    }
    function tick(t) {
      if (!running) return;
      elapsed = t - start;
      setProg(Math.min(1, elapsed / DUR));
      if (elapsed >= DUR) { go((idx + 1) % screens.length, true); start = t; elapsed = 0; }
      raf = requestAnimationFrame(tick);
    }
    function go(i, auto) {
      if (dots[idx]) dots[idx].style.removeProperty("--prog");
      idx = i; paint(); setProg(0);
      if (!auto && live && userPaused) live.textContent = "Showing " + names[idx] + " screen";
    }
    function sync() {
      stage.classList.toggle("is-paused", userPaused || !running && !(visible && tabVisible));
      var should = !userPaused && visible && tabVisible && !reduce.matches;
      if (should && !running) { running = true; start = performance.now() - elapsed; raf = requestAnimationFrame(tick); }
      else if (!should && running) { running = false; cancelAnimationFrame(raf); }
      pause.setAttribute("aria-pressed", String(userPaused || reduce.matches));
      $(".pause-t", pause).textContent = userPaused || reduce.matches ? "Play" : "Pause";
      pause.setAttribute("aria-label", userPaused || reduce.matches ? "Play app preview animation" : "Pause app preview animation");
    }
    dots.forEach(function (d, i) {
      d.addEventListener("click", function () { elapsed = 0; start = performance.now(); go(i, false); setProg(reduce.matches || userPaused ? 1 : 0); });
    });
    pause.addEventListener("click", function () {
      
      userPaused = !userPaused;
      sync();
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; sync(); }, { threshold: 0.1 }).observe(stage);
    }
    document.addEventListener("visibilitychange", function () { tabVisible = !document.hidden; sync(); });
    reduce.addEventListener && reduce.addEventListener("change", function () { if (reduce.matches) { idx = 1; paint(); } sync(); });

    /* Reduced motion: no autoplay. Rest on the introduction screen (the Why-you're-meeting card). */
    if (reduce.matches) { idx = 1; }
    paint(); setProg(1);
    sync();
  })();

  /* 2. Story: the sticky phone follows scroll ---------------------------- */
  (function story() {
    var grid = $("#story");
    if (!grid) return;
    var steps = $$(".chap", grid);
    var screens = $$(".screen", grid);
    var cL = $("#ringL"), cR = $("#ringR2"), cR2 = $("#ringR"), clip = $("#clipC");
    var cur = -1, ticking = false;

    function setRings(p) {
      var d = 165 - 95 * p;           /* half-distance between ring centres: apart -> overlapping */
      var l = 320 - d, r = 320 + d;
      cL.setAttribute("cx", l); clip.setAttribute("cx", l);
      cR.setAttribute("cx", r); cR2.setAttribute("cx", r);
    }
    function update() {
      ticking = false;
      var vh = window.innerHeight;
      var wide = window.innerWidth >= 900;
      var thr = vh * (wide ? 0.45 : 0.4);
      var idx = 0;
      steps.forEach(function (s, i) { if (s.getBoundingClientRect().top <= thr) idx = i; });
      if (idx !== cur) {
        cur = idx; show(screens, idx);
        steps.forEach(function (s, i) { s.classList.toggle("is-active", i === idx); });
        $$(".cap", grid).forEach(function (c, i) { c.classList.toggle("is-active", i === idx); });
      }
      var first = steps[0].getBoundingClientRect();
      var h = steps[1].getBoundingClientRect().top - first.top || 1;
      var f = Math.max(0, Math.min(2, (thr - first.top) / h));
      setRings(f / 2);
    }
    function req() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener("scroll", req, { passive: true });
    window.addEventListener("resize", req);
    update();
  })();
})();
