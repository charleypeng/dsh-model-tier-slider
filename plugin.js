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
