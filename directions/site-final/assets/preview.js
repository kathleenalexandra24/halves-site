/*
  Preview-only shim. On the shared preview link (github.io) there is no Halves API, so this
  answers the sign-up request locally with a 201 and sends nothing anywhere. On any other host
  (meethalves.com) it does nothing, and the form posts to /api/waitlist as before.
*/
(function () {
  "use strict";
  if (!/\.github\.io$/.test(location.hostname)) return;
  var realFetch = window.fetch;
  window.fetch = function (url, opts) {
    if (String(url).indexOf("api/waitlist") !== -1) {
      return Promise.resolve(new Response(JSON.stringify({ status: "preview" }), { status: 201, headers: { "Content-Type": "application/json" } }));
    }
    return realFetch.apply(this, arguments);
  };
})();
