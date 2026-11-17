// Entry point: load → validate → briefing → fixed-step survival loop (feature 002).
import { validateScenario } from './engine/content.js';
import { createGame, start, pause, resume, step, buy, splitSwitch, evaluateNetwork, useHint } from './engine/sim.js';
import { componentFails } from './engine/rules.js';
import { statusLines, fixedLines, gameOverText } from './engine/feedback.js';
import {
  renderLoading, renderContentError, renderBriefing, renderRound, renderHud, resetHudCache,
  renderStatus, renderConceptNotice, renderHint, renderGameOver, showOnly, el,
} from './ui/render.js';
import { renderActionCard, renderSwitchList, recentAsAdded } from './ui/controls.js';
import { startFlow, stopFlow } from './ui/flow.js';

const STEP_MS = 250;
const MAX_STEPS_PER_FRAME = 8; // a stalled tab never fast-forwards (research S1)

let scenario = null;
let game = null;
let selected = null;          // diagram selection (UI only)
let pendingClass = {};        // class picked in the card, per switch (UI only; nothing bought)
let renderedVersion = -1;
let renderedNet = -1;
let renderedStatus = null;
let failingBefore = new Set();
let recentFixes = [];
let hint = null;
let best = 0;
let frameId = null;
let lastTs = null;
let carry = 0;

async function load() {
  stopLoop();
  renderLoading();
  let doc;
  try {
    const response = await fetch(new URL('./data/scenario.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    doc = await response.json();
  } catch (error) {
    renderContentError([{ path: 'data/scenario.json', message: `could not be loaded (${error.message})` }], load);
    return;
  }
  const res = validateScenario(doc);
  if (!res.ok) { renderContentError(res.errors, load); return; }
  scenario = res.scenario;
  setupGlobalControls();
  newGame();
}

function newGame() {
  stopLoop();
  game = createGame(scenario);
  selected = null; pendingClass = {}; hint = null; recentFixes = []; failingBefore = new Set();
  renderedVersion = -1; renderedNet = -1; renderedStatus = null;
  resetHudCache();
  document.getElementById('feedback-body').replaceChildren();
  renderBriefing({ title: 'How to play', briefing: scenario.briefing, sourceIds: scenario.briefing.sourceIds }, scenario.sources, () => {
    start(game);
    showOnly('round');
    renderAll();
    document.getElementById('pause').focus();
    startLoop();
  });
}

// ---- loop ----------------------------------------------------------------------------------

function startLoop() {
  lastTs = null; carry = 0;
  frameId = requestAnimationFrame(frame);
}
function stopLoop() {
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  stopFlow();
}

function frame(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.max(0, Math.min(ts - lastTs, 1000));
  lastTs = ts;
  if (game.status === 'running') {
    carry += dt;
    let n = 0;
    while (carry >= STEP_MS && n < MAX_STEPS_PER_FRAME && game.status === 'running') { step(game); carry -= STEP_MS; n += 1; }
    if (n === MAX_STEPS_PER_FRAME) carry = 0;
  } else {
    carry = 0;
  }
  if (game.status === 'ended') { endGame(); return; }
  if (game.netVersion !== renderedNet || game.status !== renderedStatus) renderAll();
  else if (game.version !== renderedVersion) renderPanels();
  else hud();
  frameId = requestAnimationFrame(frame);
}

// ---- rendering -----------------------------------------------------------------------------

const catalog = () => ({ switchClasses: scenario.switchClasses, deviceTypes: game.deviceTypes });
const viewRound = () => ({ start: game.network, addedDevices: recentAsAdded(game), addedSwitches: [], allowedUpgrades: ['uplinks', 'replace'] });

function incomeNow(comps) {
  const failing = comps.filter(componentFails);
  if (failing.some((c) => c.tier === 'aggregation')) return 0;
  const delivered = game.network.accessSwitches
    .filter((s) => !failing.some((c) => c.switchId === s.id))
    .reduce((n, s) => n + comps.find((c) => c.switchId === s.id).downMbps, 0);
  return Math.floor(delivered / scenario.economy.mbpsPerCredit);
}

let lastComps = [];
function hud() {
  renderHud({ game, income: incomeNow(lastComps), limit: scenario.rules.spillLimitSeconds, failing: lastComps.filter(componentFails).length });
}

/** Panels whose content depends on credits (prices, affordability), without redrawing the diagram. */
function renderPanels() {
  const comps = lastComps.length ? lastComps : evaluateNetwork(game);
  const active = document.activeElement?.id;
  renderActionCard({ game, components: comps, selected, handlers });
  renderSwitchList({ game, components: comps, handlers });
  renderHint(hint);
  if (active && document.getElementById(active) && document.activeElement !== document.getElementById(active)) document.getElementById(active).focus();
  renderedVersion = game.version;
  hud();
}

function renderAll() {
  const comps = evaluateNetwork(game);
  lastComps = comps;
  const failingNow = new Set(comps.filter(componentFails).map((c) => c.switchId));
  const fixedNow = fixedLines(game, comps, failingBefore);
  if (fixedNow.length) recentFixes = fixedNow;
  else if (failingNow.size) recentFixes = recentFixes.filter((f) => !failingNow.has(f.switchId));
  failingBefore = failingNow;

  const round = viewRound();
  const view = renderRound({ round, catalog: catalog(), committed: {}, pending: {}, selected, onSelect: select });
  document.getElementById('round-intro').textContent = game.lastEvent ? `${clock(game.lastEvent.t)} · ${game.lastEvent.title}` : 'The network is running. Growth is on its way.';
  renderStatus(statusLines(game, comps), recentFixes);
  renderActionCard({ game, components: comps, selected, handlers });
  renderSwitchList({ game, components: comps, handlers });
  renderHint(hint);
  renderConceptNotice(game.status === 'paused' ? game.notice : null, scenario.sources, () => { resume(game); renderAll(); document.getElementById('pause').focus(); });
  const actions = document.getElementById('actions');
  if (!actions.querySelector('#hint')) {
    actions.replaceChildren(el('button', { type: 'button', id: 'hint', class: 'secondary', onclick: onHint }, 'Hint'));
  }
  startFlow({ svg: view.svg, layout: view.layout, components: view.components, round, catalog: catalog(),
    staticTarget: document.getElementById('flow-static'), legendTarget: document.getElementById('flow-legend'), before: null });
  const noticeJustAppeared = game.status === 'paused' && game.notice && renderedStatus !== 'paused';
  renderedVersion = game.version;
  renderedNet = game.netVersion;
  renderedStatus = game.status;
  hud();
  if (noticeJustAppeared) {
    // Move keyboard and screen-reader users to the notice that paused play (C4).
    const title = document.getElementById('notice-title');
    title?.focus();
    document.getElementById('notice')?.scrollIntoView({ block: 'center' });
  }
}

const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function endGame() {
  stopLoop();
  best = Math.max(best, game.result.score);
  renderGameOver({ game, causeText: gameOverText(game), best, onRestart: () => newGame() });
}

// ---- actions -------------------------------------------------------------------------------

function select(id) {
  selected = id;
  renderAll();
  const focusId = id ? (['card-plus', 'card-replace', 'card-minus'].find((x) => document.getElementById(x) && !document.getElementById(x).disabled) ?? 'card-title') : 'topology';
  document.getElementById(focusId)?.focus();
}

const handlers = {
  onSelect: select,
  onBuy(switchId, change, buttonId) {
    const r = buy(game, switchId, change);
    if (r.ok) delete pendingClass[switchId];
    renderAll();
    const target = document.getElementById(buttonId);
    (target && !target.disabled ? target : document.getElementById('card-title') ?? document.getElementById('pause'))?.focus();
  },
  onSplit(switchId) {
    const r = splitSwitch(game, switchId);
    renderAll();
    if (r.ok) document.getElementById('card-title')?.focus();
  },
  onPickClass(switchId, classId) {
    pendingClass[switchId] = classId; // browsing only: nothing is bought
    renderAll();
    document.getElementById('card-class')?.focus();
  },
  get pendingClass() { return pendingClass; },
};

function onHint() {
  if (!game || game.status === 'ended') return;
  hint = useHint(game);
  renderAll();
  document.getElementById('hint')?.focus();
}

function togglePause() {
  if (!game || game.status === 'briefing' || game.status === 'ended') return;
  if (game.status === 'running') pause(game); else resume(game);
  renderAll();
}

let globalsReady = false;
function setupGlobalControls() {
  if (globalsReady) return;
  globalsReady = true;
  document.getElementById('pause').addEventListener('click', togglePause);
  document.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey && tag !== 'INPUT' && tag !== 'TEXTAREA') {
      e.preventDefault();
      togglePause();
    }
  });
  // Auto-pause when the tab is hidden (FR-121).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game?.status === 'running') { pause(game); renderAll(); }
  });
  const restart = document.getElementById('restart');
  restart.hidden = false;
  restart.onclick = () => {
    const wasRunning = game?.status === 'running';
    if (wasRunning) pause(game);
    if (window.confirm('Restart the game? Your current run will end and the network starts over.')) newGame();
    else if (wasRunning) { resume(game); renderAll(); }
  };
}

load();
