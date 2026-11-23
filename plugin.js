// This file is inserted into the lazy loader factory by build.mjs. No private UI imports.
export async function callCodexFast(endpoint, payload, signal, transport = fetch) {
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

function createFastHook(React) {
  const { useCallback, useEffect, useMemo, useRef, useState } = React;
  return function useFast(sessionId, row) {
    const model = row?.provider === 'openai-codex' ? row.model : null;
    const target = useMemo(() => typeof sessionId === 'string' && model
      ? {sessionId, model} : null, [sessionId, model]);
    const [view, setView] = useState(null);
    const active = useRef(null);
    const refresh = useCallback(() => {
      const current = active.current;
      if (!target || current?.target !== target || current.write) return;
      current.read?.abort();
      const read = new AbortController();
      current.read = read;
      callCodexFast('fastStatus', target, read.signal).then(value => {
        if (active.current === current && !read.signal.aborted) setView({target, value});
      }, () => {
        if (active.current === current && !read.signal.aborted) {
          // A transient status failure is not evidence that Fast was switched off.
          setView(previous => previous?.target === target && previous.value
            ? {...previous, error:true} : previous);
        }
      });
    }, [target]);
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
        const next = await callCodexFast('setFast', {...target, enabled});
        if (active.current === current) setView({target, value:next, error:!next});
      } catch {
        if (active.current === current) setView({target, value, error:true});
      } finally { current.write = false; }
    };
    return { mode: value ? {...value, pending:!!view.pending, onToggle} : null,
      refresh, error: view?.target === target && view?.error };
  };
}
function makePlugin(React, createPortal, css, dictionaries) {
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
      fastMode: fast.mode, onFastOpen: fast.refresh,
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
