// Generated from source, speed profiles, styles and locale dictionaries.
window.__ModuleLoader__.load({id:"@charleypeng/dsh-model-tier-slider",factory(require){
// All route keys are opaque; provider/model IDs may contain slashes.
function project(snapshot) {
  const current = snapshot.current;
  const rows = snapshot.groups.flatMap(group => group.models.map(model => ({
    id: JSON.stringify([group.id, model.id]), label: model.name, group: group.name,
    provider: group.id, model: model.id, reasoning: model.reasoning,
  })));
  const row = rows.find(row => row.provider === current?.provider && row.model === current?.model);
  const defaultId = row?.reasoning?.defaultEffort;
  const tiers = (row?.reasoning?.efforts ?? []).map(({id,name,description}) => ({
    id, label: name, description, available: true, isDefault: id === defaultId,
  }));
  return { rows, row, models: rows.map(({ id, label, group, provider }) => ({id,label,group,providerId:provider})),
    modelId: row?.id, modelLabel: row?.label, tiers, defaultId,
    activeId: row ? (current.reasoningEffort ?? defaultId) : undefined };
}

// Revalidate against the latest catalog when the pointer/key is released.
function selectionFor(snapshot, action, id, displayedModel) {
  if (snapshot.pending || snapshot.status === 'loading' || snapshot.status === 'selecting') return;
  const { rows, row, tiers, defaultId } = project(snapshot);
  const target = action === 'model' ? rows.find(x => x.id === id) : row;
  if (!target || (action !== 'model' && target.id !== displayedModel)) return;
  let effort;
  if (action === 'effort') {
    if (!tiers.some(x => x.id === id)) return;
    effort = id;
  } else if (action === 'reset') {
    if (!target.reasoning) return;
    effort = defaultId;
  } else if (action === 'model') {
    if (row?.id === target.id) return;
    effort = target.reasoning?.defaultEffort;
  } else return;
  return {provider: target.provider, model: target.model,
    ...(effort === undefined ? {} : {reasoningEffort: effort})};
}

// These are shortcuts to native selections, never to arbitrary request parameters.
const speedRanks = ['off', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const speedRank = id => speedRanks.indexOf(String(id ?? '').toLowerCase());
const ownSpeedEntry = (entries, id) => entries && Object.hasOwn(entries, id) ? entries[id] : undefined;

function resolveSpeedActions(projected, config, hasPriority) {
  const {row, rows, tiers, activeId} = projected;
  if (!row) return [];
  const provider = ownSpeedEntry(config?.providers, row.provider);
  const profile = ownSpeedEntry(provider?.models, row.model);
  const lighterEffort = profile?.lighterEffort ?? provider?.lighterEffort ?? config?.showLighterEffort ?? false;
  let target;
  if (typeof lighterEffort === 'string') {
    target = tiers.find(tier => tier.id === lighterEffort && tier.available !== false);
  } else if (lighterEffort && !hasPriority && tiers.length > 1) {
    const currentRank = speedRank(activeId);
    // Prefer a lightweight thinking tier over disabling it. Unknown tiers are not ranked.
    const lighter = ['low', 'minimal', 'off', 'none'];
    target = lighter.map(id => tiers.find(tier => tier.id.toLowerCase() === id && tier.available !== false))
      .find(tier => tier && (activeId === undefined || (currentRank !== -1 && speedRank(tier.id) < currentRank)));
  }
  const actions = [];
  const activeRank = speedRank(activeId), targetRank = speedRank(target?.id);
  if (target && target.id !== activeId && (activeRank < 0 || targetRank < 0 || targetRank < activeRank)) {
    actions.push({id: JSON.stringify([row.id,'effort',target.id]), kind:'effort', value:target.id, name:target.label});
  }
  const alternateModel = profile?.alternateModel;
  if (typeof alternateModel === 'string' && alternateModel !== row.model) {
    const alt = rows.find(other => other.provider === row.provider && other.model === alternateModel);
    if (alt) actions.push({id:JSON.stringify([row.id,'model',alt.id]), kind:'model', value:alt.id, name:alt.label});
  }
  return actions;
}

function validateSpeedConfig(input) {
  function object(value, path) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object`);
    return Object.entries(value);
  }
  function fields(value, allowed, path) {
    for (const [key] of object(value, path)) if (!allowed.includes(key)) throw new Error(`${path}.${key} is not supported`);
  }
  function identifier(value, path) {
    if (typeof value !== 'string' || !value.trim() || value.length > 512) throw new Error(`${path} must be a non-empty ID`);
  }
  function effort(value, path) {
    if (typeof value !== 'boolean') identifier(value, path);
  }
  fields(input, ['showLighterEffort','providers'], 'speed profiles');
  if (input.showLighterEffort !== undefined && typeof input.showLighterEffort !== 'boolean') throw new Error('showLighterEffort must be a boolean');
  for (const [provider, route] of object(input.providers === undefined ? {} : input.providers, 'providers')) {
    identifier(provider,'provider ID');
    const path = `providers.${provider}`;
    fields(route,['lighterEffort','models'],path);
    if (route.lighterEffort !== undefined) effort(route.lighterEffort,`${path}.lighterEffort`);
    for (const [id, profile] of object(route.models === undefined ? {} : route.models,`${path}.models`)) {
      identifier(id, 'model ID');
      const key = `${path}.models.${id}`;
      fields(profile,['lighterEffort','alternateModel'],key);
      if (profile.lighterEffort !== undefined) effort(profile.lighterEffort,`${key}.lighterEffort`);
      if (profile.alternateModel !== undefined) identifier(profile.alternateModel,`${key}.alternateModel`);
    }
  }
  return input;
}

// The visual position is continuous; only the committed index is discrete.
function pointerFraction(clientX, left, width, grabOffset = 0) {
  const travel = width - 28;
  return travel <= 0 ? 0 : Math.min(1, Math.max(0, (clientX - left - 14 - grabOffset) / travel));
}
function tierAt(fraction, count) { return Math.round(fraction * Math.max(0, count - 1)); }
function thumbPosition(fraction) { return `calc(${fraction * 100}% + ${14 - 28 * fraction}px)`; }

function createView(React, createPortal) {
 const h = React.createElement, { useState, useRef, useLayoutEffect, useEffect, useMemo, useId } = React;
 const reset = 'M3 4v5h5 M3.6 9a9 9 0 1 1 .2 7';
 const icon = path => h('svg', {
   width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none',
   stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
 }, h('path', { d: path }));
 const lightning = (size, props) => h('svg', { width: size, height: size, viewBox: '0 0 24 24',
   'aria-hidden': true, ...props }, h('path', { d: 'M13.5 2.5 4 13h7l-1 8.5L20 11h-7l.5-8.5Z' }));
 function FastToggle({ fastMode, ultra, blocked, dismissTip, text }) {
   const { enabled, label, detail, pending, onToggle } = fastMode;
   const tipId = useId(), bolt = useRef(null), tip = useRef(null), touchPointer = useRef(false);
   const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false);
   const [dismissed, setDismissed] = useState(false), [touchTip, setTouchTip] = useState(false);
   const visible = !dismissed && (hovered || focused || touchTip);
   const unavailable = blocked || pending;
   useLayoutEffect(() => {
     if (!hovered && !focused && !touchTip) setDismissed(false);
   }, [hovered, focused, touchTip]);
   useLayoutEffect(() => {
     if (!visible) return;
     const b = bolt.current, p = tip.current;
     // Keep the tooltip outside the panel's scroll clipping without leaving its DOM subtree.
     p.showPopover?.();
     const pos = () => {
       const r = b.getBoundingClientRect(), w = p.offsetWidth, height = p.offsetHeight;
       const above = r.top >= height + 6 || innerHeight - r.bottom < height + 6;
       p.dataset.side = above ? 'above' : 'below';
       p.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left + (r.width - w) / 2)) + 'px';
       p.style.top = Math.max(6, Math.min(innerHeight - height - 6, above ? r.top - height : r.bottom)) + 'px';
     };
     pos();
     p.style.visibility = 'visible';
     const ro = new ResizeObserver(pos);
     ro.observe(p); ro.observe(b.closest('.mtr-panel'));
     window.addEventListener('resize', pos);
     window.addEventListener('scroll', pos, true);
     const outside = e => { if (!b.parentElement?.contains(e.target)) setTouchTip(false); };
     document.addEventListener('pointerdown', outside, true);
     dismissTip.current = () => { setTouchTip(false); setDismissed(true); return true; };
     return () => {
       dismissTip.current = null;
       document.removeEventListener('pointerdown', outside, true);
       ro.disconnect();
       window.removeEventListener('resize', pos);
       window.removeEventListener('scroll', pos, true);
       p.style.visibility = 'hidden';
       if (p.hidePopover && p.matches(':popover-open')) p.hidePopover();
     };
   }, [visible, dismissTip]);
   return h('div', { className: 'mtr-fast-wrap',
     onPointerEnter: e => { if (e.pointerType !== 'touch') setHovered(true); },
     onPointerLeave: () => setHovered(false),
   },
     h('button', { type: 'button', className: 'mtr-icon mtr-fast' + (ultra ? ' mtr-fast-ultra' : ''), ref: bolt,
       'aria-label': text('fast', 'Fast mode'), 'aria-pressed': !!enabled, 'aria-describedby': tipId,
       'aria-disabled': !!unavailable, 'aria-busy': pending || undefined,
       onFocus: e => setFocused(e.currentTarget.matches(':focus-visible')), onBlur: () => setFocused(false),
       onPointerDown: e => { touchPointer.current = e.pointerType === 'touch'; },
       onPointerCancel: () => { touchPointer.current = false; },
       onClick: e => {
         const touch = e.detail > 0 && (touchPointer.current || e.nativeEvent?.pointerType === 'touch');
         touchPointer.current = false;
         // Preview the tradeoff before changing modes on a device without hover.
         if (touch && !touchTip) { setDismissed(false); setTouchTip(true); return; }
         if (!unavailable) onToggle(!enabled);
       },
     }, lightning(15)),
     h('div', { id: tipId, role: 'tooltip', className: 'mtr-fast-tip', popover: 'manual', hidden: !visible, ref: tip },
       h('div', { className: 'mtr-fast-tip-body' },
         h('span', null, label || text('fastSpeed', 'Faster responses')),
         h('small', null, detail || text('fastUsage', 'More usage')))),
   );
 }
 // Keep per-pixel updates local to the rail, not the surrounding model menu.
 function EffortRail({ options, idx, tierLabel, label, purple, shining, fastActive, blocked, slider, dragging, preview, commit }) {
   const gesture = useRef(null);
   const [point, setPoint] = useState(null);
   const max = Math.max(0, options.length - 1);
   const fraction = point ?? (max ? idx / max : 0);
   const cancel = () => {
     if (!gesture.current) return;
     gesture.current = null; dragging.current = false; setPoint(null); preview(null);
   };
   useLayoutEffect(() => { if (blocked) cancel(); }, [blocked]);
   useLayoutEffect(() => () => { dragging.current = false; }, [dragging]);
   const sample = (e, g) => max ? pointerFraction(e.clientX, g.left, g.width, g.offset) : 0;
   const down = e => {
     if (blocked || !options.length || gesture.current || !e.isPrimary || e.button !== 0) return;
     e.preventDefault();
     slider.current?.focus({ preventScroll: true });
     const { left, width } = e.currentTarget.getBoundingClientRect();
     // A second grab may interrupt an in-progress snap. Use the painted position.
     const thumb = e.currentTarget.querySelector('.mtr-thumb').getBoundingClientRect();
     const center = thumb.left + thumb.width / 2;
     const delta = e.clientX - center;
     const g = { id: e.pointerId, left, width, offset: Math.abs(delta) <= 14 ? delta : 0 };
     gesture.current = g; dragging.current = true;
     e.currentTarget.setPointerCapture(e.pointerId);
     const f = sample(e, g); setPoint(f); preview(tierAt(f, options.length));
   };
   const move = e => {
     const g = gesture.current;
     if (!g || g.id !== e.pointerId) return;
     const f = sample(e, g); setPoint(f);
     const i = tierAt(f, options.length); if (i !== idx) preview(i);
   };
   const up = e => {
     const g = gesture.current;
     if (!g || g.id !== e.pointerId) return;
     const i = tierAt(sample(e, g), options.length);
     gesture.current = null; dragging.current = false;
     setPoint(null); preview(i); commit(i);
   };
   const interrupted = e => { if (gesture.current?.id === e.pointerId) cancel(); };
   return h('div', { className: 'mtr-track' + (purple ? ' ultra' : '') + (fastActive ? ' mtr-fast-active' : '') + (point !== null ? ' mtr-dragging' : ''),
     style: { '--mtr-position': thumbPosition(fraction) }, onPointerDown: down, onPointerMove: move,
     onPointerUp: up, onPointerCancel: interrupted, onLostPointerCapture: interrupted },
     h('i', { className: 'mtr-fill', style: { opacity: fraction > 0 ? 1 : 0 } }, shining && h('i', { className: 'mtr-stars' })),
     h('span', { className: 'mtr-ticks', 'aria-hidden': true }, options.map((t, i) => h('i', { key: t.id,
       style: i < idx ? { opacity: 0.6, background: '#fff' } : { opacity: 0.5 } }))),
     h('i', { className: 'mtr-thumb' }),
     h('input', { type: 'range', min: 0, max, step: 1, value: idx,
       disabled: blocked || !options.length, 'aria-label': label, 'aria-valuetext': tierLabel, ref: slider,
       onKeyDown: e => {
         if (blocked || gesture.current || !['Home', 'End', 'Enter', ' '].includes(e.key)) return;
         e.preventDefault();
         const i = e.key === 'Home' ? 0 : e.key === 'End' ? max : idx;
         preview(i); commit(i);
       },
       onChange: e => { if (!gesture.current && !blocked) { const i = Number(e.target.value); preview(i); commit(i); } } }),
   );
 }
 return function TierView({
   tiers = [], activeId, modelLabel, modelId, models = [], busy, disabled,
   onSelect, onModel, onReset, onFastOpen, fastMode, quickActions = [], onQuickAction, error, t,
 }) {
   const text = (key, fallback) => t?.(key) || fallback;
   const [page, setPage] = useState(''), [preview, setPreview] = useState(null);
   const [pendingModel, setPendingModel] = useState(null);
   const actionDescriptionId = useId();
   const hasQuickActions = quickActions.length > 0;
   const anchor = useRef(null), panel = useRef(null), slider = useRef(null), dismissTip = useRef(null);
   const drag = useRef(false), keyboard = useRef(false);
   const options = tiers.filter(x => x.available !== false);
   const selected = options.findIndex(x => x.id === activeId);
   const idx = preview ?? Math.max(0, selected);
   const current = preview !== null || selected >= 0 ? options[idx] : null;
   const explicit = preview !== null || selected >= 0;
   const tierLabel = current?.label || text('defaultTier', 'Default');
   const model = modelLabel || models.find(x => x.id === modelId)?.label || text('selectModel', 'Select model');
   const blocked = busy || disabled;
   const groups = useMemo(() => {
     const map = new Map();
     for (const m of models) {
       const key = m.providerId ?? m.group ?? '';
       if (!map.has(key)) map.set(key, { key, name: m.group || key, items: [] });
       map.get(key).items.push(m);
     }
     return [...map.values()];
   }, [models]);

   const close = (focus = false) => {
     drag.current = false; setPreview(null); setPendingModel(null); setPage('');
     if (focus) anchor.current?.focus();
   };

   // Position before the popover becomes visible so opening never paints at the default place, then follow the trigger.
   const open = !!page;
   useLayoutEffect(() => {
     if (!open) return;
     const a = anchor.current, p = panel.current;
     if (!a || !p) return;
     const pos = () => {
       const r = a.getBoundingClientRect(), w = p.offsetWidth, ph = p.offsetHeight;
       p.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.right - w)) + 'px';
       p.style.top = Math.max(6, innerHeight - r.bottom >= ph + 6 ? r.bottom + 6 : r.top - ph - 6) + 'px';
     };
     pos();
     p.showPopover?.();
     p.style.visibility = 'visible';
     const ro = new ResizeObserver(pos);
     ro.observe(p); ro.observe(a);
     window.addEventListener('resize', pos);
     window.addEventListener('scroll', pos, true);
     const outside = e => { if (!a.contains(e.target) && !p.contains(e.target)) close(); };
     const key = e => {
       if (e.key !== 'Escape') return;
       e.preventDefault(); e.stopPropagation();
       if (!dismissTip.current?.()) close(true);
     };
     document.addEventListener('pointerdown', outside, true);
     document.addEventListener('focusin', outside, true);
     document.addEventListener('keydown', key, true);
     return () => {
       ro.disconnect();
       window.removeEventListener('resize', pos);
       window.removeEventListener('scroll', pos, true);
       document.removeEventListener('pointerdown', outside, true);
       document.removeEventListener('focusin', outside, true);
       document.removeEventListener('keydown', key, true);
       if (p.hidePopover && p.matches(':popover-open')) p.hidePopover();
     };
   }, [open]);
   // Move focus on keyboard entry, but not onto a quick action that could receive a held activation key.
   useLayoutEffect(() => {
     if (!page || !keyboard.current) return;
     const p = panel.current;
     if (!p) return;
     const target = page === 'model'
       ? (p.querySelector('[aria-checked="true"]:enabled') || p.querySelector('.mtr-option:enabled'))
       : (p.querySelector('.mtr-fast[aria-disabled="false"]') || slider.current || p.querySelector('.mtr-fast') || p);
     target?.focus({ preventScroll: true });
   }, [page, open]);
   useEffect(() => { if (page === 'effort') onFastOpen?.(); }, [page, onFastOpen]);

   // A settled switch returns to the effort pane; a rejection keeps the list so the choice can be retried.
   useEffect(() => {
     if (!pendingModel || busy) return;
     if (modelId === pendingModel) { setPage('effort'); setPendingModel(null); }
     else if (error) setPendingModel(null);
   }, [pendingModel, modelId, busy, error]);
   // Keep the dropped thumb where the user left it until the session actually reports that tier.
   useEffect(() => {
     if (preview === null || drag.current) return;
     if (busy) return;
     const wanted = options[preview];
     if (error || !wanted || wanted.id === activeId) { setPreview(null); }
   }, [preview, busy, activeId, error, options]);

   const commit = i => {
     if (!blocked && options[i] && options[i].id !== activeId) onSelect(options[i].id);
   };
   const button = (label, action, child, cls, extra = {}) => h('button', {
     type: 'button', className: cls, title: label, 'aria-label': label, onClick: action, ...extra,
   }, child);
   const ultra = /ultra/i.test(current?.id || '');
   const peak = ultra || (!!current && options.length > 1 && idx === options.length - 1);
   // The effort determines the rail color; Fast only changes particle motion.
   const fastActive = !!fastMode?.enabled;
   const purple = peak || current?.id?.toLowerCase() === 'max';
   const shining = fastActive || peak;
   const subtitle = ultra ? text('higherUsage', 'Consumes usage limits faster') : model;
   const trigger = button(
     `${model} ${tierLabel}${fastActive ? ` · ${text('fast', 'Fast mode')}` : ''}`,
     e => {
       keyboard.current = e.detail === 0;
       if (page) close(true);
       else setPage(options.length || fastMode || hasQuickActions ? 'effort' : 'model');
     },
     h(React.Fragment, null,
       h('i', { className: 'mtr-mini', 'aria-hidden': true }, icon('M3 7h7m4 0h7M3 17h11m4 0h3M10 4v6m6 4v6')),
       h('strong', null, model),
       explicit && h('span', null, tierLabel),
       fastMode && lightning(11, { className: 'mtr-trigger-fast', fill: ultra ? '#8b5cf6' : 'var(--mtr-blue)',
         style: { flex: '0 0 11px', visibility: fastActive ? 'visible' : 'hidden' } })),
     'mtr-trigger',
     { 'aria-expanded': !!page, 'aria-haspopup': 'dialog', disabled: !!disabled, ref: anchor },
   );
   const track = h(EffortRail, {
     key: JSON.stringify([modelId, ...options.map(tier => tier.id)]),
     options, idx, tierLabel, label: text('selectEffort', 'Select effort'), purple, shining, fastActive, blocked,
     slider, dragging: drag, preview: setPreview, commit,
   });
   const header = h('div', { className: 'mtr-head' },
     fastMode ? h(FastToggle, { fastMode, ultra, blocked, dismissTip, text }) : h('span', { className: 'mtr-spacer', 'aria-hidden': true }),
     button(text('selectModel', 'Select model'), e => { keyboard.current = e.detail === 0; setPage('model'); },
       h(React.Fragment, null,
         h('b', { className: ultra ? 'mtr-ultra-label' : '' }, tierLabel),
         h('small', null, subtitle, ' ›')),
       'mtr-heading', { disabled: !models.length || !onModel }),
     onReset && button(text('reset', 'Reset to model default'), () => onReset(), icon(reset), 'mtr-icon'),
   );
   const modelList = h(React.Fragment, null,
     h('div', { className: 'mtr-caption' }, text('selectModel', 'Select model')),
     h('div', { className: 'mtr-list', role: 'radiogroup' }, groups.map(group => h('div', {
       className: 'mtr-group', key: group.key, role: 'group', 'aria-label': group.name,
     },
       h('div', { className: 'mtr-group-name' }, group.name),
       group.items.map(m => button(m.label, e => {
         if (blocked || m.available === false) return;
         keyboard.current = e.detail === 0;
         if (m.id === modelId) { setPage('effort'); return; }
         setPendingModel(m.id);
         onModel?.(m.id);
       }, h(React.Fragment, null,
         h('span', null, m.label),
         m.id === pendingModel ? '…' : m.id === modelId ? '✓' : '',
       ), 'mtr-option', { key: m.id, role: 'radio', 'aria-checked': m.id === modelId, disabled: blocked || m.available === false }),
     )))),
     !models.length && h('div', { className: 'mtr-caption' }, text('unsupported', 'Unavailable')),
   );
   const actions = hasQuickActions && h('div', { className: 'mtr-quick-actions', key: modelId },
     quickActions.map(({ id, label, description }, i) => {
       const descriptionId = description ? `${actionDescriptionId}-${i}` : undefined;
       return h('button', {
         key: id, type: 'button', className: 'mtr-quick-action', disabled: !!blocked || !onQuickAction,
         'aria-label': label, 'aria-describedby': descriptionId,
         onClick: e => {
            if (blocked || !onQuickAction) return;
            // The shortcut can disappear after selection; leave focus on a stable panel target.
            if (e.currentTarget === document.activeElement) panel.current?.focus({preventScroll:true});
            onQuickAction(id);
          },
       }, h('span', null, label), description && h('small', { id: descriptionId }, description));
     }),
   );
   const popover = h('div', {
     className: 'mtr-panel', popover: 'manual', role: 'dialog', ref: panel, tabIndex: -1,
     'aria-label': page === 'model' ? text('selectModel', 'Select model') : text('selectEffort', 'Select effort'),
   }, page === 'model' ? modelList : h(React.Fragment, null,
     header,
     options.length ? track : !hasQuickActions && h('div', { className: 'mtr-caption' }, text('unsupported', 'Unavailable')),
     actions,
   ), error && h('div', { className: 'mtr-error', role: 'alert' }, String(error)));
   return h('span', { className: 'mtr-root' }, trigger, page && createPortal(popover, document.body));
 };
}

// This file is inserted into the lazy loader factory by build.mjs. No private UI imports.
async function callCodexFast(endpoint, payload, signal, transport = fetch) {
  const response = await transport(`/codex-api/${endpoint}`, {
    method: 'POST', credentials: 'same-origin', signal,
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payload }),
  });
  if (!response.ok) throw new Error('Codex Fast request failed');
  const reply = await response.json();
  if (reply?.ok !== true) throw new Error(reply?.error?.message || 'Codex Fast request failed');
  const value = reply.value;
  if (value?.available !== true || value.tier !== 'priority' || typeof value.enabled !== 'boolean') return null;
  return { enabled: value.enabled, tier: value.tier,
    label: typeof value.label === 'string' ? value.label : undefined,
    detail: typeof value.detail === 'string' ? value.detail : undefined };
}

// Register a provider only when its backend reports and enforces the real service tier.
const priorityBackends = new Map([['openai-codex', callCodexFast]]);
function createFastHook(React) {
  const { useCallback, useEffect, useMemo, useRef, useState } = React;
  return function useFast(sessionId, row) {
    const backend = priorityBackends.get(row?.provider);
    const model = backend ? row.model : null;
    const target = useMemo(() => typeof sessionId === 'string' && model
      ? {sessionId, model} : null, [sessionId, model, backend]);
    const [view, setView] = useState(null);
    const active = useRef(null);
    const refresh = useCallback(() => {
      const current = active.current;
      if (!target || current?.target !== target || current.write) return;
      current.read?.abort();
      const read = new AbortController();
      current.read = read;
      backend('fastStatus', target, read.signal).then(value => {
        if (active.current === current && !read.signal.aborted) setView({target, value});
      }, () => {
        if (active.current === current && !read.signal.aborted) {
          // A transient status failure is not evidence that Fast was switched off.
          setView(previous => previous?.target === target && previous.value
            ? {...previous, error:true} : previous);
        }
      });
    }, [target, backend]);
    useEffect(() => {
      if (!target) return;
      const current = {target};
      active.current = current;
      refresh();
      window.addEventListener('focus', refresh);
      return () => {
        window.removeEventListener('focus', refresh);
        active.current = null;
        current.read?.abort();
      };
    }, [target, refresh]);
    const value = view?.target === target ? view?.value : null;
    const onToggle = async enabled => {
      const current = active.current;
      if (!target || current?.target !== target || current.write || !value || typeof enabled !== 'boolean') return;
      current.read?.abort();
      current.write = true;
      setView({target, value, pending:true});
      try {
        const next = await backend('setFast', {...target, enabled});
        if (active.current === current) setView({target, value:next, error:!next});
      } catch {
        if (active.current === current) setView({target, value, error:true});
      } finally { current.write = false; }
    };
    return { mode: value ? {...value, pending:!!view.pending, onToggle} : null,
      refresh, error: view?.target === target && view?.error };
  };
}
function makePlugin(React, createPortal, css, dictionaries, speedProfiles) {
  const h = React.createElement;
  const View = createView(React, createPortal);
  const ns = 'dsh-model-tier-slider';
  const useFast = createFastHook(React);
  function Seat({source,sessionId,locked,t}) {
    const read = React.useCallback(() => source.store.getSnapshot(), [source]);
    const subscribe = React.useCallback(fn => source.store.subscribe(fn), [source]);
    const snapshot = React.useSyncExternalStore(subscribe, read);
    const [error, setError] = React.useState(null);
    const inflight = React.useRef(false);
    const mounted = React.useRef(false);
    React.useEffect(() => {
      mounted.current = true;
      source.load().catch(e => { if (mounted.current) setError(String(e?.message || e)); });
      return () => { mounted.current = false; };
    }, [source]);
    const projected = project(snapshot);
    const fast = useFast(sessionId, projected.row);
    const quickActions = resolveSpeedActions(projected, speedProfiles, !!fast.mode);
    const submit = async (action, id) => {
      if (!mounted.current || locked || inflight.current) return false;
      const latest = read();
      if (action === 'speed') {
        const shortcut = resolveSpeedActions(project(latest), speedProfiles, !!fast.mode).find(item => item.id === id);
        if (!shortcut) { setError(t('quickUnavailable')); return false; }
        action = shortcut.kind;
        id = shortcut.value;
      }
      const selection = selectionFor(latest, action, id, projected.modelId);
      if (!selection) return false;
      inflight.current = true;
      setError(null);
      try {
        const result = await source.select(selection);
        if (!result?.ok) throw new Error(result?.error?.message || t('unavailable'));
        return true;
      } catch (e) {
        if (mounted.current) setError(String(e?.message || e));
        return false;
      } finally { inflight.current = false; }
    };
    return h(React.Fragment,null,h('style',null,css),h(View,{
      ...projected, modelLabel: projected.modelLabel || t('selectModel'),
      busy: Boolean(snapshot.pending) || snapshot.status === 'selecting',
      disabled: Boolean(locked) || snapshot.status === 'loading',
      fastMode: fast.mode, onFastOpen: fast.refresh,
      quickActions: quickActions.map(action => ({id:action.id,
        label:`${t(action.kind === 'effort' ? 'quickEffort' : 'quickModel')} ${action.name}`,
        description:t(action.kind === 'effort' ? 'quickEffortDetail' : 'quickModelDetail'),
      })),
      onQuickAction: id => submit('speed',id),
      error: (fast.error && t('fastError')) || error || snapshot.error || snapshot.failures.map(f => `${f.name}: ${f.message}`).join('; '),
      onSelect: id => submit('effort',id), onModel: id => submit('model',id),
      onReset: projected.row?.reasoning ? () => submit('reset') : undefined,
      onRetry: () => {setError(null); return source.load().catch(e => { if(mounted.current) setError(String(e?.message || e)); });},
      t: key => Object.hasOwn(dictionaries.en,key) ? t(key) : undefined,
    }));
  }
  function Entry(props) {return props.source ? h(Seat,props) : null;}
  return {inject:['slots','locale','sessions','modelDirectories'], apply(ctx){
    ctx.effect(() => ctx.locale.register(ns,dictionaries));
    ctx.slots.inject('conversation.input.model', () => ctx.slots.register({
      name:'conversation.input.model', priority:-100, locale:ns,
      inject: sessionId => ({source: ctx.sessions.subagentAddress(sessionId) === undefined ? ctx.modelDirectories.directoryFor(sessionId) : null}),
    }, Entry));
  }};
}

return makePlugin(require('react'),require('react-dom').createPortal,".mtr-root,.mtr-panel{font:13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dsw-alias-label-primary);--mtr-blue:var(--dsw-static-blue-500,#3b82f6);--mtr-muted:var(--dsw-alias-label-secondary);--mtr-surface:var(--dsw-alias-bg-layer-1);--mtr-hover:color-mix(in srgb,currentColor 6%,transparent)}\n.mtr-root{display:inline-flex;min-width:0;align-items:center}.mtr-root button,.mtr-panel button{font:inherit;letter-spacing:normal;text-transform:none;color:inherit;cursor:pointer;border:0;background:none;box-shadow:none;margin:0;min-height:0}.mtr-root button:focus-visible,.mtr-panel button:focus-visible,.mtr-track:has(input:focus-visible){outline:2px solid var(--mtr-blue);outline-offset:2px}\n.mtr-root .mtr-trigger{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:28px;max-width:min(220px,34vw);padding:0 9px;border-radius:18px;white-space:nowrap}.mtr-trigger strong,.mtr-trigger span,.mtr-heading small,.mtr-option span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mtr-trigger strong{font-weight:560}.mtr-trigger span,.mtr-heading small,.mtr-caption,.mtr-panel .mtr-group-name{color:var(--mtr-muted)}.mtr-trigger:hover,.mtr-trigger[aria-expanded=true],.mtr-panel button:enabled:hover{background:var(--mtr-hover)}\n.mtr-panel{position:fixed;inset:auto;margin:0;box-sizing:border-box;visibility:hidden;width:min(255px,calc(100vw - 12px));max-height:calc(100dvh - 12px);overflow:auto;padding:10px 12px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--mtr-surface);box-shadow:0 12px 30px -12px color-mix(in srgb,var(--dsw-alias-label-primary) 30%,transparent),0 2px 6px color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);z-index:1000}.mtr-head{display:grid;grid-template-columns:24px minmax(0,1fr) 24px;align-items:start;gap:2px}.mtr-panel .mtr-icon{width:24px;height:24px;padding:4px;display:grid;place-items:center;color:var(--mtr-muted);border-radius:8px}.mtr-panel button:disabled{cursor:default;opacity:.5}.mtr-panel .mtr-heading{display:grid;min-width:0;max-width:100%;justify-self:center;gap:2px;padding:3px 8px;border-radius:8px;text-align:center}.mtr-heading b{font-size:14px;font-weight:560}.mtr-heading b.mtr-ultra-label{color:#8b5cf6}.mtr-heading small{font-size:12px}\n.mtr-track{position:relative;height:24px;margin-top:11px;border-radius:99px;background:color-mix(in srgb,var(--mtr-blue) 12%,var(--mtr-surface))}.mtr-fill{position:absolute;left:0;top:0;bottom:0;min-width:0;overflow:hidden;border-radius:99px;background:var(--mtr-blue);pointer-events:none;z-index:1}.mtr-track.ultra .mtr-fill{background:linear-gradient(100deg,#2563eb,#4f46e5 38%,#a855f7 72%,#7c3aed);background-size:150% 100%;animation:mtr-flow 3s ease-in-out infinite alternate}.mtr-stars{position:absolute;inset:0;width:100%;height:100%;background:radial-gradient(circle at 9px 11px,#fff9 .9px,transparent 1.3px) 0 0/37px 18px,radial-gradient(circle at 22px 5px,#fff6 1px,transparent 1.5px) 0 0/53px 21px;animation:mtr-drift 5s linear infinite}.mtr-ticks{position:absolute;inset:0 14px;display:flex;align-items:center;justify-content:space-between;pointer-events:none;z-index:2}.mtr-ticks i{width:2px;height:2px;border-radius:50%;background:var(--dsw-alias-label-secondary)}.mtr-thumb{position:absolute;top:50%;transform:translate(-50%,-50%);width:28px;height:28px;box-sizing:border-box;border-radius:50%;background:var(--mtr-surface);border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);box-shadow:0 1px 3px color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent);pointer-events:none;z-index:3}.mtr-track input{position:absolute;left:0;top:-2px;width:100%;height:28px;appearance:none;background:none;opacity:0;cursor:pointer;margin:0;padding:0;touch-action:none;z-index:4}.mtr-track input::-webkit-slider-runnable-track{height:28px;background:none}.mtr-track input::-webkit-slider-thumb{appearance:none;width:28px;height:28px;margin:0}.mtr-track input::-moz-range-track{height:28px;background:none}.mtr-track input::-moz-range-thumb{width:28px;height:28px;border:0}\n/* Both edges use the same target and easing. Never ease toward a moving pointer. */\n.mtr-track{touch-action:none;user-select:none;cursor:pointer;--mtr-snap:145ms cubic-bezier(.22,.75,.25,1)}\n.mtr-track .mtr-fill{width:var(--mtr-position);transition:width var(--mtr-snap),opacity var(--mtr-snap)}\n.mtr-track .mtr-thumb{left:var(--mtr-position);transition:left var(--mtr-snap)}\n.mtr-track.mtr-dragging .mtr-fill,.mtr-track.mtr-dragging .mtr-thumb{transition:none}\n.mtr-track input{pointer-events:none}\n@media(prefers-reduced-motion:reduce){.mtr-track{--mtr-snap:0s linear}}\n.mtr-list{max-height:min(300px,46vh);overflow:auto}.mtr-group+.mtr-group{border-top:1px solid var(--dsw-alias-border-l1);margin-top:3px;padding-top:3px}.mtr-panel .mtr-group-name{font-size:11px;font-weight:560;padding:6px 5px 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mtr-caption{font-size:12px;padding:4px 3px}.mtr-panel .mtr-option{display:flex;width:100%;justify-content:space-between;align-items:center;gap:8px;padding:7px 5px;border-radius:7px;text-align:left}.mtr-error{color:var(--dsw-alias-state-error-primary);font-size:12px;margin-top:8px;overflow-wrap:anywhere}@keyframes mtr-flow{to{background-position:100% 50%}}@keyframes mtr-drift{to{background-position:37px 0,53px 0}}@media(prefers-reduced-motion:reduce){.mtr-track.ultra .mtr-fill,.mtr-stars{animation:none}}.mtr-trigger>.mtr-mini{display:var(--dsh-composer-model-icon-display,none);line-height:0}.mtr-trigger>strong,.mtr-trigger>span{display:var(--dsh-composer-model-text-display,inline)}\n\n.mtr-quick-actions{display:grid;gap:2px;margin-top:9px;padding-top:5px;border-top:1px solid var(--dsw-alias-border-l1)}\n.mtr-panel .mtr-quick-action{display:grid;gap:2px;min-height:30px;padding:6px 7px;border-radius:7px;text-align:start;white-space:normal;overflow-wrap:anywhere;font-size:12px}\n.mtr-quick-action small{color:var(--mtr-muted);font-size:11px}\n\n.mtr-fast-wrap{justify-self:start}\n.mtr-fast svg{fill:none;stroke:currentColor;stroke-width:1.7;stroke-linejoin:round}\n.mtr-panel .mtr-fast[aria-pressed=true]{color:var(--mtr-blue)}\n.mtr-panel .mtr-fast.mtr-fast-ultra[aria-pressed=true]{color:#8b5cf6}\n.mtr-fast[aria-pressed=true] svg{fill:currentColor}\n.mtr-panel .mtr-fast[aria-disabled=true]{cursor:default}\n.mtr-panel .mtr-fast[aria-busy=true] svg{opacity:.55}\n\n.mtr-fast-tip{\n  position:fixed;inset:auto;z-index:1;box-sizing:border-box;margin:0;padding:0 0 5px;border:0;\n  width:max-content;max-width:min(220px,calc(100vw - 12px));overflow:visible;\n  background:none;color:#fafafa;visibility:hidden;\n}\n.mtr-fast-tip[hidden]{display:none}\n.mtr-fast-tip[data-side=below]{padding:5px 0 0}\n.mtr-fast-tip-body{\n  display:grid;gap:2px;padding:6px 10px;border-radius:10px;overflow-wrap:anywhere;\n  background:#18191c;box-shadow:0 4px 12px #0003;text-align:center;font-size:12px;\n}\n.mtr-fast-tip-body small{font-size:inherit;color:#c4c7cc}\n\n/* Two independently drifting fields, cropped by the same fill edge as the thumb. */\n.mtr-fast-active .mtr-stars{background:none;animation:none;--mtr-fast-drift-speed:1.3}\n.mtr-fast-active .mtr-stars::before,.mtr-fast-active .mtr-stars::after{content:'';position:absolute;inset:0}\n.mtr-fast-active .mtr-stars::before{\n  --mtr-star-travel:61px;\n  background:\n    radial-gradient(circle at 7px 8px,#fffd .7px,transparent 1.25px),\n    radial-gradient(circle at 26px 17px,#fff9 .6px,transparent 1.1px),\n    radial-gradient(circle at 46px 11px,#fffb .8px,transparent 1.4px);\n  background-size:var(--mtr-star-travel) 24px;\n  animation:mtr-fast-drift calc(4.8s / var(--mtr-fast-drift-speed)) linear infinite;\n}\n.mtr-fast-active .mtr-stars::after{\n  --mtr-star-travel:83px;\n  background:\n    radial-gradient(circle at 14px 15px,#fff7 .6px,transparent 1.2px),\n    radial-gradient(circle at 35px 6px,#fff9 .7px,transparent 1.2px),\n    radial-gradient(circle at 65px 17px,#fffb .8px,transparent 1.4px);\n  background-size:var(--mtr-star-travel) 24px;\n  animation:mtr-fast-drift calc(8s / var(--mtr-fast-drift-speed)) linear infinite,mtr-fast-twinkle 2.8s ease-in-out infinite alternate;\n}\n@keyframes mtr-fast-drift{to{background-position:var(--mtr-star-travel) 0}}\n@keyframes mtr-fast-twinkle{from{opacity:.44}to{opacity:.92}}\n@media(prefers-reduced-motion:reduce){\n  .mtr-fast-active .mtr-stars::before,.mtr-fast-active .mtr-stars::after{animation:none}\n  .mtr-fast-active .mtr-stars::after{opacity:.65}\n}\n",{"en":{"selectEffort":"Reasoning effort","selectModel":"Select model","fast":"Fast mode","fastSpeed":"Faster responses","fastUsage":"More usage","fastError":"Couldn't change Codex Fast mode. Try reopening the panel.","reset":"Reset to model default","quickEffort":"Set effort to","quickEffortDetail":"Change reasoning effort without switching models.","quickUnavailable":"This shortcut is no longer available. Check the current model and effort.","quickModel":"Switch to","quickModelDetail":"Switch to the configured alternate model.","unsupported":"This model does not offer selectable reasoning levels.","higherUsage":"Higher usage","defaultTier":"Model default","requiresFast":"Requires fast mode","retry":"Retry","unavailable":"Not available"},"zh":{"selectEffort":"推理档位","selectModel":"选择模型","fast":"快速模式","fastSpeed":"响应更快","fastUsage":"消耗更多用量","fastError":"无法切换 Codex 快速模式。请重新打开面板后重试。","reset":"恢复模型默认档位","quickEffort":"推理档改为","quickEffortDetail":"保留当前模型，只调整推理档位。","quickUnavailable":"快捷项已不可用，请检查当前模型和档位。","quickModel":"切换到","quickModelDetail":"切换到预设的备选模型。","unsupported":"当前模型未提供可选推理档位。","higherUsage":"用量较高","defaultTier":"模型默认","requiresFast":"需要快速模式","retry":"重试","unavailable":"不可用"}},{"showLighterEffort":false,"providers":{"zai":{"models":{"glm-5.3":{"lighterEffort":"low"},"glm-5.3-flash":{"lighterEffort":"low"},"glm-5.3-highspeed":{"lighterEffort":"low"},"glm-5.2":{"lighterEffort":"high"},"glm-5.2-highspeed":{"lighterEffort":"high"}}},"zai-coding-cn":{"models":{"glm-5.3":{"lighterEffort":"low"},"glm-5.3-flash":{"lighterEffort":"low"},"glm-5.3-highspeed":{"lighterEffort":"low"}}},"qwen-token-plan":{"models":{"qwen3.8-max":{"lighterEffort":"low"},"qwen3.8-flash":{"lighterEffort":"low"},"glm-5.2":{"lighterEffort":"high"},"glm-5.3":{"lighterEffort":"low"}}},"qwen-token-plan-cn":{"models":{"qwen3.8-max":{"lighterEffort":"low"},"qwen3.8-flash":{"lighterEffort":"low"},"glm-5.2":{"lighterEffort":"high"},"glm-5.3":{"lighterEffort":"low"}}},"qwen-token-plan-individual":{"models":{"qwen3.8-max":{"lighterEffort":"low"},"qwen3.8-flash":{"lighterEffort":"low"},"glm-5.2":{"lighterEffort":"high"}}}}});
}});
