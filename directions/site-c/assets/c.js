/* Halves hero: looping phone story. Vanilla JS. Pause button, pauses off-screen and in hidden tabs.
   Reduced motion: static final picture (merged screen), no animation, no controls. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");
  var reel = document.getElementById("reel");
  var btn = document.getElementById("replay");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reel && !reduce.matches) {
    reel.classList.add("play");
    btn.hidden = false;
    btn.textContent = "Pause animation";
    btn.setAttribute("aria-pressed", "false");
    var user = false;
    btn.addEventListener("click", function () {
      user = !user;
      reel.classList.toggle("is-paused", user);
      btn.textContent = user ? "Play animation" : "Pause animation";
      btn.setAttribute("aria-pressed", String(user));
    });
    var hidden = function () { reel.classList.toggle("is-off", off || document.hidden); };
    var off = false;
    document.addEventListener("visibilitychange", hidden);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { off = !e[0].isIntersecting; hidden(); }, { threshold: 0.05 }).observe(reel);
    }
    reduce.addEventListener && reduce.addEventListener("change", function () { if (reduce.matches) { reel.classList.remove("play"); btn.hidden = true; } });
  }
  var ms = document.querySelectorAll(".moment");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: 0.15 });
    ms.forEach(function (m) { io.observe(m); });
  } else { ms.forEach(function (m) { m.classList.add("in"); }); }
})();
