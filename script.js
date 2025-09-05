// ---------------- auth, signup/signin, delete, save/load, signout (until above Forgot Password) ----------------
document.addEventListener("DOMContentLoaded", () => {
  // 0) First-time setup
  if (localStorage.getItem("r-touch") === null) localStorage.setItem("r-touch", "on");

  // 1) Firebase Initialization
  const firebaseConfig = {
    apiKey: "AIzaSyB1OXqvU6bi9cp-aPs6AGNnCaTGwHtkuUs",
    authDomain: "therrweb.firebaseapp.com",
    projectId: "therrweb",
    storageBucket: "therrweb",
    messagingSenderId: "77162554401",
    appId: "1:77162554401:web:4462bfcbbee40167b9af60",
    measurementId: "G-WC9WXR0CY5"
  };
  if (!(window.firebase && firebase.apps && firebase.apps.length)) {
    firebase.initializeApp(firebaseConfig);
  }

  // 1.a) Force LOCAL persistence
  firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

  // Public pages that DO NOT require auth
  const publicPages = ["/", "/index.html", "/account/login.html"];
  const currentPath = window.location.pathname;

  const db = firebase.firestore();

  // 2) Membership view toggles (memshow/memhide)
  let currentIsMember = false;
  function applyMembershipView(isMember) {
    document.querySelectorAll(".memshow").forEach(el => el.style.display = isMember ? "block" : "none");
    document.querySelectorAll(".memhide").forEach(el => el.style.display = isMember ? "none" : "block");
  }
  const userMembershipSpan = document.getElementById("user-membership");
  const userFullNameSpan   = document.getElementById("user-fullname");

  // UI helpers: signed-in / signed-out
  async function handleSignedIn(user) {
    try {
      // membership is keyed by email in your setup — check membership by email only
      let snap = await db.collection("membership").doc(user.email).get().catch(() => null);
      currentIsMember = snap && snap.exists && snap.data().membership === true;
      applyMembershipView(currentIsMember);
      if (userMembershipSpan) userMembershipSpan.textContent = currentIsMember ? "You are a Membership User" : "";
      if (userFullNameSpan) userFullNameSpan.textContent = user.displayName || "";

      const signedOutView = document.getElementById("auth-container");
      const signedInView  = document.getElementById("user-controls");
      const userEmailSpan = document.getElementById("user-email");
      const userUidSpan   = document.getElementById("user-uid");
      if (signedOutView && signedInView) {
        signedOutView.style.display = "none";
        signedInView.style.display  = "block";
      }
      if (userEmailSpan) userEmailSpan.textContent = user.email;
      if (userUidSpan)   userUidSpan.textContent   = user.uid;
    } catch (err) {
      console.error("handleSignedIn error:", err);
      handleSignedOut();
    }
  }

  function handleSignedOut() {
    currentIsMember = false;
    applyMembershipView(false);
    if (userMembershipSpan) userMembershipSpan.textContent = "";
    if (userFullNameSpan) userFullNameSpan.textContent = "";
    const signedOutView = document.getElementById("auth-container");
    const signedInView  = document.getElementById("user-controls");
    if (signedOutView && signedInView) {
      signedOutView.style.display = "block";
      signedInView.style.display  = "none";
    }
  }

  // Unified auth-state handling: block unverified users (unless just-signed-up in this tab short window)
  async function unifiedAuthHandler(user) {
    if (!user) {
      handleSignedOut();
      if (!publicPages.includes(currentPath)) {
        const target = window.location.pathname + window.location.search + window.location.hash;
        window.location.replace("/account/login.html?redirect=" + encodeURIComponent(target));
      }
      return;
    }

    try { await user.reload(); } catch (e) { console.warn("user.reload() failed:", e); }

    const justSignedUp = sessionStorage.getItem("rr_just_signed_up") === "1";

    if (!user.emailVerified) {
      if (justSignedUp) {
        // allow the short-lived verification UI flow (signup/signin handlers will show verify UI),
        // but don't grant long-term access here.
        handleSignedOut(); // keep app blocked
        return;
      }

      // Not just-signed-up: sign out immediately and redirect if protected
      try { await firebase.auth().signOut(); } catch (e) { console.warn("Auto sign-out failed:", e); }
      handleSignedOut();
      if (!publicPages.includes(currentPath)) {
        const target = window.location.pathname + window.location.search + window.location.hash;
        window.location.replace("/account/login.html?redirect=" + encodeURIComponent(target));
      }
      return;
    }

    // Verified user → normal flow
    await handleSignedIn(user);
  }

  firebase.auth().onAuthStateChanged(async (u) => {
    try { await unifiedAuthHandler(u); } catch (e) { console.error("unifiedAuthHandler error:", e); handleSignedOut(); }
  });

  // Tamper observer for memshow/memhide
  const tamperObserver = new MutationObserver(() => applyMembershipView(currentIsMember));
  document.querySelectorAll(".memshow, .memhide").forEach(el => tamperObserver.observe(el, {
    attributes: true,
    attributeFilter: ["style","class"]
  }));

  // 3) Account-page logic — element refs
  const emailSigninInput    = document.querySelector(".email-signin");
  const passwordSigninInput = document.querySelector(".password-signin");
  const emailSignupInput    = document.querySelector(".email-signup");
  const passwordSignupInput = document.querySelector(".password-signup");
  const nameSignupInput     = document.querySelector(".name-signup");
  const newsletterCheckbox  = document.querySelector(".newsletter-checkbox");
  const termsCheckbox       = document.getElementById("terms-checkbox"); // requires this element in signup HTML

  const signInBtn           = document.querySelector(".sign-in-btn");
  const signUpBtn           = document.querySelector(".sign-up-btn");
  const forgotPasswordBtn   = document.querySelector(".forgot-password-btn");

  const errorLoginMsg       = document.querySelector(".flip-card__front .error-message");
  const errorSignupMsg      = document.querySelector(".flip-card__back .error-message");

  const changePasswordBtn   = document.getElementById("change-password");
  const deleteAccountBtn    = document.getElementById("delete-account");
  const saveBtn             = document.getElementById("save-game-data");
  const loadBtn             = document.getElementById("load-game-data");
  const signOutBtn          = document.getElementById("sign-out");
  const clearLocalBtn       = document.getElementById("clear-local-btn");
  const clearFirestoreBtn   = document.getElementById("clear-firestore-btn");

  // Only attach handlers if the account UI exists on this page
  if (emailSigninInput && signInBtn && signUpBtn) {

    // Verification UI helpers
    let verifyPoll = null;
    let resendTimer = null;
    function clearVerifyTimers() {
      if (verifyPoll) { clearInterval(verifyPoll); verifyPoll = null; }
      if (resendTimer) { clearInterval(resendTimer); resendTimer = null; }
    }

    function setupVerifyUI(userObj) {
      clearVerifyTimers();
      const wrapper = document.querySelector(".wrapper");
      const ev = document.getElementById("email-verify");
      const evEmail = document.getElementById("ev-email");
      const evStatus = document.getElementById("ev-status");
      const resendBtn = document.getElementById("ev-resend");
      const cancelBtn = document.getElementById("ev-cancel");

      if (wrapper) wrapper.style.display = "none";
      if (ev) ev.style.display = "block";
      if (evEmail) evEmail.textContent = (userObj && userObj.email) || "";
      if (evStatus) evStatus.textContent = "Verification email sent. Check your inbox.";

      // Resend cooldown 60s
      let secs = 60;
      if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.textContent = `Resend (${secs})`;
        resendTimer = setInterval(() => {
          secs--;
          if (secs <= 0) { clearInterval(resendTimer); resendTimer = null; resendBtn.disabled = false; resendBtn.textContent = "Resend"; }
          else resendBtn.textContent = `Resend (${secs})`;
        }, 1000);

        resendBtn.onclick = async () => {
          try {
            const cur = firebase.auth().currentUser || userObj;
            if (cur) await cur.sendEmailVerification();
            if (evStatus) evStatus.textContent = "Verification email resent.";
          } catch (e) {
            console.error("Resend failed:", e);
            if (evStatus) evStatus.textContent = "Resend failed — try again later.";
          }
          // restart cooldown
          secs = 60;
          resendBtn.disabled = true;
          resendBtn.textContent = `Resend (${secs})`;
          if (resendTimer) clearInterval(resendTimer);
          resendTimer = setInterval(() => {
            secs--;
            if (secs <= 0) { clearInterval(resendTimer); resendTimer = null; resendBtn.disabled = false; resendBtn.textContent = "Resend"; }
            else resendBtn.textContent = `Resend (${secs})`;
          }, 1000);
        };
      }

      // Cancel: delete auth user + userdata (by uid) — do NOT delete membership
      if (cancelBtn) {
        cancelBtn.onclick = async () => {
          try {
            const cur = firebase.auth().currentUser || userObj;
            if (!cur) {
              if (ev) ev.style.display = "none";
              if (wrapper) wrapper.style.display = "block";
              clearVerifyTimers();
              return;
            }

            const uid = cur.uid;

            // Delete userdata by uid (only)
            try { await db.collection("userdata").doc(uid).delete().catch(()=>{}); } catch (e) { console.warn("delete userdata failed", e); }

            // delete auth user (client-side)
            try { await cur.delete(); }
            catch (e) {
              console.warn("cur.delete() failed (may require reauth):", e);
              try { await firebase.auth().signOut(); } catch (_) {}
            }
          } catch (err) {
            console.error("Cancel-delete flow error:", err);
            try { await firebase.auth().signOut(); } catch (_) {}
          } finally {
            if (ev) ev.style.display = "none";
            if (wrapper) wrapper.style.display = "block";
            clearVerifyTimers();
            // clear any temp session keys
            sessionStorage.removeItem("rr_pending_fullName");
            sessionStorage.removeItem("rr_pending_news");
            sessionStorage.removeItem("rr_just_signed_up");
          }
        };
      }

      // Poll for verification every 3s (stops after ~6 minutes)
      let checks = 0;
      const maxChecks = 120;
      verifyPoll = setInterval(async () => {
        checks++;
        try {
          const cur = firebase.auth().currentUser || userObj;
          if (!cur) return;
          await cur.reload();
          if (cur.emailVerified) {
            clearVerifyTimers();

            // show verified message briefly then redirect to original target (if any)
            if (evStatus) evStatus.textContent = "Verified — redirecting...";
            const params = new URLSearchParams(window.location.search);
            const redirect = params.get("redirect");

            // clear short-lived flags
            sessionStorage.removeItem("rr_pending_fullName");
            sessionStorage.removeItem("rr_pending_news");
            sessionStorage.removeItem("rr_just_signed_up");

            setTimeout(() => {
              if (redirect) {
                try { window.location.replace(decodeURIComponent(redirect)); } catch (e) { window.location.href = "/"; }
              } else {
                window.location.href = "/";
              }
            }, 900);
            return;
          } else if (checks >= maxChecks) {
            clearVerifyTimers();
            if (evStatus) evStatus.textContent = "Still waiting for verification. You can resend or cancel.";
          }
        } catch (err) {
          console.error("Verification poll error:", err);
        }
      }, 3000);
    } // end setupVerifyUI

    // ---------- SIGN UP ----------
    signUpBtn.removeEventListener && signUpBtn.removeEventListener("click", null);
    signUpBtn.addEventListener("click", async () => {
      const fullName = (nameSignupInput && nameSignupInput.value || "").trim();
      const email    = (emailSignupInput && emailSignupInput.value || "").trim();
      const pwd      = (passwordSignupInput && passwordSignupInput.value || "");
      if (errorSignupMsg) errorSignupMsg.textContent = "";

      // Require Terms & Conditions checkbox
      if (!termsCheckbox || !termsCheckbox.checked) {
        if (errorSignupMsg) errorSignupMsg.textContent = "You must accept the Terms & Conditions to sign up.";
        return;
      }

      if (!fullName || !email || !pwd) {
        if (errorSignupMsg) errorSignupMsg.textContent = "Enter name, email and password.";
        return;
      }

      try {
        // create the account (account exists on Firebase now)
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, pwd);
        const user = cred.user;

        // save displayName and userdata immediately
        try {
          await user.updateProfile({ displayName: fullName });
        } catch (e) {
          console.warn("updateProfile failed:", e);
        }
        try {
          await db.collection("userdata").doc(user.uid).set({ fullName: fullName }, { merge: true });
        } catch (e) {
          console.warn("saving userdata failed:", e);
        }

        // Immediately subscribe to Mailchimp via Netlify proxy (fire-and-forget)
        if (newsletterCheckbox && newsletterCheckbox.checked) {
          (async () => {
            try {
              const res = await fetch("/.netlify/functions/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, fullName })
              });
              if (!res.ok) {
                const txt = await res.text().catch(()=>"");
                console.warn("Subscribe proxy returned non-ok:", res.status, txt);
              }
            } catch (err) {
              console.warn("Subscribe proxy failed:", err);
            }
          })();
        }

        // send verification email
        try { await user.sendEmailVerification(); } catch (e) { console.warn("sendEmailVerification:", e); }

        // keep a tiny short-lived window so auth listener won't immediately sign them out
        sessionStorage.setItem("rr_just_signed_up", "1");
        setTimeout(() => sessionStorage.removeItem("rr_just_signed_up"), 10000);

        // show verification UI and start polling
        setupVerifyUI(user);

      } catch (err) {
        console.error("signup error:", err);
        if (errorSignupMsg) {
          if (err.code === "auth/email-already-in-use") {
            errorSignupMsg.textContent = "Email already used, try to Sign IN";
          } else if (err.message && err.message.toLowerCase().includes("network error")) {
            errorSignupMsg.textContent = "There is a network issue, try again later.";
          } else {
            errorSignupMsg.textContent = err.message || "Signup failed.";
          }
        }
      }
    });

    // ---------- SIGN IN ----------
    signInBtn.removeEventListener && signInBtn.removeEventListener("click", null);
    signInBtn.addEventListener("click", async () => {
      const email = (emailSigninInput && emailSigninInput.value || "").trim();
      const pwd = (passwordSigninInput && passwordSigninInput.value) || "";
      if (errorLoginMsg) errorLoginMsg.textContent = "";

      try {
        const cred = await firebase.auth().signInWithEmailAndPassword(email, pwd);
        const user = cred.user;
        await user.reload();

        if (!user.emailVerified) {
          // send verification and show verify UI (block access)
          try { await user.sendEmailVerification(); } catch (e) { console.warn("sendEmailVerification:", e); }

          // allow a short window so unified handler doesn't immediately sign them out
          sessionStorage.setItem("rr_just_signed_up", "1");
          setTimeout(() => sessionStorage.removeItem("rr_just_signed_up"), 10000);

          setupVerifyUI(user);
          return;
        }

        // verified -> go to redirect if provided, else show signed-in UI
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get("redirect");
        if (redirect) {
          try { window.location.replace(decodeURIComponent(redirect)); } catch (e) { window.location.href = "/"; }
        } else {
          await handleSignedIn(user);
        }

      } catch (err) {
        console.error("signin error", err);
        if (errorLoginMsg) {
          if (["auth/invalid-email","auth/user-not-found","auth/wrong-password"].includes(err.code)) {
            errorLoginMsg.textContent = "Incorrect email or password.";
          } else if (err.code === "auth/user-disabled") {
            errorLoginMsg.textContent = "Your account has been disabled, Contact Support: support@therrweb.atlassian.net or go to therrweb.atlassian.net";
          } else if (err.message && err.message.toLowerCase().includes("network error")) {
            errorLoginMsg.textContent = "There is a network issue, try again later.";
          } else {
            errorLoginMsg.textContent = err.message || "Sign-in failed.";
          }
        }
      }
    })
    // Forgot Password
    forgotPasswordBtn.addEventListener("click", () => {
      const email = emailSigninInput.value.trim();
      if (!email) {
        errorLoginMsg.textContent = "Enter your email to reset password.";
        return;
      }
      firebase.auth().sendPasswordResetEmail(email)
        .then(() => alert("Reset email sent."))
        .catch(() => {
          errorLoginMsg.textContent = "Network issue, try again later.";
        });
    });

    // Change Password (this is only attached when changePasswordBtn exists, but inside sign-in block to keep parity)
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener("click", () => {
        const u = firebase.auth().currentUser;
        if (u) {
          firebase.auth().sendPasswordResetEmail(u.email)
            .then(() => alert("Reset email sent."))
            .catch(() => {
              errorLoginMsg.textContent = "Network issue, try again later.";
            });
        }
      });
    }
  }

  if (deleteAccountBtn) {
      deleteAccountBtn.addEventListener("click", async () => {
        const u = firebase.auth().currentUser;
        if (!u) return;
        if (!confirm("Delete account AND all your cloud data?")) return;
        try {
          const uid = u.uid;
          // delete userdata by uid only
          await db.collection("userdata").doc(uid).delete().catch(()=>{});
          // delete auth user
          await u.delete();
          alert("Deleted account & data.");
          location.reload();
        } catch (e) {
          console.error("Error deleting account & data:", e);
          if (e && e.code === "auth/requires-recent-login") {
            alert("Unable to delete: please sign in again and try delete.");
          } else {
            alert("Error deleting: " + (e && e.message ? e.message : "Unknown error"));
          }
        }
      });
    }

    // Save Game Data
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const u = firebase.auth().currentUser;
        if (!u) return alert("Sign in first.");
        try {
          await db.collection("userdata").doc(u.uid)
            .set(Object.fromEntries(Object.entries(localStorage)), { merge: true });
          alert("Data saved!");
        } catch {
          alert("Save failed, try again.");
        }
      });
    }

    // Load Game Data
    if (loadBtn) {
      loadBtn.addEventListener("click", async () => {
        const u = firebase.auth().currentUser;
        if (!u) return alert("Sign in first.");
        try {
          const snap = await db.collection("userdata").doc(u.uid).get();
          if (!snap.exists) throw new Error();
          localStorage.clear();
          Object.entries(snap.data()).forEach(([k,v]) => localStorage.setItem(k, v));
          alert("Data loaded!"); location.reload();
        } catch {
          alert("Load failed, try again.");
        }
      });
    }

    // Sign Out
    if (signOutBtn) {
      signOutBtn.addEventListener("click", () => {
        firebase.auth().signOut()
          .then(() => location.reload())
          .catch(e => { console.error(e); alert("Sign-out failed."); });
      });
    }

    // Clear LocalStorage
    if (clearLocalBtn) {
      clearLocalBtn.addEventListener("click", () => {
        if (confirm("Clear all localStorage?")) { localStorage.clear(); alert("Cleared."); }
      });
    }

    // Clear Firestore data (cloud userdata)
    if (clearFirestoreBtn) {
      clearFirestoreBtn.addEventListener("click", async () => {
        const u = firebase.auth().currentUser;
        if (!u) return alert("Sign in first.");
        if (!confirm("Delete cloud data?")) return;
        try {
          await db.collection("userdata").doc(u.uid).delete();
          alert("Cloud data deleted.");
        } catch {
          alert("Delete failed.");
        }
      });
    }

  // --------- Theme / disguise / r-touch / toolbar JS (id-based) ----------
const faviconLink         = document.querySelector("link[rel='icon']");
const shortcutFaviconLink = document.querySelector("link[rel='shortcut icon']");
const defaultTitle        = document.title;
const defaultIcon         = faviconLink?.href || "";

const PRESETS = {
  none:   { title: defaultTitle, icon: defaultIcon },
  google: {
    title: "Google",
    icon:  "https://pensiontransferspecialist.co.uk/wp-content/uploads/2021/10/Google-Workspace-Logo.png"
  },
  teams: {
    title: "Microsoft Teams",
    icon:  "https://static2.sharepointonline.com/files/fabric/assets/brand-icons/product/svg/teams_48x1.svg"
  }
};

function applyTheme(theme) {
  document.title = theme.title;
  if (faviconLink)         faviconLink.href         = theme.icon;
  if (shortcutFaviconLink) shortcutFaviconLink.href = theme.icon;
}

let savedTheme = {};
try {
  savedTheme = JSON.parse(localStorage.getItem("siteTheme")) || {};
} catch {
  savedTheme = {};
}

// Apply on load
if (savedTheme.mode === "custom") {
  applyTheme({ title: savedTheme.title, icon: savedTheme.icon });
} else if (savedTheme.mode) {
  applyTheme(PRESETS[savedTheme.mode] || PRESETS.none);
} else {
  applyTheme(PRESETS.none);
}

// Wire up the single disguise-mode block (now id-based)
(function wireDisguiseMode() {
  const block = document.getElementById("disguise-mode");
  if (!block) return;

  const radios     = block.querySelectorAll("input[name='siteTheme']");
  const customOpts = document.getElementById("custom-options");
  const titleIn    = document.getElementById("custom-title-input");
  const iconIn     = document.getElementById("custom-icon-input");

  // Initialize UI
  if (savedTheme.mode) {
    const sel = block.querySelector(`input[name="siteTheme"][value="${savedTheme.mode}"]`);
    if (sel) sel.checked = true;
    if (customOpts) customOpts.style.display = (savedTheme.mode === "custom") ? "block" : "none";
    if (savedTheme.mode === "custom" && titleIn) titleIn.value = savedTheme.title || "";
  }

  // Radio change handler
  radios.forEach(radio => radio.addEventListener("change", () => {
    const mode = radio.value;
    if (mode === "custom") {
      if (customOpts) customOpts.style.display = "block";
      savedTheme = { mode:"custom", title: defaultTitle, icon: defaultIcon };
    } else {
      if (customOpts) customOpts.style.display = "none";
      applyTheme(PRESETS[mode] || PRESETS.none);
      savedTheme = { mode };
    }
    localStorage.setItem("siteTheme", JSON.stringify(savedTheme));
  }));

  // Custom title live-update
  if (titleIn) {
    titleIn.addEventListener("input", () => {
      const checkedMode = block.querySelector('input[name="siteTheme"]:checked')?.value;
      if (checkedMode === "custom") {
        savedTheme.title = titleIn.value || defaultTitle;
        applyTheme({ title: savedTheme.title, icon: savedTheme.icon });
        localStorage.setItem("siteTheme", JSON.stringify(savedTheme));
      }
    });
  }

  // Custom icon file handler
  if (iconIn) {
    iconIn.addEventListener("change", () => {
      const checkedMode = block.querySelector('input[name="siteTheme"]:checked')?.value;
      if (checkedMode === "custom" && iconIn.files.length) {
        const reader = new FileReader();
        reader.onload = () => {
          savedTheme.icon = reader.result;
          applyTheme({ title: savedTheme.title, icon: savedTheme.icon });
          localStorage.setItem("siteTheme", JSON.stringify(savedTheme));
        };
        reader.readAsDataURL(iconIn.files[0]);
      }
    });
  }
})(); // end wireDisguiseMode

// — R Touch toggle (single toggle id)
(function wireRTouch() {
  const rtToggle = document.getElementById("r-touch-toggle");
  if (!rtToggle) return;

  // sync UI from storage
  function syncToggle() {
    const on = localStorage.getItem("r-touch") === "on";
    rtToggle.checked = on;
  }
  syncToggle();

  rtToggle.addEventListener("change", () => {
    localStorage.setItem("r-touch", rtToggle.checked ? "on" : "off");
    window.dispatchEvent(new Event("r-touch-changed"));
  });

  // reflect external changes
  window.addEventListener("r-touch-changed", syncToggle);
})(); // end wireRTouch

// — Toolbar-pos radios (single container id)
(function wireToolbarPos() {
  const toolbarContainer = document.getElementById("toolbar-selector");
  if (!toolbarContainer) return;

  const toolbarRadios = toolbarContainer.querySelectorAll("input[name='toolbar-pos']");
  if (!toolbarRadios || toolbarRadios.length === 0) return;

  function syncAllRadios() {
    const saved = localStorage.getItem("toolbar-pos") || "right";
    toolbarRadios.forEach(r => r.checked = (r.value === saved));
  }
  // init state
  syncAllRadios();

  // when any radio changes
  toolbarRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      localStorage.setItem("toolbar-pos", radio.value);
      window.dispatchEvent(new Event("toolbar-pos-changed"));
    });
  });

  // re-sync listener
  window.addEventListener("toolbar-pos-changed", syncAllRadios);
})(); // end wireToolbarPos

// End of updated ID-based wiring
}); // end DOMContentLoaded

function myFunction() {
    var x = document.getElementById("Navbar");
    if (x.className === "navbar") {
      x.className += " responsive";
    } else {
      x.className = "navbar";
    }
  }
