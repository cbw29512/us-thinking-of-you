// Us — Thinking of You
// Single-screen simple version

const STORAGE_KEY = "us-app-v2";

let state = {
  paired: false,
  myCode: null,
  partnerCode: null,
  partnerName: "them",
  screen: "main",
  myChoice: null,
  partnerChoice: null,
  lastHeart: null,
  lastMood: null
};

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) Object.assign(state, JSON.parse(saved));
  } catch (e) {}
  if (!state.myCode) state.myCode = generateCode();

  // Auto-pair if someone scanned a QR
  const params = new URLSearchParams(window.location.search);
  const pairCode = params.get("pair");
  if (pairCode && pairCode.length === 5 && pairCode !== state.myCode && !state.paired) {
    state.paired = true;
    state.partnerCode = pairCode;
    state.screen = "main";
    history.replaceState({}, "", window.location.pathname);
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

const app = document.getElementById("app");

function render() {
  save();
  if (state.screen === "main") renderMain();
  else if (state.screen === "pair") renderPair();
  else if (state.screen === "result") renderResult();
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
      <p class="subtitle">${state.paired ? "Connected" : "A little something for the two of you."}</p>

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

      setTimeout(() => {
        const options = ["rock", "paper", "scissors"];
        state.partnerChoice = options[Math.floor(Math.random() * 3)];
        state.screen = "result";
        render();
      }, 1200);
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
  status.textContent = "Sent ❤️";
  showToast("Thinking of you sent");
  setTimeout(() => {
    if (document.getElementById("heartStatus")) {
      document.getElementById("heartStatus").textContent = "Heart sent";
    }
  }, 1400);
}

function renderPair() {
  const pairUrl = `${window.location.origin}${window.location.pathname}?pair=${state.myCode}`;

  app.innerHTML = `
    <div class="screen">
      <h1>Pair</h1>
      <p class="subtitle">Show this QR or share the code.</p>
      
      <div id="qrcode" style="margin: 20px auto; width: 180px; height: 180px; background: white; padding: 8px; border-radius: 12px;"></div>
      
      <div class="pair-code">${state.myCode}</div>
      <p class="status">Your code</p>
      
      <input type="text" placeholder="Or enter their code" id="codeInput" maxlength="5" inputmode="numeric">
      <button class="big-button" id="joinBtn">Connect</button>
      <button class="secondary" onclick="go('main')">Back</button>
    </div>
  `;

  // Generate QR
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

  document.getElementById("joinBtn").onclick = () => {
    const code = document.getElementById("codeInput").value.trim();
    if (code.length === 5 && code !== state.myCode) {
      state.paired = true;
      state.partnerCode = code;
      showToast("Paired!");
      vibrate([30, 40, 30]);
      state.screen = "main";
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

load();
render();