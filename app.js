const STORAGE_KEY = "kts-kabaddi-state-2026";

let state = {
  homeName: "PATNA PIRATES",
  awayName: "BENGAL WARRIORS",
  currentHalf: 1,
  halves: Array(2).fill().map(() => ({ homeScore:0, awayScore:0 })),
  raidingTeam: "home",           // "home", "away", "none"
  gameTime: 1200,                // 20:00
  raidTime: 30,
  gameRunning: false,
  raidRunning: false,
  vmix: {
    connected: false,
    ip: "127.0.0.1",
    port: 8088,
    input: "1"
  }
};

let gameTimerId  = null;
let raidTimerId  = null;

// ──── DOM elements ───────────────────────────────
const els = {
  homeNamePrev:     document.getElementById("homeNamePrev"),
  awayNamePrev:     document.getElementById("awayNamePrev"),
  homeScorePrev:    document.getElementById("homeScorePrev"),
  awayScorePrev:    document.getElementById("awayScorePrev"),
  halfPrev:         document.getElementById("halfPrev"),
  raidingTeamPrev:  document.getElementById("raidingTeamPrev"),
  gameTimerPrev:    document.getElementById("gameTimerPrev"),
  raidTimerPrev:    document.getElementById("raidTimerPrev"),
  homeRaidArrow:    document.getElementById("homeRaidArrow"),
  awayRaidArrow:    document.getElementById("awayRaidArrow"),

  homeNameCtrl:     document.getElementById("homeNameCtrl"),
  awayNameCtrl:     document.getElementById("awayNameCtrl"),
  homeScoreCtrl:    document.getElementById("homeScoreCtrl"),
  awayScoreCtrl:    document.getElementById("awayScoreCtrl"),
  gameTimerCtrl:    document.getElementById("gameTimerCtrl"),
  raidTimerCtrl:    document.getElementById("raidTimerCtrl"),

  halfSelect:       document.getElementById("halfSelect"),
  vmixModal:        document.getElementById("vmixModal"),
};

// ──── Helpers ────────────────────────────────────
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      Object.assign(state, JSON.parse(data));
    } catch {}
  }
}

function getHalf() {
  return state.halves[state.currentHalf - 1];
}

function totalHome() { return state.halves.reduce((s,q)=>s+q.homeScore,0); }
function totalAway() { return state.halves.reduce((s,q)=>s+q.awayScore,0); }

function pad(n) { return n<10 ? "0"+n : n; }
function formatGameTimer(s) {
  const m = Math.floor(s/60);
  const sec = s%60;
  return `${m}:${pad(sec)}`;
}

function parseTimer(str) {
  str = String(str || '0:00').trim();
  if (!str.includes(':')) return parseInt(str,10)||0;
  const [m,s] = str.split(':').map(Number);
  return (m||0)*60 + (s||0);
}

function updateAllDisplays() {
  const h = getHalf();

  // Preview
  els.homeNamePrev.textContent   = state.homeName;
  els.awayNamePrev.textContent   = state.awayName;
  els.homeScorePrev.textContent  = totalHome();
  els.awayScorePrev.textContent  = totalAway();
  els.halfPrev.textContent       = state.currentHalf === 1 ? "1ST HALF" : "2ND HALF";

  const raider = state.raidingTeam === "home" ? state.homeName : state.awayName;
  els.raidingTeamPrev.textContent = state.raidingTeam === "none" ? "NO RAID" : `RAID: ${raider}`;
  els.homeRaidArrow.textContent  = state.raidingTeam === "home" ? "←" : "";
  els.awayRaidArrow.textContent  = state.raidingTeam === "away" ? "→" : "";

  els.gameTimerPrev.textContent  = formatGameTimer(state.gameTime);
  els.raidTimerPrev.textContent  = state.raidTime;

  // Controls
  els.homeNameCtrl.textContent   = state.homeName;
  els.awayNameCtrl.textContent   = state.awayName;
  els.homeScoreCtrl.textContent  = totalHome();
  els.awayScoreCtrl.textContent  = totalAway();
  els.gameTimerCtrl.textContent  = formatGameTimer(state.gameTime);
  els.raidTimerCtrl.textContent  = state.raidTime;

  // vMix
  if (state.vmix.connected) syncVmix();
}

function syncVmix() {
  if (!state.vmix.connected) return;
  const base = `http://${state.vmix.ip}:${state.vmix.port}/api/?`;
  const input = `Input=${encodeURIComponent(state.vmix.input)}`;
  console.log(input);
  

  const texts = [
    ["Team 1 Name.Text",        state.homeName],
    ["Team 2 Name.Text",        state.awayName],
    ["HALF NAME.Text",        state.currentHalf === 1 ? "1ST HALF" : "2ND HALF"],
    ["CLOCK.Text",       formatGameTimer(state.gameTime)],
    ["RAIDER_CLOCK.Text",       state.raidTime.toString()],
    ["HOME_SCORE.Text",       totalHome().toString()],
    ["AWAY_SCORE.Text",       totalAway().toString()],
    ["RAIDING TEAM.Text",     state.raidingTeam === "none" ? "" : (state.raidingTeam === "home" ? state.homeName : state.awayName)],
    ["HOME RAID ARROW.Text",  state.raidingTeam === "home" ? "←" : ""],
    ["AWAY RAID ARROW.Text",  state.raidingTeam === "away" ? "→" : ""],
  ];

  texts.forEach(([name, val]) => {
    fetch(base + `Function=SetText&${input}&SelectedName=${encodeURIComponent(name)}&Value=${encodeURIComponent(val)}`)
      .catch(() => {});
  });
}

// ──── Swap Teams ─────────────────────────────────
function swapTeams() {
  [state.homeName, state.awayName] = [state.awayName, state.homeName];
  state.halves.forEach(h => {
    [h.homeScore, h.awayScore] = [h.awayScore, h.homeScore];
  });
  if (state.raidingTeam !== "none") {
    state.raidingTeam = state.raidingTeam === "home" ? "away" : "home";
  }
  updateAllDisplays();
  saveState();
  if (state.vmix.connected) syncVmix();
}

// ──── Timers ─────────────────────────────────────
function startGameTimer() {
  if (state.gameRunning) return;
  state.gameRunning = true;
  gameTimerId = setInterval(() => {
    if (state.gameTime <= 0) {
      clearInterval(gameTimerId);
      state.gameRunning = false;
      updateAllDisplays();
      return;
    }
    state.gameTime--;
    updateAllDisplays();
    saveState();
  }, 980);
}

function pauseGameTimer() {
  clearInterval(gameTimerId);
  state.gameRunning = false;
  updateAllDisplays();
}

function resetGameTimer() {
  pauseGameTimer();
  state.gameTime = 1200;
  updateAllDisplays();
}

function startRaidTimer() {
  if (state.raidRunning) clearInterval(raidTimerId);
  state.raidTime = 30;
  state.raidRunning = true;
  updateAllDisplays();

  raidTimerId = setInterval(() => {
    if (state.raidTime <= 0) {
      clearInterval(raidTimerId);
      state.raidRunning = false;
      updateAllDisplays();
      return;
    }
    state.raidTime--;
    updateAllDisplays();
  }, 980);
}

function stopRaidTimer() {
  clearInterval(raidTimerId);
  state.raidRunning = false;
  state.raidTime = 30;
  updateAllDisplays();
}

// ──── Editable fields ────────────────────────────
function makeEditable(el, getValue, setValue, isTimer = false) {
  el.addEventListener("click", () => {
    const old = el.innerText;
    const input = document.createElement("input");
    input.type = "text";
    input.value = getValue();
    input.className = "bg-transparent text-center w-full outline-none border-b-2 border-blue-500 text-inherit font-inherit";
    el.innerHTML = "";
    el.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
      let v = input.value.trim();
      if (isTimer) {
        v = parseTimer(v);
      } else {
        v = parseInt(v, 10) || 0;
      }
      setValue(v);
      updateAllDisplays();
      saveState();
      if (state.vmix.connected) syncVmix();
    };

    input.onblur = commit;
    input.onkeydown = e => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") el.innerText = old;
    };
  });
}

// ──── Init ───────────────────────────────────────
function init() {
  loadState();

  // Half change
  els.halfSelect.value = state.currentHalf;
  els.halfSelect.addEventListener("change", e => {
    state.currentHalf = parseInt(e.target.value);
    updateAllDisplays();
    saveState();
  });

  // Swap
  document.getElementById("swapTeamsBtn").onclick = swapTeams;

  // Reset
  document.getElementById("resetBtn").onclick = () => {
    if (!confirm("Reset everything to default?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };

  // Game Timer controls
  document.getElementById("startGame").onclick = startGameTimer;
  document.getElementById("pauseGame").onclick = pauseGameTimer;
  document.getElementById("resetGame").onclick = resetGameTimer;

  document.querySelectorAll("[data-timer-adjust]").forEach(btn => {
    btn.onclick = () => {
      const v = parseInt(btn.dataset.timerAdjust);
      state.gameTime = Math.max(0, Math.min(1500, state.gameTime + v));
      updateAllDisplays();
      saveState();
    };
  });

  // Raid controls
  document.getElementById("raidIn").onclick = () => {
    if (state.raidingTeam === "none") {
      alert("Select raiding team first (click team name)");
      return;
    }
    startRaidTimer();
  };
  document.getElementById("raidOut").onclick = stopRaidTimer;
  document.getElementById("resetRaid").onclick = () => {
    stopRaidTimer();
    state.raidTime = 30;
    updateAllDisplays();
  };

  // Scoring
  document.querySelectorAll("[data-home-score]").forEach(b => {
    b.onclick = () => {
      const v = parseInt(b.dataset.homeScore);
      getHalf().homeScore = Math.max(0, getHalf().homeScore + v);
      updateAllDisplays();
      saveState();
    };
  });

  document.querySelectorAll("[data-away-score]").forEach(b => {
    b.onclick = () => {
      const v = parseInt(b.dataset.awayScore);
      getHalf().awayScore = Math.max(0, getHalf().awayScore + v);
      updateAllDisplays();
      saveState();
    };
  });

  // All Out & Bonus
  document.getElementById("homeAllOut").onclick = () => {
    getHalf().homeScore += 2;
    updateAllDisplays();
    saveState();
  };
  document.getElementById("awayAllOut").onclick = () => {
    getHalf().awayScore += 2;
    updateAllDisplays();
    saveState();
  };
  document.getElementById("homeBonus").onclick = () => {
    getHalf().homeScore += 1;
    updateAllDisplays();
    saveState();
  };
  document.getElementById("awayBonus").onclick = () => {
    getHalf().awayScore += 1;
    updateAllDisplays();
    saveState();
  };

  // Raid team = click team name in control
  els.homeNameCtrl.onclick = () => {
    state.raidingTeam = "home";
    updateAllDisplays();
  };
  els.awayNameCtrl.onclick = () => {
    state.raidingTeam = "away";
    updateAllDisplays();
  };

  // Editable
  makeEditable(els.homeNameCtrl,   () => state.homeName,   v => state.homeName = v.toUpperCase());
  makeEditable(els.awayNameCtrl,   () => state.awayName,   v => state.awayName = v.toUpperCase());

  makeEditable(els.homeScoreCtrl,  () => totalHome().toString(), v => {
    const diff = (parseInt(v)||0) - totalHome();
    getHalf().homeScore = Math.max(0, getHalf().homeScore + diff);
  });

  makeEditable(els.awayScoreCtrl,  () => totalAway().toString(), v => {
    const diff = (parseInt(v)||0) - totalAway();
    getHalf().awayScore = Math.max(0, getHalf().awayScore + diff);
  });

  makeEditable(els.gameTimerCtrl,  () => formatGameTimer(state.gameTime), v => {
    state.gameTime = parseTimer(v);
    if (state.gameTime < 0) state.gameTime = 0;
  }, true);

  // vMix modal
  document.getElementById("vmixBtn").onclick = () => els.vmixModal.classList.remove("hidden");
  document.getElementById("vmixClose").onclick = () => els.vmixModal.classList.add("hidden");
  document.getElementById("vmixForm").onsubmit = e => {
    e.preventDefault();
    state.vmix.ip   = document.getElementById("vmixIP").value.trim();
    state.vmix.port = parseInt(document.getElementById("vmixPort").value) || 8088;
    state.vmix.input = document.getElementById("vmixInput").value.trim();
    state.vmix.connected = true;
    els.vmixModal.classList.add("hidden");
    document.getElementById("vmixStatus").textContent = "Connected ✓";
    syncVmix();
    saveState();
  };

  // Prevent accidental close
  window.addEventListener("beforeunload", e => {
    if (state.gameRunning || state.raidRunning) {
      e.preventDefault();
      e.returnValue = "Timer is running! Sure?";
    }
  });

  updateAllDisplays();

  if (state.gameRunning) startGameTimer();
  if (state.raidRunning) startRaidTimer();
}

document.addEventListener("DOMContentLoaded", init);
