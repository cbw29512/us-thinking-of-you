// OurHearts
// Single-screen simple version
// dice button removed

const STORAGE_KEY = "us-app-v2";

let state = {
  paid: false,
  paired: false,
  myCode: null,
  partnerCode: null,
  sharedCode: null,
  partnerName: "them",
  screen: "main",
  myChoice: null,
  partnerChoice: null,
  lastHeart: null,
  lastMood: null,
  lastSeenEvent: null
};

let pollTimer = null;
let myId = null;
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

function showInstallBanner() {
  if (document.getElementById("install-banner")) return;
  if (window.matchMedia("(display-mode: standalone)").matches) return;
  if (!state.paid) return;

  const banner = document.createElement("div");
  banner.id = "install-banner";
  banner.style.cssText = `
    position: fixed; bottom: 12px; left: 12px; right: 12px;
    background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px;
    padding: 12px 14px; display: flex; align-items: center; gap: 10px;
    z-index: 20; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  `;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  banner.innerHTML = `
    <div style="flex:1; font-size:13.5px; line-height:1.3;">
      <strong>Add to Home Screen</strong><br>
      <span style="color:#888; font-size:12.5px;">${isIOS ? "Tap Share then \u201cAdd to Home Screen\u201d" : "One tap to install"}</span>
    </div>
    <button id="install-btn" style="background:#e63946; color:white; border:none; padding:9px 12px; border-radius:10px; font-weight:600; font-size:13px;">
      ${isIOS ? "How" : "Add"}
    </button>
    <button id="dismiss-install" style="background:none; border:none; color:#666; font-size:18px; padding:2px;">\u00d7</button>
  `;

  document.body.appendChild(banner);

  document.getElementById("install-btn").onclick = async () => {
    if (isIOS) {
      alert("1. Tap the Share button (square with arrow)\n2. Scroll and tap \u201cAdd to Home Screen\u201d\n3. Tap Add");
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        showToast("Added!");
        banner.remove();
      }
      deferredPrompt = null;
    } else {
      alert("To add to home screen:\n\nChrome: Menu (\u22ee) \u2192 Add to Home screen\nSafari: Share button \u2192 Add to Home Screen");
    }
  };

  document.getElementById("dismiss-install").onclick = () => banner.remove();
}

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) Object.assign(state, JSON.parse(saved));
  } catch (e) {}
  if (!state.myCode) state.myCode = generateCode();
  if (!myId) myId = localStorage.getItem("us-my-id") || crypto.randomUUID();
  localStorage.setItem("us-my-id", myId);

  const params = new URLSearchParams(window.location.search);
  if (params.get("paid") === "1") {
    state.paid = true;
    state.screen = "pair";
    localStorage.setItem("us-paid", "1");
    history.replaceState({}, "", window.location.pathname);
  }
  if (localStorage.getItem("us-paid") === "1") state.paid = true;

  const trialStart = localStorage.getItem("us-trial-start");
  if (trialStart) {
    const days = (Date.now() - parseInt(trialStart)) / (1000 * 60 * 60 * 24);
    if (days < 7) state.paid = true;
  }

  const pairCode = params.get("pair");
  if (pairCode && pairCode.length === 6) {
    state.paid = true;
    localStorage.setItem("us-paid", "1");
    state.paired = true;
    state.partnerCode = pairCode;
    state.sharedCode = pairCode;
    state.screen = "main";
    history.replaceState({}, "", window.location.pathname);
    startPolling();
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function vibrate(pattern = 40) {
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

function showToast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1600);
}

async function sendEvent(type, payload = {}) {
  const code = state.sharedCode || state.partnerCode || state.myCode;
  if (!code) return;
  try {
    await fetch(`/api/pair?code=${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload, from: myId }),
    });
  } catch (e) {}
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  const code = state.sharedCode || state.partnerCode || state.myCode;
  if (!code) return;

  sendEvent("presence");

  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/pair?code=${code}`);
      const pair = await res.json();
      if (!pair.events) return;

      const others = (pair.users || []).filter(u => u !== myId);
      if (others.length > 0 && !state.paired) {
        state.paired = true;
        save();
        showToast("Connected!");
        state.screen = "main";
        render();
      }

      const now = Date.now();
      for (const event of pair.events) {
        if (event.from === myId) continue;
        if (event.id <= (state.lastSeenEvent || 0) && (now - event.at) > 30000) continue;
        if (event.id > (state.lastSeenEvent || 0)) state.lastSeenEvent = event.id;
        console.log("incoming", event.type, event.id);
        handleIncoming(event);
      }
      save();
    } catch (e) {}
  }, 2500);
}

function handleIncoming(event) {
  if (event.type === "presence") return;
  if (event.type === "heart") {
    showToast("I love you \u2764\ufe0f");
    vibrate([100, 50, 100, 50, 200]);
    const status = document.getElementById("heartStatus");
    if (status) status.textContent = "I love you \u2764\ufe0f";
    explodeHearts();
  } else if (event.type === "mood") {
    showToast(`They're feeling ${event.payload?.mood || "something"}`);
    vibrate(30);
  } else if (event.type === "rps") {
    state.partnerChoice = event.payload?.choice;
    showToast("They played!");
    vibrate([40, 30, 40]);
    if (state.myChoice && state.partnerChoice) {
      state.screen = "result";
      render();
    } else {
      const status = document.getElementById("rpsStatus");
      if (status) {
        status.textContent = "They played! Pick one";
        status.classList.add("waiting");
      }
    }
  } else if (event.type === "dice") {
    showToast(`They rolled a ${event.payload?.result}`);
    if (event.payload?.result === 20) flashScreen("green");
    if (event.payload?.result === 1) flashScreen("red");
  }
}

function flashScreen(color) {
  const flash = document.createElement("div");
  flash.style.cssText = `
    position: fixed; inset: 0; pointer-events: none; z-index: 40;
    background: ${color === "green" ? "#22c55e" : "#ef4444"};
    opacity: 0; animation: flash 0.6s ease;
  `;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 600);
  if (!document.getElementById("flash-anim")) {
    const s = document.createElement("style");
    s.id = "flash-anim";
    s.textContent = `@keyframes flash { 0% { opacity: 0.7; } 100% { opacity: 0; } }`;
    document.head.appendChild(s);
  }
}

function explodeHearts() {
  for (let i = 0; i < 24; i++) {
    const h = document.createElement("div");
    h.textContent = "\u2764\ufe0f";
    h.style.cssText = `
      position: fixed;
      left: ${Math.random() * 90}%;
      top: ${Math.random() * 80}%;
      font-size: ${20 + Math.random() * 40}px;
      pointer-events: none;
      z-index: 30;
      animation: explode 1.6s ease-out forwards;
    `;
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 1600);
  }
  if (!document.getElementById("heart-anim")) {
    const style = document.createElement("style");
    style.id = "heart-anim";
    style.textContent = `
      @keyframes explode {
        0% { transform: scale(0.3) translateY(0); opacity: 1; }
        100% { transform: scale(1.4) translateY(-80px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

function rollDice() {
  const result = Math.floor(Math.random() * 20) + 1;
  const die = document.createElement("div");
  die.textContent = result;
  die.style.cssText = `
    position: fixed; left: 50%; top: 30%;
    width: 70px; height: 70px; margin-left: -35px;
    background: #1a1a1a; border: 2px solid #e63946; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 32px; font-weight: 700; color: white;
    pointer-events: none; z-index: 35;
  `;
  document.body.appendChild(die);

  let y = 0, vy = -8, x = 0, vx = (Math.random() - 0.5) * 6;
  const gravity = 0.5;
  const bounce = 0.6;
  let frames = 0;

  function animate() {
    frames++;
    vy += gravity;
    y += vy;
    x += vx;

    if (y > 200) {
      y = 200;
      vy *= -bounce;
      vx *= 0.9;
      if (Math.abs(vy) < 1) {
        die.remove();
        if (result === 20) {
          flashScreen("green");
          showToast("NAT 20!");
          vibrate([40, 30, 40, 30, 80]);
        } else if (result === 1) {
          flashScreen("red");
          showToast("NAT 1");
          vibrate([80, 40, 80]);
        } else {
          showToast(`Rolled ${result}`);
          vibrate(30);
        }
        sendEvent("dice", { result });
        return;
      }
    }
    if (x < -120 || x > 120) vx *= -0.8;

    die.style.transform = `translate(${x}px, ${y}px) rotate(${x * 2}deg)`;
    if (frames < 180) requestAnimationFrame(animate);
    else die.remove();
  }
  animate();
}

const app = document.getElementById("app");

function render() {
  save();
  if (!state.paid) {
    renderLanding();
    return;
  }
  if (state.screen === "main") renderMain();
  else if (state.screen === "pair") renderPair();
  else if (state.screen === "result") renderResult();
}

function renderLanding() {
  app.innerHTML = `
    <div class="screen" style="justify-content:center; text-align:center; padding:24px 22px 20px;">
      <div style="font-size:32px; margin-bottom:4px;">\u2764\ufe0f</div>
      <h1 style="font-size:36px; margin-bottom:8px; letter-spacing:-0.5px;">OurHearts</h1>
      <p style="font-size:18px; color:#ddd; line-height:1.4; margin-bottom:18px; max-width:340px; margin-left:auto; margin-right:auto;">
        A one-tap way to tell your partner you\u2019re thinking of them.
      </p>
      
      <img src="phones.jpg" alt="Two phones showing the app" style="display:block; margin:0 auto 22px; width:100%; max-width:360px; border-radius:14px;">
      
      <div style="text-align:left; background:#141414; border-radius:16px; padding:16px 18px; margin-bottom:18px;">
        <p style="font-size:14px; color:#888; margin-bottom:10px; font-weight:600;">How it works</p>
        <p style="font-size:16px; margin-bottom:10px; line-height:1.45;"><strong>1. Pair up</strong> \u2014 send them a link. They open it. No account.</p>
        <p style="font-size:16px; margin-bottom:10px; line-height:1.45;"><strong>2. Tap the heart</strong> \u2014 their screen fills with hearts and says \u201cI love you.\u201d</p>
        <p style="font-size:16px; margin-bottom:10px; line-height:1.45;"><strong>3. Share a mood</strong> \u2014 tired, miss you, need a hug. One tap.</p>
        <p style="font-size:16px; margin-bottom:0; line-height:1.45;"><strong>4. Rock paper scissors</strong> \u2014 decide dinner without texting.</p>
      </div>
      
      <p style="font-size:15px; color:#999; margin-bottom:12px;">
        One person pays. Both of you get it. Cancel anytime.
      </p>
      <button class="big-button" id="tryBtn" style="margin-bottom:8px;">Try free for 7 days</button>
      <button class="secondary" id="payBtn">Or start for $1.99/mo</button>
      <p style="font-size:13px; color:#666; margin-top:10px;">No ads. Private. No account needed.</p>
      
      <div style="text-align:left; background:#111; border-radius:14px; padding:14px 16px; margin-top:20px; font-size:14px; line-height:1.5;">
        <p style="color:#888; margin-bottom:8px; font-weight:600;">FAQ</p>
        <p style="margin-bottom:6px;"><strong>Does my partner pay?</strong> No. One person pays. Both get it.</p>
        <p style="margin-bottom:6px;"><strong>Do they need an account?</strong> No. Just open the link.</p>
        <p style="margin-bottom:6px;"><strong>Works on iPhone and Android?</strong> Yes. Opens in the browser.</p>
        <p style="margin-bottom:0;"><strong>What do you store?</strong> Just the messages between you two. No ads, no tracking.</p>
      </div>
      
      <div style="margin-top:18px; padding-top:14px; border-top:1px solid #222;">
        <p style="font-size:13px; color:#888; margin-bottom:6px;">Already paid? Enter your code</p>
        <input type="text" id="restoreInput" placeholder="6-digit code" maxlength="6" inputmode="numeric" style="margin:0 0 8px; letter-spacing:2px;">
        <button class="secondary" id="restoreBtn" style="margin:0;">Restore access</button>
      </div>
    </div>
  `;

  document.getElementById("tryBtn").onclick = () => {
    if (!localStorage.getItem("us-trial-start")) {
      localStorage.setItem("us-trial-start", Date.now().toString());
    }
    state.paid = true;
    state.screen = "pair";
    save();
    showToast("7-day trial started");
    render();
  };

  document.getElementById("restoreBtn").onclick = () => {
    const code = document.getElementById("restoreInput").value.trim();
    if (code === "000000") {
      state.paid = true;
      state.paired = true;
      state.myCode = "000000";
      state.sharedCode = "000000";
      state.screen = "main";
      localStorage.setItem("us-paid", "1");
      save();
      showToast("Test mode");
      startPolling();
      render();
      return;
    }
    if (code.length === 6) {
      state.paid = true;
      state.myCode = code;
      state.sharedCode = code;
      state.screen = "main";
      localStorage.setItem("us-paid", "1");
      save();
      showToast("Restored");
      render();
    } else {
      showToast("Enter a 6-digit code");
    }
  };

  document.getElementById("payBtn").onclick = async () => {
    const btn = document.getElementById("payBtn");
    btn.textContent = "Redirecting...";
    btn.disabled = true;
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location = data.url;
      else showToast(data.error || "Payment setup needed");
    } catch (e) {
      showToast("Could not start payment");
      btn.textContent = "Start for $1.99/mo";
      btn.disabled = false;
    }
  };
}

function renderMain() {
  const moods = [
    { id: "good", label: "Good" },
    { id: "tired", label: "Tired" },
    { id: "happy", label: "Happy" },
    { id: "hug", label: "Hug" },
    { id: "miss", label: "Miss you" }
  ];

  app.innerHTML = `
    <div class="screen" style="padding:20px 20px 16px; justify-content:space-between; max-width:420px; margin:0 auto; width:100%;">
      <div style="text-align:center;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h1 style="font-size:22px; margin:0;">OurHearts</h1>
          <button class="secondary" style="width:auto; padding:8px 14px; margin:0; font-size:13px;" onclick="go('pair')">Pair</button>
        </div>
        <p class="subtitle" style="margin:6px 0 16px; font-size:14px;">${state.paired ? "\u2713 Connected" : "Waiting for them..."}</p>

        <button class="heart-button" id="heartBtn" aria-label="Thinking of you" style="height:120px; width:120px; font-size:48px; margin:10px auto;">\u2764\ufe0f</button>
        <div class="status" id="heartStatus" style="margin-top:8px; font-size:14px;">${state.lastHeart ? "Heart sent" : "Tap the heart"}</div>
      </div>

      <div>
        <div style="font-size:13px; color:#888; margin-bottom:8px; text-align:center;">How are you?</div>
        <div class="mood-grid" style="gap:6px; margin:0;">
          ${moods.map(m => `<button class="mood-btn ${state.lastMood === m.id ? 'selected' : ''}" data-mood="${m.id}" style="padding:12px 6px; font-size:14px;">${m.label}</button>`).join("")}
        </div>
      </div>

      <div>
        <div style="font-size:13px; color:#888; margin-bottom:8px; text-align:center;">Rock Paper Scissors</div>
        <div class="choice-grid" style="gap:8px; margin:0;">
          <button class="choice-btn" data-choice="rock" style="font-size:34px; padding:16px;">\u270a</button>
          <button class="choice-btn" data-choice="paper" style="font-size:34px; padding:16px;">\u270b</button>
          <button class="choice-btn" data-choice="scissors" style="font-size:34px; padding:16px;">\u270c\ufe0f</button>
        </div>
        <div class="status" id="rpsStatus" style="margin-top:6px; font-size:14px;">Pick one</div>
      </div>
    </div>
  `;

  document.getElementById("heartBtn").onclick = sendHeart;

  document.querySelectorAll(".mood-btn").forEach(btn => {
    btn.onclick = () => {
      const mood = btn.dataset.mood;
      state.lastMood = mood;
      save();
      vibrate(30);
      showToast("Mood sent");
      sendEvent("mood", { mood });
      document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    };
  });

  document.querySelectorAll(".choice-btn").forEach(btn => {
    btn.onclick = () => {
      const choice = btn.dataset.choice;
      state.myChoice = choice;
      document.querySelectorAll(".choice-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      vibrate(30);
      const status = document.getElementById("rpsStatus");
      status.textContent = "Sent. Waiting...";
      status.classList.add("waiting");
      sendEvent("rps", { choice });

      if (state.partnerChoice) {
        state.screen = "result";
        render();
      }
    };
  });

  setTimeout(showInstallBanner, 3000);
}

function sendHeart() {
  const btn = document.getElementById("heartBtn");
  const status = document.getElementById("heartStatus");
  btn.classList.add("sent");
  setTimeout(() => btn.classList.remove("sent"), 400);
  vibrate(45);
  state.lastHeart = Date.now();
  save();
  status.textContent = "I love you sent \u2764\ufe0f";
  showToast("I love you sent");
  sendEvent("heart");
  setTimeout(() => {
    if (document.getElementById("heartStatus")) {
      document.getElementById("heartStatus").textContent = "Heart sent";
    }
  }, 1400);
}

function renderPair() {
  const pairUrl = `${window.location.origin}${window.location.pathname}?pair=${state.myCode}`;
  state.sharedCode = state.myCode;
  startPolling();

  app.innerHTML = `
    <div class="screen">
      <h1>You're in</h1>
      <p class="subtitle">Share the QR or link so they can join. Save your code to restore later.</p>
      
      <div id="qrcode" style="margin: 20px auto; width: 180px; height: 180px; background: white; padding: 8px; border-radius: 12px;"></div>
      
      <div class="pair-code">${state.myCode}</div>
      <p class="status">Your code (save this)</p>

      <div style="background:#1a1a1a; border-radius:10px; padding:10px 12px; margin:16px 0; font-size:13px; word-break:break-all; color:#ccc;">
        ${pairUrl}
      </div>
      <button class="big-button" id="shareBtn">Share link</button>
      <button class="secondary" id="copyBtn">Copy link</button>
      
      <input type="text" placeholder="Or enter their code" id="codeInput" maxlength="6" inputmode="numeric">
      <button class="big-button" id="joinBtn">Connect with code</button>
      <button class="secondary" onclick="go('main')">Go to app</button>
    </div>
  `;

  setTimeout(() => {
    const qrEl = document.getElementById("qrcode");
    if (qrEl && typeof QRCode !== "undefined") {
      qrEl.innerHTML = "";
      new QRCode(qrEl, {
        text: pairUrl,
        width: 164,
        height: 164,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }, 50);

  document.getElementById("shareBtn").onclick = async () => {
    const shareData = {
      title: "OurHearts",
      text: "Tap to connect with me",
      url: pairUrl
    };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        showToast("Shared");
      } catch (e) {}
    } else {
      window.location.href = `mailto:?subject=${encodeURIComponent("Connect with me")}&body=${encodeURIComponent("Tap this link to connect:\n\n" + pairUrl)}`;
    }
  };

  document.getElementById("copyBtn").onclick = () => {
    navigator.clipboard.writeText(pairUrl).then(() => {
      showToast("Link copied");
      vibrate(30);
    }).catch(() => showToast("Copy failed"));
  };

  document.getElementById("joinBtn").onclick = () => {
    const code = document.getElementById("codeInput").value.trim();
    if (code.length === 6 && code !== state.myCode) {
      state.paired = true;
      state.partnerCode = code;
      state.sharedCode = code;
      showToast("Paired!");
      vibrate([30, 40, 30]);
      state.screen = "main";
      startPolling();
      render();
    } else if (code.length === 6 && code === state.myCode) {
      state.paired = true;
      state.sharedCode = code;
      showToast("Ready!");
      state.screen = "main";
      startPolling();
      render();
    } else {
      showToast("Enter a valid 6-digit code");
    }
  };
}

function resetRps() {
  state.myChoice = null;
  state.partnerChoice = null;
  save();
}

function renderResult() {
  const mine = state.myChoice;
  const theirs = state.partnerChoice;
  let outcome = "It's a tie";
  let emoji = "\ud83e\udd1d";

  if (mine === theirs) {
    outcome = "It's a tie";
  } else if (
    (mine === "rock" && theirs === "scissors") ||
    (mine === "paper" && theirs === "rock") ||
    (mine === "scissors" && theirs === "paper")
  ) {
    outcome = "You win";
    emoji = "\ud83c\udf89";
  } else {
    outcome = "They win";
    emoji = "\ud83d\ude05";
  }

  const icons = { rock: "\u270a", paper: "\u270b", scissors: "\u270c\ufe0f" };

  app.innerHTML = `
    <div class="screen">
      <h1>Result</h1>
      <div class="result-emoji">${emoji}</div>
      <div class="result-text">${outcome}</div>
      <div class="vs">
        <div>${icons[mine]}<small>You</small></div>
        <div>${icons[theirs]}<small>Them</small></div>
      </div>
      <button class="big-button" onclick="resetRps(); go('main')">Done</button>
    </div>
  `;

  vibrate([25, 35, 25]);
}

window.go = function(screen) {
  state.screen = screen;
  render();
};

load();
if (state.paired || state.sharedCode) startPolling();
render();

async function subscribePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: "BDWXZ5nZn12ucAKX68uebBm5J9Q77llfrAowDxwzxqAPPnyx5HRdaUdTVedIbUzbu2nt3RLXbUQWI2jM-WNwu0E"
    });
    const code = state.sharedCode || state.partnerCode || state.myCode;
    if (code && sub) {
      await fetch(`/api/pair?code=${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: myId, subscription: sub })
      });
    }
  } catch (e) {}
}
setTimeout(subscribePush, 2000);
