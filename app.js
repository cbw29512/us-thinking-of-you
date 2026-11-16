// Us — Thinking of You
// Lightweight couples web app (client-side demo with localStorage)

const STORAGE_KEY = "us-app-v1";

let state = {
  paired: false,
  myCode: null,
  partnerCode: null,
  partnerName: "them",
  screen: "home",
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
  setTimeout(() => t.classList.remove("show"), 1800);
}

const app = document.getElementById("app");

function render() {
  save();
  if (state.screen === "home") renderHome();
  else if (state.screen === "pair") renderPair();
  else if (state.screen === "rps") renderRPS();
  else if (state.screen === "result") renderResult();
  else if (state.screen === "mood") renderMood();
}

function nav() {
  return `
    <div class="nav">
      <button class="${state.screen === 'home' ? 'active' : ''}" onclick="go('home')">Home</button>
      <button class="${state.screen === 'mood' ? 'active' : ''}" onclick="go('mood')">Mood</button>
      <button class="${state.screen === 'rps' || state.screen === 'result' ? 'active' : ''}" onclick="go('rps')">RPS</button>
      <button onclick="go('pair')">Pair</button>
    </div>
  `;
}

window.go = function(screen) {
  state.screen = screen;
  render();
};

function renderHome() {
  const paired = state.paired;
  app.innerHTML = `
    <div class="screen">
      <h1>Us</h1>
      <p class="subtitle">${paired ? "Connected with " + state.partnerName : "A little something for the two of you."}</p>
      
      <button class="heart-button" id="heartBtn" aria-label="Thinking of you">❤️</button>
      <div class="status" id="heartStatus">
        ${state.lastHeart ? "Last sent just now" : "Tap to let them know you're thinking of them"}
      </div>
      
      ${nav()}
    </div>
  `;

  document.getElementById("heartBtn").onclick = sendHeart;
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
      document.getElementById("heartStatus").textContent = "Tap to send another";
    }
  }, 1600);
}

function renderPair() {
  app.innerHTML = `
    <div class="screen">
      <h1>Pair</h1>
      <p class="subtitle">Share your code so they can connect with you.</p>
      
      <div class="pair-code">${state.myCode}</div>
      <p class="status">Your code</p>
      
      <input type="text" placeholder="Enter their code" id="codeInput" maxlength="5" inputmode="numeric">
      <button class="big-button" id="joinBtn">Connect</button>
      <button class="secondary" id="unpairBtn" style="display:${state.paired ? 'block' : 'none'}">Unpair</button>
      
      ${nav()}
    </div>
  `;

  document.getElementById("joinBtn").onclick = () => {
    const code = document.getElementById("codeInput").value.trim();
    if (code.length === 5 && code !== state.myCode) {
      state.paired = true;
      state.partnerCode = code;
      state.partnerName = "them";
      showToast("Paired!");
      vibrate([30, 40, 30]);
      state.screen = "home";
      render();
    } else {
      showToast("Enter a valid 5-digit code");
    }
  };

  const unpair = document.getElementById("unpairBtn");
  if (unpair) unpair.onclick = () => {
    state.paired = false;
    state.partnerCode = null;
    showToast("Unpaired");
    render();
  };
}

function renderMood() {
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
      <h1>How are you?</h1>
      <p class="subtitle">One tap. They'll see it.</p>
      
      <div class="mood-grid">
        ${moods.map(m => `<button class="mood-btn" data-mood="${m.id}">${m.label}</button>`).join("")}
      </div>
      
      <div class="status" id="moodStatus">${state.lastMood ? "Last: " + state.lastMood : "Pick one"}</div>
      
      ${nav()}
    </div>
  `;

  document.querySelectorAll(".mood-btn").forEach(btn => {
    btn.onclick = () => {
      const mood = btn.dataset.mood;
      state.lastMood = mood;
      save();
      vibrate(35);
      showToast("Mood sent");
      document.getElementById("moodStatus").textContent = "Sent: " + btn.textContent;
      document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    };
  });
}

function renderRPS() {
  app.innerHTML = `
    <div class="screen">
      <h1>Rock Paper Scissors</h1>
      <p class="subtitle">Pick one. They'll get notified.</p>
      
      <div class="choice-grid">
        <button class="choice-btn" data-choice="rock">✊</button>
        <button class="choice-btn" data-choice="paper">✋</button>
        <button class="choice-btn" data-choice="scissors">✌️</button>
      </div>
      
      <div class="status" id="rpsStatus">Choose your move</div>
      
      ${nav()}
    </div>
  `;

  document.querySelectorAll(".choice-btn").forEach(btn => {
    btn.onclick = () => {
      const choice = btn.dataset.choice;
      state.myChoice = choice;
      
      document.querySelectorAll(".choice-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      
      vibrate(30);
      
      const status = document.getElementById("rpsStatus");
      status.textContent = "Sent. Waiting for them...";
      status.classList.add("waiting");
      
      // Demo: simulate partner after short delay
      setTimeout(() => {
        const options = ["rock", "paper", "scissors"];
        state.partnerChoice = options[Math.floor(Math.random() * 3)];
        state.screen = "result";
        render();
      }, 1400);
    };
  });
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
      
      <button class="big-button" id="againBtn">Play again</button>
      <button class="secondary" onclick="go('home')">Home</button>
      
      ${nav()}
    </div>
  `;

  vibrate([25, 35, 25]);

  document.getElementById("againBtn").onclick = () => {
    state.myChoice = null;
    state.partnerChoice = null;
    state.screen = "rps";
    render();
  };
}

// Boot
load();
render();