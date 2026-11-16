// Us — Thinking of You
// Single-screen simple version

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
  showInstallBanner();
});

function showInstallBanner() {
  if (document.getElementById("install-banner")) return;
  if (window.matchMedia("(display-mode: standalone)").matches) return;

  const banner = document.createElement("div");
  banner.id = "install-banner";
  banner.style.cssText = `
    position: fixed; bottom: 16px; left: 16px; right: 16px;
    background: #1c1c1c; border: 1px solid #333; border-radius: 14px;
    padding: 14px 16px; display: flex; align-items: center; gap: 12px;
    z-index: 20; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  `;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  banner.innerHTML = `
    <div style="flex:1; font-size:14px; line-height:1.35;">
      <strong>Add to Home Screen</strong><br>
      <span style="color:#888; font-size:13px;">${isIOS ? "Tap Share then \u201cAdd to Home Screen\u201d" : "One tap to install"}</span>
    </div>
    <button id="install-btn" style="background:#e63946; color:white; border:none; padding:10px 14px; border-radius:10px; font-weight:600; font-size:14px;">
      ${isIOS ? "How" : "Add"}
    </button>
    <button id="dismiss-install" style="background:none; border:none; color:#666; font-size:20px; padding:4px;">\u00d7</button>
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

  const pairCode = params.get("pair");
  if (pairCode && pairCode.length === 5 && pairCode !== state.myCode && !state.paired) {
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
  return Math.floor(10000 + Math.random() * 90000).toString();
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
        const sub = document.querySelector(".subtitle");
        if (sub) sub.textContent = "Connected — tap the heart";
        showToast("Connected");
      }

      for (const event of pair.events) {
        if (event.from === myId) continue;
        if (event.id <= (state.lastSeenEvent || 0)) continue;
        state.lastSeenEvent = event.id;
        handleIncoming(event);
      }
      save();
    } catch (e) {}
  }, 2500);
}

function handleIncoming(event) {
  if (event.type === "presence") return;
  if (event.type === "heart") {
    showToast("I love you ❤️");
    vibrate([60, 40, 60, 40, 60]);
    const status = document.getElementById("heartStatus");
    if (status) status.textContent = "I love you ❤️";
    explodeHearts();
  } else if (event.type === "mood") {
    showToast(`They're feeling ${event.payload?.mood || "something"}`);
    vibrate(30);
  } else if (event.type === "rps") {
    state.partnerChoice = event.payload?.choice;
    showToast("They played RPS");
    if (state.myChoice) {
      state.screen = "result";
      render();
    }
  }
}

function explodeHearts() {
  for (let i = 0; i < 24; i++) {
    const h = document.createElement("div");
    h.textContent = "❤️";
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
    <div class="screen" style="justify-content:flex-start; text-align:center; padding:40px 24px 32px;">
      <div style="font-size:48px; margin-bottom:8px;">❤️</div>
      <h1 style="font-size:36px; margin-bottom:12px;">Us</h1>
      <p style="font-size:17px; color:#aaa; line-height:1.4; margin-bottom:32px;">
        A tiny app for two people who want to feel a little closer during the day.
      </p>
      
      <div style="text-align:left; background:#161616; border-radius:16px; padding:20px; margin-bottom:28px;">
        <p style="font-size:15px; margin-bottom:14px;"><strong>Tap the heart</strong> — their phone fills with hearts and says “I love you.”</p>
        <p style="font-size:15px; margin-bottom:14px;"><strong>Share how you feel</strong> — good, tired, miss you, need a hug.</p>
        <p style="font-size:15px; margin-bottom:14px;"><strong>Play rock paper scissors</strong> — quick, silly, no chat needed.</p>
        <p style="font-size:15px; margin:0;"><strong>One QR code</strong> pairs you. No accounts, no passwords.</p>
      </div>
      
      <p style="font-size:14px; color:#888; margin-bottom:20px;">
        One person pays $1.99 a month. Both of you get it.
      </p>
      <button class="big-button" id="payBtn">Start for $1.99/mo</button>
      <p style="font-size:12px; color:#555; margin-top:14px;">Works on any phone. Add to home screen.</p>
    </div>
  `;

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
    { id: "stressed", label: "Stressed" },
    { id: "happy", label: "Happy" },
    { id: "hug", label: "Need a hug" },
    { id: "miss", label: "Miss you" }
  ];

  app.innerHTML = `
    <div class="screen">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h1>Us</h1>
        <button class="secondary" style="width:auto; padding:8px 14px; margin:0; font-size:13px;" onclick="go('pair')">Pair</button>
      </div>
      <p class="subtitle">${state.paired ? "Connected — tap the heart" : "Waiting for them..."}</p>

      <button class="heart-button" id="heartBtn" aria-label="Thinking of you">❤️</button>
      <div class="status" id="heartStatus">${state.lastHeart ? "Heart sent" : "Tap the heart"}</div>

      <div style="margin-top:28px;">
        <div style="font-size:14px; color:#888; margin-bottom:10px; text-align:center;">How are you?</div>
        <div class="mood-grid">
          ${moods.map(m => `<button class="mood-btn ${state.lastMood === m.id ? 'selected' : ''}" data-mood="${m.id}">${m.label}</button>`).join("")}
        </div>
      </div>

      <div style="margin-top:24px;">
        <div style="font-size:14px; color:#888; margin-bottom:10px; text-align:center;">Rock Paper Scissors</div>
        <div class="choice-grid">
          <button class="choice-btn" data-choice="rock">✊</button>
          <button class="choice-btn" data-choice="paper">✋</button>
          <button class="choice-btn" data-choice="scissors">✌️</button>
        </div>
        <div class="status" id="rpsStatus">Pick one</div>
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
}

function sendHeart() {
  const btn = document.getElementById("heartBtn");
  const status = document.getElementById("heartStatus");
  btn.classList.add("sent");
  setTimeout(() => btn.classList.remove("sent"), 400);
  vibrate(45);
  state.lastHeart = Date.now();
  save();
  status.textContent = "I love you sent ❤️";
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
      <p class="subtitle">Share the QR or link so they can join.</p>
      
      <div id="qrcode" style="margin: 20px auto; width: 180px; height: 180px; background: white; padding: 8px; border-radius: 12px;"></div>
      
      <div class="pair-code">${state.myCode}</div>
      <p class="status">Your code</p>

      <div style="background:#1a1a1a; border-radius:10px; padding:10px 12px; margin:16px 0; font-size:13px; word-break:break-all; color:#ccc;">
        ${pairUrl}
      </div>
      <button class="big-button" id="shareBtn">Share link</button>
      <button class="secondary" id="copyBtn">Copy link</button>
      
      <input type="text" placeholder="Or enter their code" id="codeInput" maxlength="5" inputmode="numeric">
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
      title: "Us — Thinking of You",
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
    if (code.length === 5 && code !== state.myCode) {
      state.paired = true;
      state.partnerCode = code;
      state.sharedCode = code;
      showToast("Paired!");
      vibrate([30, 40, 30]);
      state.screen = "main";
      startPolling();
      render();
    } else if (code.length === 5 && code === state.myCode) {
      state.paired = true;
      state.sharedCode = code;
      showToast("Ready!");
      state.screen = "main";
      startPolling();
      render();
    } else {
      showToast("Enter a valid 5-digit code");
    }
  };
}

function renderResult() {
  const mine = state.myChoice;
  const theirs = state.partnerChoice;
  let outcome = "It's a tie";
  let emoji = "🤝";

  if (mine === theirs) {
    outcome = "It's a tie";
  } else if (
    (mine === "rock" && theirs === "scissors") ||
    (mine === "paper" && theirs === "rock") ||
    (mine === "scissors" && theirs === "paper")
  ) {
    outcome = "You win";
    emoji = "🎉";
  } else {
    outcome = "They win";
    emoji = "😅";
  }

  const icons = { rock: "✊", paper: "✋", scissors: "✌️" };

  app.innerHTML = `
    <div class="screen">
      <h1>Result</h1>
      <div class="result-emoji">${emoji}</div>
      <div class="result-text">${outcome}</div>
      <div class="vs">
        <div>${icons[mine]}<small>You</small></div>
        <div>${icons[theirs]}<small>Them</small></div>
      </div>
      <button class="big-button" onclick="go('main')">Done</button>
    </div>
  `;

  vibrate([25, 35, 25]);
}

window.go = function(screen) {
  state.screen = screen;
  render();
};

if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
  setTimeout(showInstallBanner, 2000);
}

load();
if (state.paired || state.sharedCode) startPolling();
render();