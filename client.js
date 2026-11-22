// Generated from controller.js, view.js, plugin.js, style.css and locale dictionaries.
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

function createView(React, createPortal) {
 const h = React.createElement, { useState, useRef, useLayoutEffect, useEffect, useMemo } = React;
 const reset = 'M3 4v5h5 M3.6 9a9 9 0 1 1 .2 7';
 const icon = path => h('svg', {
   width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none',
   stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
 }, h('path', { d: path }));
 return function TierView({
   tiers = [], activeId, modelLabel, modelId, models = [], busy, disabled,
   onSelect, onModel, onReset, fast, error, t,
 }) {
   const text = (key, fallback) => t?.(key) || fallback;
   const [page, setPage] = useState(''), [preview, setPreview] = useState(null);
   const [pendingModel, setPendingModel] = useState(null);
   const anchor = useRef(null), panel = useRef(null), slider = useRef(null), railRef = useRef(null);
   const [railW, setRailW] = useState(0);
   const drag = useRef(false), draft = useRef(null), keyboard = useRef(false);
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
     drag.current = false; draft.current = null; setPreview(null); setPage('');
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
   // The thumb centre and the fill edge derive from one measured travel width, so they can never disagree.
   useLayoutEffect(() => {
     if (page !== 'effort') return;
     const el = railRef.current;
     if (!el) return;
     const measure = () => setRailW(el.getBoundingClientRect().width);
     measure();
     const ro = new ResizeObserver(measure);
     ro.observe(el);
     return () => ro.disconnect();
   }, [page]);
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
     if (error || !wanted || wanted.id === activeId) { setPreview(null); draft.current = null; }
   }, [preview, busy, activeId, error, options]);

   const commit = i => {
     if (!blocked && options[i] && options[i].id !== activeId) onSelect(options[i].id);
   };
   const button = (label, action, child, cls, extra = {}) => h('button', {
     type: 'button', className: cls, title: label, 'aria-label': label, onClick: action, ...extra,
   }, child);
   const pct = options.length > 1 ? idx / (options.length - 1) : 0;
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
   const travel = railW > 14 ? railW - 28 : 0;
   const x = travel ? 14 + pct * travel : 0;
   const track = h('div', { className: 'mtr-track' + (peak ? ' ultra' : '') + (shining ? ' shine' : ''), ref: railRef },
     idx > 0 && h('i', { className: 'mtr-fill', style: { width: x + 'px' } },
       shining && h('i', { className: 'mtr-stars' })),
     h('span', { className: 'mtr-ticks', 'aria-hidden': true },
       options.map((tier, i) => h('i', { key: tier.id, style: i < idx ? { opacity: 0.6, background: '#fff' } : { opacity: 0.5 } }))),
     h('i', { className: 'mtr-thumb', style: { left: x + 'px' } }),
     h('input', {
       type: 'range', min: 0, max: Math.max(1, options.length - 1), step: 1, value: idx,
       disabled: blocked || options.length < 2, 'aria-label': text('selectEffort', 'Select effort'),
       'aria-valuetext': tierLabel, ref: slider,
       onPointerDown: e => { drag.current = true; draft.current = null; e.currentTarget.setPointerCapture(e.pointerId); },
       onChange: e => {
         const i = Number(e.target.value);
         setPreview(i);
         if (drag.current) draft.current = i; else commit(i);
       },
       onPointerUp: e => {
         if (drag.current) commit(draft.current ?? Number(e.currentTarget.value));
         drag.current = false; draft.current = null;
       },
       onPointerCancel: () => { drag.current = false; draft.current = null; setPreview(null); },
     }),
   );
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

// This file is inserted into the lazy loader factory by build.mjs. No private UI imports.
function makePlugin(React, createPortal, css, dictionaries) {
  const h = React.createElement;
  const View = createView(React, createPortal);
  const ns = 'dsh-model-tier-slider';
  function Seat({source,locked,t}) {
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
    const submit = async (action, id) => {
      if (!mounted.current || locked || inflight.current) return false;
      const selection = selectionFor(read(), action, id, projected.modelId);
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
      error: error || snapshot.error || snapshot.failures.map(f => `${f.name}: ${f.message}`).join('; '),
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

return makePlugin(require('react'),require('react-dom').createPortal,".mtr-root,.mtr-panel{font:13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dsw-alias-label-primary);--mtr-blue:var(--dsw-static-blue-500,#3b82f6);--mtr-muted:var(--dsw-alias-label-secondary);--mtr-surface:var(--dsw-alias-bg-layer-1);--mtr-hover:color-mix(in srgb,currentColor 6%,transparent)}\n.mtr-root{display:inline-flex;min-width:0;align-items:center}.mtr-root button,.mtr-panel button{font:inherit;letter-spacing:normal;text-transform:none;color:inherit;cursor:pointer;border:0;background:none;box-shadow:none;margin:0;min-height:0}.mtr-root button:focus-visible,.mtr-panel button:focus-visible,.mtr-track:has(input:focus-visible){outline:2px solid var(--mtr-blue);outline-offset:2px}\n.mtr-root .mtr-trigger{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:28px;max-width:min(220px,34vw);padding:0 9px;border-radius:18px;white-space:nowrap}.mtr-trigger strong,.mtr-trigger span,.mtr-heading small,.mtr-option span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mtr-trigger strong{font-weight:560}.mtr-trigger span,.mtr-heading small,.mtr-caption,.mtr-panel .mtr-group-name{color:var(--mtr-muted)}.mtr-trigger:hover,.mtr-trigger[aria-expanded=true],.mtr-panel button:enabled:hover{background:var(--mtr-hover)}\n.mtr-panel{position:fixed;inset:auto;margin:0;box-sizing:border-box;visibility:hidden;width:min(255px,calc(100vw - 12px));max-height:calc(100dvh - 12px);overflow:auto;padding:10px 12px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--mtr-surface);box-shadow:0 12px 30px -12px color-mix(in srgb,var(--dsw-alias-label-primary) 30%,transparent),0 2px 6px color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);z-index:1000}.mtr-head{display:grid;grid-template-columns:24px minmax(0,1fr) 24px;align-items:start;gap:2px}.mtr-panel .mtr-icon{width:24px;height:24px;padding:4px;display:grid;place-items:center;color:var(--mtr-muted);border-radius:8px}.mtr-panel button:disabled{cursor:default;opacity:.5}.mtr-panel .mtr-heading{display:grid;min-width:0;max-width:100%;justify-self:center;gap:2px;padding:3px 8px;border-radius:8px;text-align:center}.mtr-heading b{font-size:14px;font-weight:560}.mtr-heading b.mtr-ultra-label{color:#8b5cf6}.mtr-heading small{font-size:12px}\n.mtr-track{position:relative;height:24px;margin-top:11px;border-radius:99px;background:color-mix(in srgb,var(--mtr-blue) 12%,var(--mtr-surface))}.mtr-fill{position:absolute;left:0;top:0;bottom:0;min-width:0;overflow:hidden;border-radius:99px;background:var(--mtr-blue);pointer-events:none;z-index:1}.mtr-track.ultra .mtr-fill{background:linear-gradient(100deg,#2563eb,#4f46e5 38%,#a855f7 72%,#7c3aed);background-size:150% 100%;animation:mtr-flow 3s ease-in-out infinite alternate}.mtr-stars{position:absolute;inset:0;width:100%;height:100%;background:radial-gradient(circle at 9px 11px,#fff9 .9px,transparent 1.3px) 0 0/37px 18px,radial-gradient(circle at 22px 5px,#fff6 1px,transparent 1.5px) 0 0/53px 21px;animation:mtr-drift 5s linear infinite}.mtr-ticks{position:absolute;inset:0 14px;display:flex;align-items:center;justify-content:space-between;pointer-events:none;z-index:2}.mtr-ticks i{width:2px;height:2px;border-radius:50%;background:var(--dsw-alias-label-secondary)}.mtr-thumb{position:absolute;top:50%;transform:translate(-50%,-50%);width:28px;height:28px;box-sizing:border-box;border-radius:50%;background:var(--mtr-surface);border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);box-shadow:0 1px 3px color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent);pointer-events:none;z-index:3}.mtr-track input{position:absolute;left:0;top:-2px;width:100%;height:28px;appearance:none;background:none;opacity:0;cursor:pointer;margin:0;padding:0;touch-action:none;z-index:4}.mtr-track input::-webkit-slider-runnable-track{height:28px;background:none}.mtr-track input::-webkit-slider-thumb{appearance:none;width:28px;height:28px;margin:0}.mtr-track input::-moz-range-track{height:28px;background:none}.mtr-track input::-moz-range-thumb{width:28px;height:28px;border:0}\n.mtr-list{max-height:min(300px,46vh);overflow:auto}.mtr-group+.mtr-group{border-top:1px solid var(--dsw-alias-border-l1);margin-top:3px;padding-top:3px}.mtr-panel .mtr-group-name{font-size:11px;font-weight:560;padding:6px 5px 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mtr-caption{font-size:12px;padding:4px 3px}.mtr-panel .mtr-option{display:flex;width:100%;justify-content:space-between;align-items:center;gap:8px;padding:7px 5px;border-radius:7px;text-align:left}.mtr-error{color:var(--dsw-alias-state-error-primary);font-size:12px;margin-top:8px;overflow-wrap:anywhere}@keyframes mtr-flow{to{background-position:100% 50%}}@keyframes mtr-drift{to{background-position:37px 0,53px 0}}@media(prefers-reduced-motion:reduce){.mtr-track.ultra .mtr-fill,.mtr-stars{animation:none}}.mtr-trigger>.mtr-mini{display:var(--dsh-composer-model-icon-display,none);line-height:0}.mtr-trigger>strong,.mtr-trigger>span{display:var(--dsh-composer-model-text-display,inline)}\n",{"en":{"selectEffort":"Reasoning effort","selectModel":"Select model","fast":"Fast mode","reset":"Reset to model default","unsupported":"This model does not offer selectable reasoning levels.","higherUsage":"Higher usage","defaultTier":"Model default","requiresFast":"Requires fast mode","retry":"Retry","unavailable":"Not available"},"zh":{"selectEffort":"推理档位","selectModel":"选择模型","fast":"快速模式","reset":"恢复模型默认档位","unsupported":"当前模型未提供可选推理档位。","higherUsage":"用量较高","defaultTier":"模型默认","requiresFast":"需要快速模式","retry":"重试","unavailable":"不可用"}});
}});
