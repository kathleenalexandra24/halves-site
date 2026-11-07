/*
  Halves site script. Plain JavaScript, no build step, no third-party code,
  and it sets no cookies itself. The only thing it keeps in the browser is the
  ?ref= / ?utm_source= tag, in sessionStorage for the current tab, so it is
  still sent with the sign-up after a visit to the privacy notice.

  Analytics lives in assets/analytics.js (Google Analytics, only on the
  hosts in its PRODUCTION_HOSTS, never for a browser that sends Global
  Privacy Control). This file
  only tells it that a sign-up happened (reportSignUp below), and only when
  analytics.js turned it on. It never passes anything the visitor typed.

  Layout of this file:
  1. MESSAGES: every user-facing string this script shows. Edit copy here.
  2. Small helpers (API call, reading the page URL).
  3. Waitlist form: validation, submit, response handling, success state.
  4. Start-up: each feature checks that its markup exists, so this file can be
     loaded on any page and new features (accounts, survey) can be added as
     more init functions at the bottom.

  The API contract this follows (POST /api/waitlist) is described in
  site/README.md and, for the API side, in the Halves-Server repo's
  api/README.md.
*/
(function () {
  "use strict";

  /* 1. MESSAGES ---------------------------------------------------------- */
  var MESSAGES = {
    emailRequired: "Add your email so we can reach you.",
    emailInvalid: "That email looks off. Try something like name@example.com.",
    emailTooLong: "That email is too long. Use one with 254 characters or fewer.",
    firstNameRequired: "Add your first name so we can say hello.",
    firstNameTooLong: "Keep your first name to 60 characters or fewer.",
    firstNameInvalid: "Use up to 60 characters, with no tabs or odd symbols.",
    lastNameRequired: "Add your last name.",
    lastNameTooLong: "Keep your last name to 80 characters or fewer.",
    lastNameInvalid: "Use up to 80 characters, with no tabs or odd symbols.",
    ageRequired: "Add your age.",
    ageInvalid: "Use a whole number from 18 to 99.",
    ageUnder18: "Halves is for adults 18 and older. We can't add you yet.",
    zipRequired: "Add your 5-digit ZIP code.",
    zipInvalid: "ZIP codes have 5 digits. Check yours and try again.",
    consentRequired: "Tick this box to join, so we know you're happy to hear from us.",
    fixFields: "Almost there. A few details need another look. Check the notes under each field.",
    buttonSending: "Joining…",
    tooManyTries: "That's a lot of tries in a row. Wait a minute and try again.",
    serverError: "That's on us, not you. You're not on the list yet. Try again in a moment.",
    networkError: "We couldn't reach Halves, so you're not on the list yet. Check your connection and try again.",
    unknownError: "Something went wrong and we couldn't add you. Please try again.",
    shareTitle: "Halves",
    shareText: "Halves introduces people only when the fit works both ways. Join the founding pool:",
    shareButtonShare: "Share link",
    shareButtonCopy: "Copy link",
    shareCopied: "Link copied.",
    shareCopyFailed: "Select the link above and copy it to share."
  };

  /* 2. Helpers ------------------------------------------------------------ */
  var REQUEST_TIMEOUT_MS = 15000;

  // POST a JSON body and resolve with the fetch Response. Rejects on network
  // failure or timeout, so callers can tell "no answer" apart from an HTTP error.
  // Uses then() rather than finally() so older browsers without finally() still
  // settle the promise.
  function postJSON(url, body) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS) : null;
    function clearTimer() {
      if (timer) window.clearTimeout(timer);
    }
    return window.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      clearTimer();
      return response;
    }, function (err) {
      clearTimer();
      throw err;
    });
  }

  var SOURCE_STORAGE_KEY = "halves_source";

  // Clean a source tag the same way the API cleans it (lowercase, keep
  // a-z 0-9 _ -, max 64 chars).
  function cleanSource(raw) {
    var clean = String(raw || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
    return clean || null;
  }

  // The tag in the current page URL: ?ref= first, else ?utm_source=. Links
  // the team posts use the utm_ tags (site/README.md, Link tagging); ?ref=
  // still works for older links.
  function sourceFromUrl() {
    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (err) {
      return null;
    }
    return cleanSource(params.get("ref") || params.get("utm_source"));
  }

  // Keep the URL tag for this browser tab (sessionStorage is cleared when the
  // tab closes), so a visitor who opens the privacy notice and comes back
  // through a link without the tag still counts as, for example, "share".
  // When storage is blocked the page works the same, just without this.
  function rememberSource() {
    var source = sourceFromUrl();
    if (!source) return;
    try {
      window.sessionStorage.setItem(SOURCE_STORAGE_KEY, source);
    } catch (err) {
      /* storage blocked: nothing to do */
    }
  }

  // Where the visitor came from: the page URL first, else the tag kept for
  // this tab by rememberSource().
  function readSource() {
    var source = sourceFromUrl();
    if (source) return source;
    try {
      return cleanSource(window.sessionStorage.getItem(SOURCE_STORAGE_KEY));
    } catch (err) {
      return null;
    }
  }

  // Pasted names can carry tabs or other control characters, which the API
  // rejects. Turn each run of them, and of any whitespace, into one space.
  function cleanName(value) {
    return String(value || "")
      .replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Count a successful sign-up in Google Analytics. window.gtag only exists
  // when assets/analytics.js turned analytics on (a PRODUCTION_HOSTS host,
  // with an ID, no Global Privacy Control). Sends the event name and a fixed method,
  // never the email, name, age, ZIP, source or any other form value. Wrapped
  // in try/catch so analytics can never break the form.
  function reportSignUp() {
    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "sign_up", { method: "waitlist" });
      }
    } catch (err) {
      /* analytics failed: the sign-up itself is already saved */
    }
  }

  // The link people are asked to share. Uses the live site address (so the
  // dev site and local previews share their own address), or the canonical
  // URL when the page is opened from disk or is on www (www redirects to
  // meethalves.com, so that case is only a fallback). The UTM tags
  // (site/README.md, Link tagging) show it as source "share" both in the
  // admin page and in Google Analytics.
  function buildShareUrl() {
    var base;
    var isWebPage = window.location.protocol === "http:" || window.location.protocol === "https:";
    if (isWebPage && window.location.hostname !== "www.meethalves.com") {
      base = window.location.origin + "/";
    } else {
      var canonical = document.querySelector('link[rel="canonical"]');
      base = canonical ? canonical.href : "https://meethalves.com/";
    }
    try {
      var url = new URL(base);
      url.search = "";
      url.hash = "";
      url.searchParams.set("utm_source", "share");
      url.searchParams.set("utm_medium", "referral");
      url.searchParams.set("utm_campaign", "waitlist");
      return url.toString();
    } catch (err) {
      return base;
    }
  }

  /* 3. Waitlist form ------------------------------------------------------ */
  var FIELD_ORDER = ["email", "first_name", "last_name", "age", "zip", "consent"];

  // Messages used when the API rejects a field (422). The API's own wording is
  // technical, so each field maps to the same plain message the page uses.
  // Email, first name, last name, age, ZIP code and consent are all required.
  // The API answers type "missing" for a required field that is left out, null
  // or blank, which gets the "Enter your ..." message below.
  var SERVER_MISSING_MESSAGES = {
    email: MESSAGES.emailRequired,
    first_name: MESSAGES.firstNameRequired,
    last_name: MESSAGES.lastNameRequired,
    age: MESSAGES.ageRequired,
    zip: MESSAGES.zipRequired,
    consent: MESSAGES.consentRequired
  };
  // Any other error type for the field. A first or last name can also be
  // rejected for control characters, so its general message covers that as
  // well as length.
  var SERVER_FIELD_MESSAGES = {
    email: MESSAGES.emailInvalid,
    first_name: MESSAGES.firstNameInvalid,
    last_name: MESSAGES.lastNameInvalid,
    age: MESSAGES.ageInvalid,
    zip: MESSAGES.zipInvalid,
    consent: MESSAGES.consentRequired
  };

  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function initWaitlist() {
    var form = document.getElementById("waitlist-form");
    if (!form) return;

    var status = document.getElementById("form-status");
    var success = document.getElementById("waitlist-success");
    var button = form.querySelector('button[type="submit"]');
    var buttonLabel = button.textContent;
    var endpoint = form.getAttribute("data-endpoint") || "/api/waitlist";
    var busy = false;

    var inputs = {
      email: form.elements.namedItem("email"),
      first_name: form.elements.namedItem("first_name"),
      last_name: form.elements.namedItem("last_name"),
      age: form.elements.namedItem("age"),
      zip: form.elements.namedItem("zip"),
      consent: form.elements.namedItem("consent"),
      website: form.elements.namedItem("website")
    };

    // The script shows its own inline messages instead of the browser's
    // bubbles. The form starts hidden in index.html and only appears once this
    // script runs: a plain browser post would send form data the API cannot
    // read, so without JavaScript only the noscript note shows.
    form.noValidate = true;
    form.hidden = false;

    rememberSource();

    function errorElement(name) {
      return document.getElementById(name + "-error");
    }

    function setFieldError(name, message) {
      var input = inputs[name];
      var el = errorElement(name);
      if (!input || !el) return;
      if (message) {
        input.setAttribute("aria-invalid", "true");
        el.textContent = message;
      } else {
        input.removeAttribute("aria-invalid");
        el.textContent = "";
      }
    }

    function clearAllErrors() {
      FIELD_ORDER.forEach(function (name) { setFieldError(name, ""); });
    }

    function setStatus(message, tone) {
      status.textContent = message || "";
      if (tone) {
        status.setAttribute("data-tone", tone);
      } else {
        status.removeAttribute("data-tone");
      }
    }

    function validateField(name) {
      var input = inputs[name];
      var value;
      switch (name) {
        case "email":
          value = input.value.trim();
          if (!value) return MESSAGES.emailRequired;
          if (value.length > 254) return MESSAGES.emailTooLong;
          if (!EMAIL_PATTERN.test(value)) return MESSAGES.emailInvalid;
          return "";
        case "first_name":
          value = cleanName(input.value);
          if (!value) return MESSAGES.firstNameRequired;
          return value.length > 60 ? MESSAGES.firstNameTooLong : "";
        case "last_name":
          value = cleanName(input.value);
          if (!value) return MESSAGES.lastNameRequired;
          return value.length > 80 ? MESSAGES.lastNameTooLong : "";
        case "age":
          if (input.validity && input.validity.badInput) return MESSAGES.ageInvalid;
          value = input.value.trim();
          if (!value) return MESSAGES.ageRequired;
          if (!/^\d{1,2}$/.test(value)) return MESSAGES.ageInvalid;
          value = parseInt(value, 10);
          if (value < 18) return MESSAGES.ageUnder18;
          return value <= 99 ? "" : MESSAGES.ageInvalid;
        case "zip":
          value = input.value.trim();
          if (!value) return MESSAGES.zipRequired;
          return /^\d{5}$/.test(value) ? "" : MESSAGES.zipInvalid;
        case "consent":
          return input.checked ? "" : MESSAGES.consentRequired;
        default:
          return "";
      }
    }

    function validateAll() {
      var errors = {};
      FIELD_ORDER.forEach(function (name) {
        var message = validateField(name);
        if (message) errors[name] = message;
      });
      return errors;
    }

    function showErrors(errors) {
      var first = null;
      FIELD_ORDER.forEach(function (name) {
        setFieldError(name, errors[name] || "");
        if (errors[name] && !first) first = name;
      });
      if (first) {
        setStatus(MESSAGES.fixFields, "error");
        inputs[first].focus();
      }
      return first !== null;
    }

    // Called only after validateAll() found no errors, so every required
    // field has a value.
    function buildPayload() {
      return {
        email: inputs.email.value.trim(),
        first_name: cleanName(inputs.first_name.value),
        last_name: cleanName(inputs.last_name.value),
        age: parseInt(inputs.age.value.trim(), 10),
        zip: inputs.zip.value.trim(),
        consent: inputs.consent.checked === true,
        source: readSource(),
        website: inputs.website ? inputs.website.value : ""
      };
    }

    function setBusy(isBusy) {
      busy = isBusy;
      button.disabled = isBusy;
      button.textContent = isBusy ? MESSAGES.buttonSending : buttonLabel;
      if (isBusy) {
        form.setAttribute("aria-busy", "true");
      } else {
        form.removeAttribute("aria-busy");
      }
    }

    // The page's message for one API error on a field this form knows about.
    function serverMessage(key, type) {
      if (type === "missing") return SERVER_MISSING_MESSAGES[key];
      if (key === "age" && type === "greater_than_equal") return MESSAGES.ageUnder18;
      if (key === "first_name" && type === "string_too_long") return MESSAGES.firstNameTooLong;
      if (key === "last_name" && type === "string_too_long") return MESSAGES.lastNameTooLong;
      return SERVER_FIELD_MESSAGES[key];
    }

    // Turn FastAPI's default 422 body ({"detail": [{"type": ..., "loc": [...]}]})
    // into {field: message} for the fields this form knows about: "missing"
    // gets the "Enter your ..." message, an age the API rejects as too low
    // ("greater_than_equal") the 18+ message, a first or last name that is too
    // long ("string_too_long") the length message.
    function errorsFrom422(data) {
      var errors = {};
      if (!data || !Array.isArray(data.detail)) return errors;
      data.detail.forEach(function (item) {
        var loc = item && Array.isArray(item.loc) ? item.loc : [];
        for (var i = loc.length - 1; i >= 0; i -= 1) {
          var key = String(loc[i]);
          if (Object.prototype.hasOwnProperty.call(SERVER_FIELD_MESSAGES, key)) {
            if (!errors[key]) errors[key] = serverMessage(key, item.type);
            break;
          }
        }
      });
      return errors;
    }

    function showSuccess(firstName) {
      var nameSlot = success.querySelector("[data-first-name]");
      if (nameSlot) nameSlot.textContent = firstName ? ", " + firstName : "";
      setStatus("");
      form.hidden = true;
      success.hidden = false;
      initShare(success);
      var heading = document.getElementById("success-title");
      if (heading) heading.focus();
    }

    // Keep the button reachable after it was disabled while sending.
    function restoreFocus() {
      if (!document.activeElement || document.activeElement === document.body) {
        button.focus();
      }
    }

    // Only 201 means the sign-up was saved (the API also answers 201 for an
    // email already on the list). 422 is a field error and 429 the rate limit.
    // Any other status, for example 400, 404, 405 or 413 from a proxy, or any
    // 5xx, gets a general "try again" message.
    function handleResponse(response, payload) {
      if (response.status === 201) {
        reportSignUp();
        showSuccess(payload.first_name);
        return Promise.resolve();
      }
      if (response.status === 422) {
        return response.json().then(function (data) {
          var errors = errorsFrom422(data);
          if (!showErrors(errors)) {
            setStatus(MESSAGES.unknownError, "error");
            restoreFocus();
          }
        }, function () {
          setStatus(MESSAGES.unknownError, "error");
          restoreFocus();
        });
      }
      if (response.status === 429) {
        setStatus(MESSAGES.tooManyTries, "error");
      } else if (response.status >= 500) {
        setStatus(MESSAGES.serverError, "error");
      } else {
        setStatus(MESSAGES.unknownError, "error");
      }
      restoreFocus();
      return Promise.resolve();
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (busy) return;

      setStatus("");
      var errors = validateAll();
      if (showErrors(errors)) return;
      clearAllErrors();

      var payload = buildPayload();
      var request;
      setBusy(true);

      // Whatever happens (no answer, an unexpected status, a script error
      // while handling the answer), the button ends up enabled again.
      try {
        request = postJSON(endpoint, payload);
      } catch (err) {
        request = Promise.reject(err);
      }

      request.then(function (response) {
        setBusy(false);
        return handleResponse(response, payload);
      }, function () {
        setBusy(false);
        setStatus(MESSAGES.networkError, "error");
        restoreFocus();
      }).then(null, function () {
        setBusy(false);
        if (!form.hidden) {
          setStatus(MESSAGES.unknownError, "error");
          restoreFocus();
        }
      });
    });

    // Once a field has an error, re-check it as the person types so the
    // message clears as soon as it is fixed.
    function recheck(event) {
      var name = event.target && event.target.name;
      if (!name || !inputs[name] || name === "website") return;
      if (inputs[name].getAttribute("aria-invalid") === "true") {
        setFieldError(name, validateField(name));
      }
      // When no field message is left, drop the "Some details need a fix"
      // summary too. Other messages (no connection, too many tries) stay until
      // the next submit.
      if (status.textContent === MESSAGES.fixFields && !form.querySelector('[aria-invalid="true"]')) {
        setStatus("");
      }
    }
    form.addEventListener("input", recheck);
    form.addEventListener("change", recheck);
  }

  function initShare(root) {
    var field = root.querySelector("#share-url");
    var button = root.querySelector("#share-button");
    var note = root.querySelector("#share-status");
    if (!field || !button) return;

    var shareUrl = buildShareUrl();
    field.value = shareUrl;
    field.addEventListener("focus", function () { field.select(); });

    if (button.getAttribute("data-ready") === "true") return;
    button.setAttribute("data-ready", "true");

    if (typeof navigator.share === "function") {
      button.textContent = MESSAGES.shareButtonShare;
      button.hidden = false;
      button.addEventListener("click", function () {
        navigator.share({ title: MESSAGES.shareTitle, text: MESSAGES.shareText, url: shareUrl })
          .catch(function () { /* closed the share sheet: nothing to do */ });
      });
    } else if (navigator.clipboard && window.isSecureContext) {
      button.textContent = MESSAGES.shareButtonCopy;
      button.hidden = false;
      button.addEventListener("click", function () {
        navigator.clipboard.writeText(shareUrl).then(function () {
          if (note) note.textContent = MESSAGES.shareCopied;
        }, function () {
          if (note) note.textContent = MESSAGES.shareCopyFailed;
          field.focus();
        });
      });
    }
  }

  /* 4. Start-up ----------------------------------------------------------- */
  function start() {
    initWaitlist();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
