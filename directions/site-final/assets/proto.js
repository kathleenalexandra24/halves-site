/*
  Landing page: interactive app demo. Plain JavaScript, no libraries, no network, no storage.
  Everything the visitor picks stays in this page and is never sent anywhere.

  1. Matching logic (computed from the visitor's own picks)
  2. Screens and handlers
  3. Autoplay loop (pausable, pauses off-screen / hidden tab, off under reduced motion)
  4. Page polish (header, scroll reveal, "Try this step")
*/
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 1. Matching ---------------------------------------------------------- */
  // Example people. Not real members. Each lists what they put first and what they look for.
  var PEOPLE = [
    { name: "Jordan", has: ["Kindness", "Family", "Quiet nights", "Honesty"], looks: ["Kindness", "Family", "Quiet nights", "Honesty", "Humor"] },
    { name: "Sam", has: ["Curiosity", "Adventure", "Humor", "Creativity"], looks: ["Curiosity", "Adventure", "Humor", "Creativity", "Kindness"] },
    { name: "Riley", has: ["Ambition", "Fitness", "Honesty", "Humor"], looks: ["Ambition", "Fitness", "Honesty", "Humor", "Adventure"] }
  ];
  var DEFAULT_PICKS = ["Kindness", "Family", "Curiosity"];

  function overlap(a, b) { return a.filter(function (x) { return b.indexOf(x) !== -1; }); }
  function minus(a, b) { return a.filter(function (x) { return b.indexOf(x) === -1; }); }
  function words(list) {
    var l = list.map(function (s) { return s.toLowerCase(); });
    if (l.length < 2) return l.join("");
    return l.slice(0, -1).join(", ") + " and " + l[l.length - 1];
  }

  // Both ways: you must fit what they put first AND they must fit what you look for.
  function match(picks) {
    var best = null;
    PEOPLE.forEach(function (p) {
      var you = overlap(picks, p.has);      // what you picked that they also put first
      var them = overlap(picks, p.looks);   // what they look for that you put on your list
      var score = Math.min(you.length, them.length) * 10 + you.length + them.length;
      if (!best || score > best.score) best = { p: p, you: you, them: them, score: score };
    });
    var p = best.p, shared = best.you, back = best.them;
    var yourOnly = minus(picks, p.has);
    var theirOnly = minus(p.has, picks);
    return {
      name: p.name,
      head: "You both put " + words(shared) + " first.",
      like: "They put " + words(shared) + " first, like you.",
      liked: "They’re looking for " + words(back) + ". You put " + (back.length > 1 ? "those" : "that") + " on your list.",
      diff: yourOnly.length && theirOnly.length ? "You put " + words(yourOnly.slice(0, 1)) + " on your list; they lead with " + words(theirOnly.slice(0, 1)) + "." : ""
    };
  }

  /* 2. Screens ----------------------------------------------------------- */
  var phone = document.getElementById("demo");
  if (!phone) { page(); return; }

  var $ = function (id) { return document.getElementById(id); };
  var screens = [].slice.call(phone.querySelectorAll(".screen"));
  var jumpBtns = [].slice.call(document.querySelectorAll("[data-jump]"));
  var chipBtns = [].slice.call(phone.querySelectorAll("[data-chip]"));
  var feelBtns = [].slice.call(phone.querySelectorAll("[data-feel]"));
  var noteBtns = [].slice.call(phone.querySelectorAll("[data-note]"));
  var s = { screen: 1, picks: [], firm: false, feel: "", notes: [], timer: 0, result: null };

  function pop(el) {
    if (reduce) return;
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  }

  function renderPicks() {
    chipBtns.forEach(function (b) { b.setAttribute("aria-pressed", s.picks.indexOf(b.dataset.chip) !== -1 ? "true" : "false"); });
    $("pick-count").textContent = s.picks.length + " of 3";
    var go = $("go-intro");
    go.disabled = s.picks.length === 0;
    go.textContent = s.picks.length ? "See my introduction" : "Pick one to continue";
    $("firm-switch").setAttribute("aria-checked", s.firm ? "true" : "false");
  }

  function togglePick(name) {
    var i = s.picks.indexOf(name);
    if (i !== -1) s.picks.splice(i, 1);
    else { if (s.picks.length === 3) s.picks.shift(); s.picks.push(name); }
    renderPicks();
    var b = chipBtns.filter(function (x) { return x.dataset.chip === name; })[0];
    if (b && i === -1) pop(b);
  }

  function setFirm(v) { s.firm = v; renderPicks(); }

  function renderIntro() {
    if (!s.picks.length) s.picks = DEFAULT_PICKS.slice();
    renderPicks();
    var m = s.result = match(s.picks);
    $("i-name").textContent = m.name;
    $("i-avatar").textContent = m.name.charAt(0);
    $("f-name").textContent = m.name;
    $("i-head").textContent = m.head;
    $("i-like").textContent = m.like;
    $("i-liked").textContent = m.liked;
    $("i-firm").hidden = !s.firm;
    var sc = screens[1];
    sc.classList.remove("is-ready");
    window.clearTimeout(s.timer);
    // "Checking both ways" for a moment, then the card builds in.
    s.timer = window.setTimeout(function () { sc.classList.add("is-ready"); }, reduce ? 0 : 1500);
  }

  function resetFeedback() {
    s.feel = ""; s.notes = [];
    feelBtns.forEach(function (b) { b.setAttribute("aria-checked", "false"); });
    noteBtns.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    $("fb-form").hidden = false; $("fb-done").hidden = true;
    var send = $("send-fb"); send.disabled = true; send.textContent = "Pick how it went";
  }

  function show(n, focus) {
    if (n === 2 && s.screen !== 2) renderIntro();
    if (n === 3) { if (!s.picks.length) { s.picks = DEFAULT_PICKS.slice(); } if (!s.result) s.result = match(s.picks); $("f-name").textContent = s.result.name; if (s.screen !== 3) resetFeedback(); }
    s.screen = n;
    screens.forEach(function (el, i) {
      var on = i + 1 === n;
      el.classList.toggle("is-active", on);
      el.classList.toggle("is-before", i + 1 < n);
      if (on) { el.removeAttribute("inert"); el.removeAttribute("aria-hidden"); }
      else { el.setAttribute("inert", ""); el.setAttribute("aria-hidden", "true"); }
      if (on) el.scrollTop = 0;
    });
    jumpBtns.forEach(function (b) {
      if (+b.dataset.jump === n) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    if (focus) {
      var h = screens[n - 1].querySelector(".app-title, .visually-hidden[tabindex]");
      if (h) h.focus({ preventScroll: true });
    }
  }

  function pickFeel(v) {
    s.feel = v;
    feelBtns.forEach(function (b) { b.setAttribute("aria-checked", b.dataset.feel === v ? "true" : "false"); });
    var send = $("send-fb"); send.disabled = false; send.textContent = "Send private feedback";
    var b = feelBtns.filter(function (x) { return x.dataset.feel === v; })[0]; if (b) pop(b);
  }
  function toggleNote(v) {
    var i = s.notes.indexOf(v); if (i === -1) s.notes.push(v); else s.notes.splice(i, 1);
    noteBtns.forEach(function (b) { b.setAttribute("aria-pressed", s.notes.indexOf(b.dataset.note) !== -1 ? "true" : "false"); });
    var b = noteBtns.filter(function (x) { return x.dataset.note === v; })[0]; if (b && i === -1) pop(b);
  }
  function sendFeedback(focus) {
    $("fb-form").hidden = true; $("fb-done").hidden = false;
    if (focus) $("s3-done").focus({ preventScroll: true });
  }
  function resetAll() {
    s.picks = []; s.firm = false; s.result = null; s.screen = 1;
    renderPicks(); resetFeedback(); show(1, false);
  }

  // Visitor events
  chipBtns.forEach(function (b) { b.addEventListener("click", function () { manual(); togglePick(b.dataset.chip); }); });
  $("firm-switch").addEventListener("click", function () { manual(); setFirm(!s.firm); });
  $("go-intro").addEventListener("click", function () { manual(); show(2, true); });
  $("go-feedback").addEventListener("click", function () { manual(); show(3, true); });
  feelBtns.forEach(function (b) { b.addEventListener("click", function () { manual(); pickFeel(b.dataset.feel); }); });
  noteBtns.forEach(function (b) { b.addEventListener("click", function () { manual(); toggleNote(b.dataset.note); }); });
  $("send-fb").addEventListener("click", function () { manual(); sendFeedback(true); });
  $("replay").addEventListener("click", function () { manual(); resetAll(); show(1, true); });
  jumpBtns.forEach(function (b) { b.addEventListener("click", function () { manual(); show(+b.dataset.jump, true); }); });
  // Radio group arrow keys
  var radios = $("fb-form").querySelector('[role="radiogroup"]');
  radios.addEventListener("keydown", function (e) {
    var k = e.key, i = feelBtns.indexOf(document.activeElement);
    if (i === -1 || ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].indexOf(k) === -1) return;
    e.preventDefault();
    var n = feelBtns[(i + (k === "ArrowRight" || k === "ArrowDown" ? 1 : feelBtns.length - 1)) % feelBtns.length];
    n.focus(); manual(); pickFeel(n.dataset.feel);
  });

  /* 3. Autoplay loop ----------------------------------------------------- */
  // A short scripted run using the same functions the visitor uses. It loops until the
  // visitor touches the demo or presses Pause. Reduced motion: no loop, a still intro screen.
  var pauseBtn = $("pause"), hint = $("demo-hint");
  var A = { on: false, i: 0, t: 0, userPaused: false, hiddenView: false, offscreen: false };
  var SCRIPT = [
    [500, resetAll],
    [1000, function () { togglePick("Kindness"); }],
    [800, function () { togglePick("Family"); }],
    [800, function () { togglePick("Quiet nights"); }],
    [900, function () { setFirm(true); }],
    [1100, function () { show(2, false); }],
    [6200, function () { show(3, false); }],
    [1300, function () { pickFeel("Great"); }],
    [900, function () { toggleNote("Easy to talk to"); }],
    [1000, function () { sendFeedback(false); }],
    [3600, function () { /* hold on the thank-you, then loop */ }]
  ];

  function tick() {
    window.clearTimeout(A.t);
    if (!A.on || A.userPaused || A.hiddenView || A.offscreen) return;
    var step = SCRIPT[A.i];
    A.t = window.setTimeout(function () {
      step[1]();
      A.i = (A.i + 1) % SCRIPT.length;
      tick();
    }, step[0]);
  }
  function syncUI() {
    var running = A.on && !A.userPaused;
    pauseBtn.dataset.state = running ? "playing" : "paused";
    $("pause-text").textContent = running ? "Pause animation" : "Play animation";
    document.documentElement.classList.toggle("is-paused", !running);
    hint.textContent = A.on ? (A.userPaused ? "Animation paused. Tap anything." : "Watching a short tour. Tap to take over.") : "Your turn. Tap anything.";
  }
  function manual() {      // the visitor took over
    if (!A.on) return;
    A.on = false; window.clearTimeout(A.t); syncUI();
  }
  pauseBtn.addEventListener("click", function () {
    if (A.on && !A.userPaused) { A.userPaused = true; window.clearTimeout(A.t); }
    else { A.on = true; A.userPaused = false; A.i = 0; tick(); }
    syncUI();
  });
  document.addEventListener("visibilitychange", function () { A.hiddenView = document.hidden; tick(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { A.offscreen = !e[0].isIntersecting; tick(); }, { threshold: 0.2 }).observe(phone);
  }

  renderPicks(); resetFeedback();
  if (reduce) {
    // Static final state: a finished introduction, built from the default picks.
    A.on = false; pauseBtn.hidden = true; s.picks = DEFAULT_PICKS.slice(); renderPicks(); show(2, false); syncUI();
  } else {
    A.on = true; syncUI(); tick();
  }

  /* 4. Page polish ------------------------------------------------------- */
  page();
  function page() {
    var hdr = document.querySelector(".site-header");
    if (hdr) {
      var onScroll = function () { hdr.classList.toggle("is-stuck", window.scrollY > 8); };
      onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    }
    // Scroll reveal
    var items = [].slice.call(document.querySelectorAll(".section .wrap > *, .strip, .promise-line p"));
    if ("IntersectionObserver" in window && !reduce) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
      }, { rootMargin: "0px 0px -8% 0px" });
      items.forEach(function (el) { el.setAttribute("data-reveal", ""); io.observe(el); });
    }
    // "Try this step" buttons jump the demo to that screen
    [].slice.call(document.querySelectorAll("[data-try]")).forEach(function (b) {
      b.addEventListener("click", function () {
        var d = document.getElementById("try");
        if (d) d.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        var j = document.querySelector('[data-jump="' + b.dataset.try + '"]');
        if (j) { window.setTimeout(function () { j.click(); }, reduce ? 0 : 350); }
      });
    });
  }
})();
