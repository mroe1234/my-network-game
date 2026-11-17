// Entry point: load → validate → play (FR-023). Wires state, evaluator, feedback and views.
import { validateContent } from './engine/content.js';
import { componentsFor, configFor } from './engine/rules.js';
import {
  createSession, startRound, setPending, submit, next, currentLevel, currentRound, roundProgress,
  viewHint, viewSolution, requestRestart, cancelRestart, confirmRestart, levelSummary, sessionSummary,
} from './engine/state.js';
import { buildFeedback } from './engine/feedback.js';
import {
  renderLoading, renderContentError, renderBriefing, renderNotice, renderRound, renderFeedback,
  renderLevelSummary, renderSessionSummary, renderHelp, summaryRowsFrom, focusHeading,
} from './ui/render.js';
import { renderControls, focusNext } from './ui/controls.js';
import { startFlow, stopFlow } from './ui/flow.js';

let state = null;
let content = null;

async function load() {
  stopFlow();
  renderFeedback(null);
  renderLoading();
  let doc;
  try {
    const response = await fetch(new URL('./data/levels.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    doc = await response.json();
  } catch (error) {
    renderContentError([{ levelId: null, roundId: null, path: 'data/levels.json', message: `could not be loaded (${error.message})` }], load);
    return;
  }
  content = validateContent(doc);
  if (!content.ok) {
    renderContentError(content.errors, load);
    return;
  }
  if (content.levels.length === 0) {
    renderNotice('No levels yet', 'The content file is valid but has no levels authored.');
    return;
  }
  state = createSession(content);
  setupRestart();
  show();
}

/** Restart needs confirmation; cancelling changes nothing (FR-022). */
function setupRestart() {
  const button = document.getElementById('restart');
  button.hidden = false;
  button.onclick = () => {
    state = requestRestart(state);
    const ok = window.confirm('Restart the session? All progress, attempts and assistance will be cleared.');
    state = ok ? confirmRestart(state) : cancelRestart(state);
    if (ok) { renderFeedback(null); show(); }
  };
}

/** Switch configuration currently on screen: start + committed changes. */
function currentConfig() {
  const cfg = configFor(currentRound(state), state.committedDesign);
  return Object.fromEntries(Object.entries(cfg).map(([id, c]) => [id, { classId: c.classId, activeUplinks: c.activeUplinks }]));
}

function showRound() {
  const round = currentRound(state);
  const progress = roundProgress(state);
  const view = renderRound({
    level: currentLevel(state), round, roundIndex: state.roundIndex, catalog: state.catalog,
    committed: state.committedDesign, pending: state.pendingDesign, progress,
  });
  renderControls({
    round, catalog: state.catalog, current: currentConfig(), pending: state.pendingDesign, completed: progress.completed, progress,
    handlers: {
      onHint() {
        state = viewHint(state);
        showRound();
        document.getElementById('hint')?.focus();
      },
      onSolution() {
        state = viewSolution(state);
        showRound();
        document.getElementById('solution')?.focus();
      },
      onChange(switchId, change, controlId) {
        state = setPending(state, switchId, change);
        showRound();
        document.getElementById(controlId ?? `uplinks-${switchId}`)?.focus();
      },
      onSubmit() {
        const out = submit(state);
        if (!out.result) return; // solved round: repeated Submit is a no-op (FR-017)
        state = out.state;
        showRound();
        renderFeedback(buildFeedback(out.result, { round, catalog: state.catalog, messages: content.messages, source: null }));
        if (out.result.status === 'correct') focusNext();
      },
      onNext() {
        state = next(state);
        renderFeedback(null);
        show();
      },
    },
  });
  renderHelp({ round, catalog: state.catalog, progress });
  startFlow({
    svg: view.svg, layout: view.layout, components: view.components, round,
    staticTarget: document.getElementById('flow-static'), before: componentsFor(state.catalog, round, {}),
  });
}

function show() {
  stopFlow();
  if (state.view === 'briefing') {
    renderBriefing(currentLevel(state), state.catalog.sources, () => {
      state = startRound(state);
      show();
      focusHeading('round-heading');
    });
  } else if (state.view === 'round') {
    showRound();
    focusHeading('round-heading');
  } else if (state.view === 'level-summary') {
    const isLast = state.levelIndex === state.levels.length - 1;
    renderLevelSummary(currentLevel(state), summaryRowsFrom(levelSummary(state)), () => { state = next(state); show(); }, isLast);
  } else if (state.view === 'session-summary') {
    renderSessionSummary(sessionSummary(state), () => document.getElementById('restart').click());
  }
}

load();
