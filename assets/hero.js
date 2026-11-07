/*
  Halves hero animation. Plain JavaScript (Web Animations API), no libraries.
  Story, about 4 seconds, then a short hold and a fade, then it loops. A Pause button (WCAG 2.2.2)
  freezes it on the finished picture; it also rests while off screen or in a hidden tab:
    1. A and B arrive, their priorities appear one by one.
    2. The priorities they share lift out and fly to the overlap of the two rings.
    3. The rings slide together and the coral overlap, the match, opens.
    4. A "Why you're meeting" card rises with the reason.
  With reduced motion the finished picture is shown and nothing moves.
*/
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var stage = document.getElementById("stage");
  if (!stage) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || stage).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || stage).querySelectorAll(s)); };

  var people = $$(".person");
  var chips = $$(".chip");
  var shared = $$("[data-shared]");
  var own = $$(".chip-own");
  var ringL = $(".mark-ring-l"), ringR = $(".mark-ring-r"), lens = $(".mark-lens");
  var markEl = $(".mark");
  var why = $("#why-card");
  var replay = $("#replay");
  var running = [];

  function ease(name) {
    return name === "out" ? "cubic-bezier(0.16, 1, 0.3, 1)" : "cubic-bezier(0.45, 0, 0.2, 1)";
  }

  function clear() {
    running.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    running = [];
    chips.forEach(function (c) { c.classList.remove("is-flying"); c.style.visibility = ""; });
    $$(".fly-clone", document.body).forEach(function (n) { n.remove(); });
  }

  function anim(el, frames, opts) {
    var a = el.animate(frames, Object.assign({ fill: "both", easing: ease("out") }, opts));
    running.push(a);
    return a;
  }

  var timers = [];
  function later(fn, ms) { var id = window.setTimeout(fn, ms); timers.push(id); return id; }
  function stopTimers() { timers.forEach(window.clearTimeout); timers = []; }

  function play(instant) {
    stopTimers();
    clear();
    var out = ease("out"), inn = ease("in");

    // 0.1s  A and B arrive
    people.forEach(function (p, i) {
      anim(p, [{ opacity: 0, transform: "translateX(" + (i ? 28 : -28) + "px)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: 100 });
    });
    // 0.7s  their priorities appear one by one
    chips.forEach(function (c, i) {
      anim(c, [{ opacity: 0, transform: "translateY(8px) scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 450, delay: 700 + i * 90 });
    });
    // 1.9s  priorities that are not shared step back
    own.forEach(function (c) {
      anim(c, [{ opacity: 1 }, { opacity: 0.35 }], { duration: 600, delay: 1900, composite: "replace", easing: "ease" });
    });
    // 1.7s  shared priorities lift out and fly into the middle (positions measured once the people have settled)
    function fly() {
      var t = markEl.getBoundingClientRect();
      var cx = t.left + t.width / 2, cy = t.top + t.height / 2;
      shared.forEach(function (c) {
        var r = c.getBoundingClientRect();
        var dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
        c.classList.add("is-flying");
        anim(c, [
          { opacity: 1, transform: "none" },
          { opacity: 1, transform: "translate(" + dx * 0.1 + "px," + (dy * 0.1 - 8) + "px) scale(1.08)", offset: 0.25 },
          { opacity: 1, transform: "translate(" + dx + "px," + dy + "px) scale(.5)", offset: 0.85 },
          { opacity: 0, transform: "translate(" + dx + "px," + dy + "px) scale(.2)" }
        ], { duration: 1300, delay: 800, easing: inn });
      });
    }
    if (instant) { fly(); } else { later(fly, 900); }
    // 2.0s  the two rings are drawn together
    anim(ringL, [{ transform: "translateX(-30px)" }, { transform: "translateX(0)" }], { duration: 1000, delay: 2000, easing: out });
    anim(ringR, [{ transform: "translateX(30px)" }, { transform: "translateX(0)" }], { duration: 1000, delay: 2000, easing: out });
    // 2.7s  the overlap, the match, opens
    anim(lens, [{ opacity: 0, transform: "scale(.1, .3)" }, { opacity: 1, transform: "scale(1.14)", offset: 0.65 }, { opacity: 1, transform: "scale(1)" }], { duration: 800, delay: 2700, easing: out });
    // 3.3s  the reason rises
    anim(why, [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: 3300 });

    if (instant) { running.forEach(function (a) { a.finish(); }); }
  }

  function finalState() {
    chips.forEach(function (c) { c.style.opacity = c.hasAttribute("data-shared") ? "1" : "0.55"; });
    if (replay) replay.hidden = true;
  }

  // Reveal-on-scroll for the rest of the page
  function setupReveal() {
    var els = $$(".section > .wrap, .section .pair-half, .section .step", document);
    if (reduce || !("IntersectionObserver" in window)) return;
    els.forEach(function (e) { e.classList.add("reveal"); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach(function (e) { io.observe(e); });
  }

  // Loop: play (about 4.3s), hold the finished picture, fade out, play again
  var HOLD = 2600, FADE = 450, CYCLE = 4300;
  var userPaused = false, visible = false;
  var fadeTargets = [].concat($$(".stage-people"), [why]);

  function cycle() {
    stopTimers();
    fadeTargets.forEach(function (n) { n.style.opacity = ""; });
    play(false);
    later(function () {
      var fades = fadeTargets.map(function (n) { return n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, fill: "forwards" }); });
      running = running.concat(fades);
      later(cycle, FADE + 80);
    }, CYCLE + HOLD);
  }

  function setLabel() {
    if (!replay) return;
    replay.textContent = userPaused ? "Play animation" : "Pause animation";
    replay.setAttribute("aria-pressed", userPaused ? "true" : "false");
  }

  function freezeOnFinish() { stopTimers(); play(true); }

  function sync() {
    if (userPaused) return;
    if (visible && !document.hidden) { cycle(); } else { stopTimers(); }
  }

  if (replay) {
    replay.hidden = reduce;
    setLabel();
    replay.addEventListener("click", function () {
      userPaused = !userPaused;
      setLabel();
      if (userPaused) { freezeOnFinish(); } else { cycle(); }
    });
  }

  if (reduce) { finalState(); } else {
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        var now = en[0].isIntersecting;
        if (now === visible) return;
        visible = now;
        sync();
      }, { threshold: 0.35 }).observe(stage);
    } else { visible = true; sync(); }
    document.addEventListener("visibilitychange", sync);
  }
  setupReveal();
})();
