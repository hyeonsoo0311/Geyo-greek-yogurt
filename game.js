const GAME_DURATION = 90;
const MAX_HP = 100;
const MAX_FOCUS = 100;
const CAFFEINE_DANGER = 400;
const CAFFEINE_EMERGENCY = 1000;
const DRINK_COOLDOWN = 1100;

const drinks = [
  {
    id: "coffee",
    name: "GEGA COFFEE",
    subtitle: "아이스 아메리카노",
    accent: "#78d5b0",
    hp: 20,
    focus: 18,
    caffeine: 145,
    message: "차가운 커피로 정신이 번쩍 들었다.",
  },
  {
    id: "redbear",
    name: "RED BEAR",
    subtitle: "고카페인 탄산음료",
    accent: "#ff655f",
    hp: 20,
    focus: 25,
    caffeine: 180,
    message: "강한 탄산과 카페인이 집중력을 끌어올렸다.",
  },
  {
    id: "lemon",
    name: "그요 레몬쥬스",
    subtitle: "착즙 레몬주스",
    accent: "#ffd44d",
    hp: 20,
    focus: 7,
    caffeine: -35,
    vitamin: 1,
    message: "상큼한 착즙 레몬으로 표정이 조금 밝아졌다.",
  },
  {
    id: "tea",
    name: "그요 BOSS TEA",
    subtitle: "편안한 티",
    accent: "#b38cff",
    hp: 20,
    focus: 4,
    caffeine: -55,
    relax: 1,
    message: "따뜻한 차를 마시니 어깨의 힘이 풀렸다.",
  },
];

const randomEvents = [
  { text: "팀장님이 보고서 수정을 요청했다.", hp: -7, focus: -5 },
  { text: "회의가 예상보다 15분 길어졌다.", hp: -6, focus: -4 },
  { text: "메일함에 읽지 않은 메일 12개가 생겼다.", hp: -5, focus: -3 },
  { text: "동료가 간식을 나눠줬다.", hp: 7, focus: 2 },
  { text: "방금 작성한 문서가 자동 저장되었다.", hp: 2, focus: 7 },
  { text: "갑자기 급한 업무가 하나 추가됐다.", hp: -8, focus: -6, task: 1 },
];

const state = {
  gender: "male",
  hp: MAX_HP,
  focus: 45,
  caffeine: 0,
  peakCaffeine: 0,
  vitamin: 0,
  relax: 0,
  elapsed: 0,
  tasks: 7,
  paused: true,
  started: false,
  ended: false,
  drinkCounts: Object.fromEntries(drinks.map((drink) => [drink.id, 0])),
  cooldowns: Object.fromEntries(drinks.map((drink) => [drink.id, false])),
  log: [],
};

const elements = {
  workerSprite: document.querySelector("#workerSprite"),
  workerName: document.querySelector("#workerName"),
  moodLabel: document.querySelector("#moodLabel"),
  floatingEffect: document.querySelector("#floatingEffect"),
  dangerOverlay: document.querySelector("#dangerOverlay"),
  hpValue: document.querySelector("#hpValue"),
  hpBar: document.querySelector("#hpBar"),
  focusValue: document.querySelector("#focusValue"),
  focusBar: document.querySelector("#focusBar"),
  caffeineValue: document.querySelector("#caffeineValue"),
  caffeineBar: document.querySelector("#caffeineBar"),
  vitaminValue: document.querySelector("#vitaminValue"),
  vitaminPips: document.querySelector("#vitaminPips"),
  relaxValue: document.querySelector("#relaxValue"),
  relaxPips: document.querySelector("#relaxPips"),
  remainingTime: document.querySelector("#remainingTime"),
  taskCount: document.querySelector("#taskCount"),
  eventList: document.querySelector("#eventList"),
  gameStatus: document.querySelector("#gameStatus"),
  drinkGrid: document.querySelector("#drinkGrid"),
  startScreen: document.querySelector("#startScreen"),
  resultScreen: document.querySelector("#resultScreen"),
  resultKicker: document.querySelector("#resultKicker"),
  resultTitle: document.querySelector("#resultTitle"),
  resultDescription: document.querySelector("#resultDescription"),
  resultStats: document.querySelector("#resultStats"),
  pauseButton: document.querySelector("#pauseButton"),
  pauseLabel: document.querySelector("#pauseLabel"),
  ambulanceScene: document.querySelector("#ambulanceScene"),
};

let gameTimer;
let eventTimer;
let effectTimer;
let ambulanceTimer;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildPips(target) {
  target.replaceChildren(
    ...Array.from({ length: 3 }, () => {
      const pip = document.createElement("span");
      pip.className = "pip";
      return pip;
    }),
  );
}

function buildDrinks() {
  elements.drinkGrid.replaceChildren(
    ...drinks.map((drink, index) => {
      const button = document.createElement("button");
      button.className = "drink-card";
      button.type = "button";
      button.dataset.drink = drink.id;
      button.style.setProperty("--drink-accent", drink.accent);
      button.innerHTML = `
        <span class="drink-count" data-count="${drink.id}">0</span>
        <span class="drink-sprite" style="--drink-index:${index}" aria-hidden="true"></span>
        <span class="drink-copy">
          <strong>${drink.name}</strong>
          <small>${drink.subtitle}</small>
        </span>
        <span class="cooldown-mask" data-cooldown="${drink.id}"></span>
      `;
      button.addEventListener("click", () => serveDrink(drink.id));
      return button;
    }),
  );
}

function resetState(gender = state.gender) {
  Object.assign(state, {
    gender,
    hp: MAX_HP,
    focus: 45,
    caffeine: 0,
    peakCaffeine: 0,
    vitamin: 0,
    relax: 0,
    elapsed: 0,
    tasks: 7,
    paused: false,
    started: true,
    ended: false,
    drinkCounts: Object.fromEntries(drinks.map((drink) => [drink.id, 0])),
    cooldowns: Object.fromEntries(drinks.map((drink) => [drink.id, false])),
    log: [],
  });
  clearTimers();
  addLog(`${gender === "male" ? "김대리" : "이대리"}가 업무를 시작했다.`);
  addLog("음료를 제공해 HP를 관리하고 퇴근까지 버티세요.");
  elements.resultScreen.classList.add("is-hidden");
  elements.startScreen.classList.add("is-hidden");
  elements.ambulanceScene.classList.remove("is-active");
  startTimers();
  render();
}

function startTimers() {
  gameTimer = window.setInterval(gameTick, 1000);
  eventTimer = window.setInterval(triggerRandomEvent, 12000);
}

function clearTimers() {
  window.clearInterval(gameTimer);
  window.clearInterval(eventTimer);
  window.clearTimeout(ambulanceTimer);
}

function gameTick() {
  if (state.paused || state.ended) return;

  state.elapsed += 1;
  const hpDrain = state.caffeine > CAFFEINE_DANGER ? 2.1 : 1.15;
  const relaxShield = state.relax >= 3 ? 0.45 : 0;
  state.hp = clamp(state.hp - hpDrain + relaxShield, 0, MAX_HP);
  state.focus = clamp(state.focus - (state.caffeine > 0 ? 0.08 : 0.35), 0, MAX_FOCUS);
  state.caffeine = clamp(state.caffeine - 1.6, 0, CAFFEINE_EMERGENCY + 200);

  if (state.elapsed % 13 === 0 && state.tasks > 0) {
    state.tasks -= 1;
    addLog(`업무 하나를 처리했다. 남은 업무 ${state.tasks}건.`);
  }

  if (state.hp <= 0) {
    endGame("burnout");
    return;
  }

  if (state.elapsed >= GAME_DURATION) {
    endGame("success");
    return;
  }

  render();
}

function triggerRandomEvent() {
  if (state.paused || state.ended) return;

  const event = randomEvents[Math.floor(Math.random() * randomEvents.length)];
  state.hp = clamp(state.hp + event.hp, 0, MAX_HP);
  state.focus = clamp(state.focus + event.focus, 0, MAX_FOCUS);
  state.tasks = Math.max(0, state.tasks + (event.task || 0));
  addLog(event.text);
  showEffect(event.hp > 0 ? `HP +${event.hp}` : `업무 이벤트 ${event.hp} HP`);
  render();
}

function serveDrink(drinkId) {
  if (!state.started || state.paused || state.ended || state.cooldowns[drinkId]) return;

  const drink = drinks.find((item) => item.id === drinkId);
  state.drinkCounts[drinkId] += 1;
  state.hp = clamp(state.hp + drink.hp, 0, MAX_HP);
  state.focus = clamp(state.focus + drink.focus, 0, MAX_FOCUS);
  state.caffeine = clamp(state.caffeine + drink.caffeine, 0, CAFFEINE_EMERGENCY + 200);
  state.peakCaffeine = Math.max(state.peakCaffeine, state.caffeine);
  state.vitamin += drink.vitamin || 0;
  state.relax += drink.relax || 0;
  addLog(drink.message);

  if (state.caffeine >= CAFFEINE_EMERGENCY) {
    render();
    triggerEmergencyEnding();
    return;
  }

  if (state.caffeine > CAFFEINE_DANGER) {
    state.hp = clamp(state.hp - 8, 0, MAX_HP);
    showEffect(drink.name);
  } else if (drinkId === "lemon" && state.vitamin >= 3) {
    showEffect("VITAMIN UP! 얼굴이 밝아졌다");
    addLog("그요 레몬쥬스 3잔째. 비타민 효과로 얼굴이 환해졌다.");
  } else if (drinkId === "tea" && state.relax >= 3) {
    showEffect("RELAX");
    addLog("그요 BOSS TEA 3병째. 마음이 평온해졌다.");
  } else {
    showEffect(drink.name);
  }

  beginCooldown(drinkId);
  render();
}

function beginCooldown(drinkId) {
  state.cooldowns[drinkId] = true;
  const button = document.querySelector(`[data-drink="${drinkId}"]`);
  const mask = button.querySelector(".cooldown-mask");
  button.disabled = true;
  mask.animate([{ height: "100%" }, { height: "0%" }], {
    duration: DRINK_COOLDOWN,
    easing: "linear",
  });
  window.setTimeout(() => {
    state.cooldowns[drinkId] = false;
    if (!state.ended) button.disabled = false;
  }, DRINK_COOLDOWN);
}

function getExpression() {
  if (state.caffeine > CAFFEINE_DANGER) {
    return { col: 2, label: "업무를 계속하는 중", className: "is-caffeinated" };
  }
  if (state.relax >= 3) {
    return { col: 4, label: "Relax 효과로 평온한 상태", className: "is-relaxed" };
  }
  if (state.vitamin >= 3) {
    return { col: 3, label: "비타민 효과로 얼굴이 밝아짐", className: "is-happy" };
  }
  if (state.hp < 38 || state.focus < 24) {
    return { col: 1, label: "체력이 떨어져 지친 상태", className: "" };
  }
  return { col: 0, label: "집중해서 일하는 중", className: "" };
}

function render() {
  const expression = getExpression();
  const remaining = Math.max(0, GAME_DURATION - state.elapsed);
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  const hpPercent = (state.hp / MAX_HP) * 100;
  const caffeinePercent = Math.min(100, (state.caffeine / CAFFEINE_EMERGENCY) * 100);

  elements.workerSprite.style.setProperty("--row", state.gender === "male" ? 0 : 1);
  elements.workerSprite.style.setProperty("--col", expression.col);
  elements.workerSprite.className = `worker-sprite ${expression.className}`;
  elements.workerName.textContent = state.gender === "male" ? "김대리" : "이대리";
  elements.moodLabel.textContent = expression.label;
  elements.hpValue.textContent = `${Math.ceil(state.hp)} / ${MAX_HP}`;
  elements.hpBar.style.width = `${hpPercent}%`;
  elements.hpBar.style.background = hpPercent < 30 ? "#ff2e36" : "#ff4f57";
  elements.focusValue.textContent = Math.round(state.focus);
  elements.focusBar.style.width = `${state.focus}%`;
  elements.caffeineValue.textContent = `${Math.round(state.caffeine)}mg`;
  elements.caffeineBar.style.width = `${caffeinePercent}%`;
  elements.caffeineBar.style.background = state.caffeine > CAFFEINE_DANGER ? "#ff5a62" : "#77d68a";
  elements.vitaminValue.textContent = `${Math.min(state.vitamin, 3)} / 3`;
  elements.relaxValue.textContent = `${Math.min(state.relax, 3)} / 3`;
  elements.remainingTime.textContent = `${minutes}:${seconds}`;
  elements.taskCount.textContent = `${state.tasks}건 남음`;
  elements.gameStatus.textContent = state.paused ? "일시정지" : "근무 중";
  elements.pauseLabel.textContent = state.paused ? "계속하기" : "일시정지";
  elements.dangerOverlay.classList.toggle("is-active", state.hp < 28);

  updatePips(elements.vitaminPips, state.vitamin);
  updatePips(elements.relaxPips, state.relax);
  updateDrinkCards();
  renderLog();
}

function updatePips(container, value) {
  [...container.children].forEach((pip, index) => {
    pip.classList.toggle("is-active", index < value);
  });
}

function updateDrinkCards() {
  drinks.forEach((drink) => {
    const count = document.querySelector(`[data-count="${drink.id}"]`);
    const button = document.querySelector(`[data-drink="${drink.id}"]`);
    count.textContent = state.drinkCounts[drink.id];
    button.disabled = state.ended || state.paused || state.cooldowns[drink.id];
  });
}

function addLog(message) {
  const elapsed = Math.min(state.elapsed, GAME_DURATION);
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  state.log.unshift(`[${minutes}:${seconds}] ${message}`);
  state.log = state.log.slice(0, 6);
}

function renderLog() {
  elements.eventList.replaceChildren(
    ...state.log.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    }),
  );
}

function showEffect(message) {
  window.clearTimeout(effectTimer);
  elements.floatingEffect.textContent = message;
  elements.floatingEffect.classList.remove("is-visible");
  void elements.floatingEffect.offsetWidth;
  elements.floatingEffect.classList.add("is-visible");
  effectTimer = window.setTimeout(() => {
    elements.floatingEffect.classList.remove("is-visible");
  }, 1000);
}

function togglePause() {
  if (!state.started || state.ended) return;
  state.paused = !state.paused;
  addLog(state.paused ? "잠시 숨을 고르는 중." : "업무를 다시 시작했다.");
  render();
}

function triggerEmergencyEnding() {
  state.ended = true;
  state.paused = true;
  clearTimers();
  render();
  elements.ambulanceScene.classList.add("is-active");
  elements.gameStatus.textContent = "응급실 이송";
  ambulanceTimer = window.setTimeout(() => endGame("emergency"), 1800);
}

function endGame(outcome) {
  const success = outcome === "success";
  const emergency = outcome === "emergency";
  state.ended = true;
  state.paused = true;
  clearTimers();
  elements.ambulanceScene.classList.remove("is-active");
  elements.resultKicker.textContent = emergency ? "EMERGENCY ROOM" : success ? "18:00 · CLOCK OUT" : "BURNOUT";
  elements.resultTitle.textContent = emergency
    ? "응급실로 실려갔습니다"
    : success
      ? "오늘도 무사 퇴근"
      : "HP가 0이 되었습니다";
  elements.resultDescription.textContent = emergency
    ? "카페인이 1000mg을 넘었습니다. 오늘의 퇴근지는 집이 아니라 응급실입니다."
    : success
      ? "음료 선택과 타이밍 관리로 평범하지만 중요한 하루를 버텼습니다."
      : "퇴근보다 먼저 체력이 끝났습니다. 다음 출근에는 음료 타이밍을 바꿔보세요.";
  elements.resultStats.innerHTML = `
    <div><span>최종 HP</span><strong>${Math.ceil(state.hp)}</strong></div>
    <div><span>총 음료</span><strong>${Object.values(state.drinkCounts).reduce((a, b) => a + b, 0)}잔</strong></div>
    <div><span>최고 카페인</span><strong>${Math.round(state.peakCaffeine)}mg</strong></div>
  `;
  elements.resultScreen.classList.remove("is-hidden");
  render();
}

function chooseCharacter(event) {
  const button = event.target.closest("[data-gender]");
  if (!button) return;
  resetState(button.dataset.gender);
}

function restartGame() {
  resetState(state.gender);
}

function showCharacterSelect() {
  clearTimers();
  state.paused = true;
  state.started = false;
  state.ended = false;
  elements.resultScreen.classList.add("is-hidden");
  elements.ambulanceScene.classList.remove("is-active");
  elements.startScreen.classList.remove("is-hidden");
  render();
}

function handleKeyboard(event) {
  if (event.key === " ") {
    event.preventDefault();
    togglePause();
    return;
  }
  const index = Number(event.key) - 1;
  if (index >= 0 && index < drinks.length) {
    serveDrink(drinks[index].id);
  }
}

buildPips(elements.vitaminPips);
buildPips(elements.relaxPips);
buildDrinks();
render();

document.querySelector(".character-options").addEventListener("click", chooseCharacter);
document.querySelector("#pauseButton").addEventListener("click", togglePause);
document.querySelector("#characterSelectButton").addEventListener("click", showCharacterSelect);
document.querySelector("#restartButton").addEventListener("click", restartGame);
document.querySelector("#resultRestart").addEventListener("click", restartGame);
document.addEventListener("keydown", handleKeyboard);
