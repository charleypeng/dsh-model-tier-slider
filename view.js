// The visual position is continuous; only the committed index is discrete.
export function pointerFraction(clientX, left, width, grabOffset = 0) {
  const travel = width - 28;
  return travel <= 0 ? 0 : Math.min(1, Math.max(0, (clientX - left - 14 - grabOffset) / travel));
}
export function tierAt(fraction, count) { return Math.round(fraction * Math.max(0, count - 1)); }
export function thumbPosition(fraction) { return `calc(${fraction * 100}% + ${14 - 28 * fraction}px)`; }

export function createView(React, createPortal) {
 const h = React.createElement, { useState, useRef, useLayoutEffect, useEffect, useMemo } = React;
 const reset = 'M3 4v5h5 M3.6 9a9 9 0 1 1 .2 7';
 const icon = path => h('svg', {
   width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none',
   stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
 }, h('path', { d: path }));
 // Keep per-pixel updates local to the rail, not the surrounding model menu.
 function EffortRail({ options, idx, tierLabel, label, peak, shining, blocked, slider, dragging, preview, commit }) {
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
   return h('div', { className: 'mtr-track' + (peak ? ' ultra' : '') + (point !== null ? ' mtr-dragging' : ''),
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
   onSelect, onModel, onReset, fast, error, t,
 }) {
   const text = (key, fallback) => t?.(key) || fallback;
   const [page, setPage] = useState(''), [preview, setPreview] = useState(null);
   const [pendingModel, setPendingModel] = useState(null);
   const anchor = useRef(null), panel = useRef(null), slider = useRef(null);
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
     drag.current = false; setPreview(null); setPage('');
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
     const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } };
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
   // Keyboard entry lands focus inside the pane; pointer entry keeps it on the trigger (no stray ring).
   useLayoutEffect(() => {
     if (!page || !keyboard.current) return;
     const p = panel.current;
     if (!p) return;
     const target = page === 'model'
       ? (p.querySelector('[aria-checked="true"]:enabled') || p.querySelector('.mtr-option:enabled'))
       : slider.current;
     target?.focus({ preventScroll: true });
   }, [page, open]);

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
   const shining = fast || peak;
   const subtitle = ultra ? text('higherUsage', 'Consumes usage limits faster') : model;
   const trigger = button(
     `${model} ${tierLabel}`,
     e => { keyboard.current = e.detail === 0; if (page) close(true); else setPage(options.length ? 'effort' : 'model'); },
     h(React.Fragment, null,
       h('i', { className: 'mtr-mini', 'aria-hidden': true }, icon('M3 7h7m4 0h7M3 17h11m4 0h3M10 4v6m6 4v6')),
       h('strong', null, model),
       explicit && h('span', null, tierLabel)),
     'mtr-trigger',
     { 'aria-expanded': !!page, 'aria-haspopup': 'dialog', disabled: !!disabled, ref: anchor },
   );
   const track = h(EffortRail, {
     key: JSON.stringify([modelId, ...options.map(tier => tier.id)]),
     options, idx, tierLabel, label: text('selectEffort', 'Select effort'), peak, shining, blocked,
     slider, dragging: drag, preview: setPreview, commit,
   });
   const header = h('div', { className: 'mtr-head' },
     h('span', { className: 'mtr-spacer', 'aria-hidden': true }),
     button(text('selectModel', 'Select model'), () => setPage('model'),
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
       group.items.map(m => button(m.label, () => {
         if (blocked || m.available === false) return;
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
   const popover = h('div', {
     className: 'mtr-panel', popover: 'manual', role: 'dialog', ref: panel,
     'aria-label': page === 'model' ? text('selectModel', 'Select model') : text('selectEffort', 'Select effort'),
   }, page === 'model' ? modelList : h(React.Fragment, null,
     header,
     options.length ? track : h('div', { className: 'mtr-caption' }, text('unsupported', 'Unavailable')),
   ), error && h('div', { className: 'mtr-error', role: 'alert' }, String(error)));
   return h('span', { className: 'mtr-root' }, trigger, page && createPortal(popover, document.body));
 };
}
