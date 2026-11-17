// Round controls (T019): native selects per changeable switch, Submit, Next.
// Options beyond a class's maximum uplinks are never offered.
import { el } from './render.js';

const $ = (id) => document.getElementById(id);

/**
 * renderControls({ round, catalog, current, pending, completed, handlers })
 * current: switchId → { classId, activeUplinks } as committed on screen.
 * handlers: { onChange(switchId, change), onSubmit(), onNext() }
 */
export function renderControls({ round, catalog, current, pending, completed, progress, handlers }) {
  const form = $('controls');
  const allowed = round.allowedUpgrades;
  const switches = [
    { id: round.start.aggregation.id, label: 'Aggregation switch', tier: 'aggregation' },
    ...round.start.accessSwitches.map((s) => ({ id: s.id, label: s.label, tier: 'access' })),
  ];

  const fields = switches.map((sw) => {
    const value = pending[sw.id] ?? current[sw.id];
    const cls = catalog.switchClasses.find((c) => c.id === value.classId);
    const uplinkId = `uplinks-${sw.id}`;
    const parts = [];
    // "Replace switch" only when the round allows it (Round.allowedUpgrades, data-model.md); only classes
    // whose roles allow this tier (SwitchClass.roles); aggregation therefore only offers the 25G class.
    if (allowed.includes('replace')) {
      const classId = `class-${sw.id}`;
      const choices = catalog.switchClasses.filter((c) => c.roles.includes(sw.tier));
      const clsSelect = el('select', { id: classId, name: classId });
      for (const c of choices) {
        const opt = el('option', { value: c.id }, `${c.label}, ports up to ${c.maxPortMbps.toLocaleString('en-US')} Mbps`);
        if (c.id === value.classId) opt.selected = true;
        clsSelect.append(opt);
      }
      if (completed || choices.length < 2) clsSelect.disabled = true;
      clsSelect.addEventListener('change', () => {
        const nextCls = catalog.switchClasses.find((c) => c.id === clsSelect.value);
        // Changing class resets the uplink bounds to the new class maximum.
        handlers.onChange(sw.id, { classId: nextCls.id, activeUplinks: Math.min(value.activeUplinks, nextCls.maxUplinks) }, classId);
      });
      parts.push(el('label', { for: classId }, `${sw.label}: switch class`), clsSelect);
    }
    parts.push(el('label', { for: uplinkId }, `${sw.label}: active uplinks (${cls.label})`));
    const select = el('select', { id: uplinkId, name: uplinkId });
    for (let n = 1; n <= cls.maxUplinks; n += 1) {
      const opt = el('option', { value: String(n) }, `${n} × ${cls.uplinkMbps.toLocaleString('en-US')} Mbps`);
      if (n === value.activeUplinks) opt.selected = true;
      select.append(opt);
    }
    if (!allowed.includes('uplinks') || completed) select.disabled = true;
    select.addEventListener('change', () => handlers.onChange(sw.id, { classId: value.classId, activeUplinks: Number(select.value) }, uplinkId));
    parts.push(select);
    parts.push(el('p', { class: 'note' }, `This class supports at most ${cls.maxUplinks} uplinks. More bandwidth than that needs a different switch class.`));
    return el('div', { class: 'control' }, parts);
  });

  form.replaceChildren(el('fieldset', {}, el('legend', {}, 'Your design'), fields));
  form.onsubmit = (e) => { e.preventDefault(); if (!completed) handlers.onSubmit(); };

  const submit = el('button', { type: 'button', id: 'submit' }, 'Submit design');
  submit.disabled = completed;
  submit.addEventListener('click', () => handlers.onSubmit());
  const next = el('button', { type: 'button', id: 'next', class: 'secondary' }, 'Next');
  next.disabled = !completed;
  next.addEventListener('click', () => handlers.onNext());
  const hintsLeft = Math.min(2, round.hints.length) - (progress?.hintsViewed ?? 0);
  const hint = el('button', { type: 'button', id: 'hint', class: 'secondary' },
    hintsLeft > 0 ? `Hint (${(progress?.hintsViewed ?? 0) + 1} of 2)` : 'No more hints');
  hint.disabled = completed || hintsLeft <= 0;
  hint.addEventListener('click', () => handlers.onHint());
  const solution = el('button', { type: 'button', id: 'solution', class: 'secondary' }, 'Show worked solution');
  solution.disabled = completed || progress?.solutionViewed;
  solution.addEventListener('click', () => handlers.onSolution());
  $('actions').replaceChildren(submit, next, hint, solution);
}

export function focusNext() {
  const n = $('next');
  if (n && !n.disabled) n.focus();
}
