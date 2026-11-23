// The visual position is continuous; only the committed index is discrete.
export function pointerFraction(clientX, left, width, grabOffset = 0) {
  const travel = width - 28;
  return travel <= 0 ? 0 : Math.min(1, Math.max(0, (clientX - left - 14 - grabOffset) / travel));
}
export function tierAt(fraction, count) { return Math.round(fraction * Math.max(0, count - 1)); }
export function thumbPosition(fraction) { return `calc(${fraction * 100}% + ${14 - 28 * fraction}px)`; }

export function createView(React, createPortal) {
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
         onClick: () => { if (!blocked) onQuickAction?.(id); },
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
