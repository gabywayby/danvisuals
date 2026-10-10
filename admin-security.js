/* admin-security.js: clickjacking guard, idle sign-out, two-step login (TOTP), safe link check.
   Load BEFORE admin.js. Builds the page with DOM methods only (CSP-friendly). */
(() => {
  "use strict";

  // 1) Refuse to run inside someone else's frame.
  if (window.top !== window.self) {
    document.documentElement.replaceChildren();
    throw new Error("Framed page blocked");
  }

  const IDLE_MS = 30 * 60 * 1000;
  const EVENTS = ["click", "keydown", "mousemove", "touchstart", "scroll"];
  let timer = null;
  let arm = null;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // 2) Auto sign-out after 30 idle minutes.
  function stopIdleTimer() {
    clearTimeout(timer);
    if (arm) EVENTS.forEach((e) => window.removeEventListener(e, arm));
    arm = null;
  }
  function startIdleTimer(client) {
    stopIdleTimer();
    arm = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try { await client.auth.signOut(); } finally {
          sessionStorage.setItem("idleSignOut", "1");
          location.reload();
        }
      }, IDLE_MS);
    };
    EVENTS.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
  }
  function consumeIdleNotice() {
    const was = sessionStorage.getItem("idleSignOut") === "1";
    sessionStorage.removeItem("idleSignOut");
    return was;
  }

  // 3) Only open delivery links that are https Google Drive/Docs.
  function isDeliveryUrl(value) {
    try {
      const u = new URL(value);
      return u.protocol === "https:" && !u.username && !u.password &&
        (u.hostname === "drive.google.com" || u.hostname === "docs.google.com");
    } catch { return false; }
  }

  // 4) Two-step login. Resolves true once the session is aal2.
  async function mfaGate(client, mount) {
    const { data: aal, error: aalErr } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalErr) throw aalErr;
    if (aal.currentLevel === "aal2") return true;

    const { data: list, error: listErr } = await client.auth.mfa.listFactors();
    if (listErr) throw listErr;
    let factor = (list.totp || []).find((f) => f.status === "verified");
    let enrolled = null;

    if (!factor) {
      for (const f of list.all || []) {
        if (f.status !== "verified") await client.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Admin phone" });
      if (error) throw error;
      enrolled = data;
      factor = { id: data.id };
    }

    return new Promise((resolve) => {
      mount.replaceChildren();
      const panel = el("div", "login-panel");
      panel.append(el("p", "eyebrow", enrolled ? "Set up two-step login" : "Two-step login"));
      panel.append(el("h1", "", enrolled ? "Scan this code" : "Enter your code"));

      if (enrolled) {
        const qr = el("img", "mfa-qr");
        qr.src = enrolled.totp.qr_code;
        qr.alt = "QR code for your authenticator app";
        panel.append(qr);
        panel.append(el("p", "", "Can't scan? Type this key into your app and keep it somewhere safe:"));
        panel.append(el("code", "mfa-secret", enrolled.totp.secret));
      } else {
        panel.append(el("p", "", "Open your authenticator app and type the 6-digit code."));
      }

      const form = el("form", "login-form");
      const label = el("label", "", "6-digit code");
      const input = el("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.autocomplete = "one-time-code";
      input.maxLength = 6;
      input.pattern = "[0-9]{6}";
      input.required = true;
      label.append(input);
      const msg = el("p", "message");
      msg.setAttribute("role", "alert");
      const btn = el("button", "button", "Verify");
      btn.type = "submit";
      form.append(label, msg, btn);

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        btn.disabled = true;
        msg.textContent = "";
        const { data: ch, error: cErr } = await client.auth.mfa.challenge({ factorId: factor.id });
        const { error: vErr } = cErr
          ? { error: cErr }
          : await client.auth.mfa.verify({ factorId: factor.id, challengeId: ch.id, code: input.value.trim() });
        btn.disabled = false;
        if (vErr) {
          msg.textContent = "That code didn't work. Try again.";
          input.value = "";
          input.focus();
          return;
        }
        resolve(true);
      });

      panel.append(form);
      mount.append(panel);
      input.focus();
    });
  }

  window.AdminSecurity = { startIdleTimer, stopIdleTimer, consumeIdleNotice, isDeliveryUrl, mfaGate };
})();
