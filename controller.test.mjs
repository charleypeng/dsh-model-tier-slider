import {test} from 'node:test';
import assert from 'node:assert/strict';
import {project,selectionFor} from './controller.js';
import {callCodexFast} from './plugin.js';
import {readFileSync} from 'node:fs';
import {resolveSpeedActions, validateSpeedConfig} from './speed.js';
const profiles = validateSpeedConfig(JSON.parse(readFileSync(new URL('./speed-profiles.json', import.meta.url))));
const catalog = (provider, model, effort, supported, next = []) => ({status:'ready', current:{provider,model,reasoningEffort:effort}, groups:[
  {id:provider, name:provider, models:[{id:model,name:model,reasoning:{efforts:supported.map(id => ({id,name:id}))}}, ...next]},
]});

test('GLM and Qwen shortcuts require exact route, model, and an advertised lower effort', () => {
  const cases = [
    ['zai','glm-5.3','max',['low','high','max'],'low'],
    ['zai','glm-5.2','max',['off','high','max'],'high'],
    ['zai','glm-5.2','off',['off','high','max'],undefined],
    ['qwen-token-plan-cn','glm-5.2','max',['high','max'],'high'],
    ['qwen-token-plan-cn','qwen3.8-max','xhigh',['low','medium','xhigh'],'low'],
    ['qwen-token-plan','qwen3.7-plus','high',['off','low','high'],undefined],
    ['qwen-token-plan','qwen3.8-max','xhigh',['medium','xhigh'],undefined],
    ['other','glm-5.3','max',['low','high','max'],undefined],
  ];
  for (const [provider, model, active, supported, expected] of cases) {
    const result = resolveSpeedActions(project(catalog(provider,model,active,supported)),profiles,false);
    assert.deepEqual(result.map(action => [action.kind,action.value]), expected ? [['effort',expected]] : []);
  }
});

test('explicit alternatives must be available under the same provider and switch through native selection', () => {
  const config = validateSpeedConfig({providers:{'p/q':{lighterEffort:false,models:{heavy:{alternateModel:'fast'}}}}});
  const snapshot = catalog('p/q','heavy','high',['low','high'],[{id:'fast',name:'Alternate',reasoning:{defaultEffort:'medium'}}]);
  const [shortcut] = resolveSpeedActions(project(snapshot), config,false);
  assert.equal(shortcut.kind,'model');
  assert.deepEqual(selectionFor(snapshot,shortcut.kind,shortcut.value),{provider:'p/q',model:'fast',reasoningEffort:'medium'});
  const elsewhere = catalog('p/q','heavy','high',['low','high']);
  elsewhere.groups.push({id:'other',models:[{id:'fast',name:'Wrong route'}]});
  assert.deepEqual(resolveSpeedActions(project(elsewhere),config,false), []);
  assert.deepEqual(resolveSpeedActions(project({...snapshot,current:{provider:'p/q',model:'fast'}}),config,false), []);
});

test('speed profiles reject arbitrary tier injection and prioritize route/model-specific opt-outs', () => {
  for (const invalid of [{providers:{example:{service_tier:'priority'}}}, {showLighterEffort:'low'}, {providers:{example:{models:{one:{alternateModel:2}}}}}]) {
    assert.throws(() => validateSpeedConfig(invalid));
  }
  const state = project(catalog('p','m','high',['off','low','high']));
  const cfg = validateSpeedConfig({showLighterEffort:true,providers:{p:{lighterEffort:'off',models:{m:{lighterEffort:false}}}}});
  assert.deepEqual(resolveSpeedActions(state,cfg,false), []);
  assert.deepEqual(resolveSpeedActions(state,{showLighterEffort:true},true), []);
  assert.equal(resolveSpeedActions(state,{showLighterEffort:true},false)[0].value,'low');
});

test('Fast uses the same-origin bridge and the exact session/model pair', async () => {
  const signal = new AbortController().signal;
  const payload = {sessionId:'s-1', model:'model-alpha', enabled:true};
  const result = await callCodexFast('setFast',payload,signal,async (url, init) => {
    assert.equal(url,'/codex-api/setFast');
    assert.equal(init.credentials,'same-origin'); assert.equal(init.method,'POST');
    assert.equal(init.signal,signal); assert.deepEqual(JSON.parse(init.body),{payload});
    return {ok:true,json:async () => ({ok:true,value:{available:true,enabled:true,tier:'priority'}})};
  });
  assert.equal(result.enabled,true); assert.equal(result.tier,'priority');
});
test('no Fast control without a bridge-confirmed priority capability', async () => {
  const req = (value) => callCodexFast('fastStatus',{},undefined,async () => ({ok:true,json:async () => ({ok:true,value})}));
  for (const value of [null,{available:false},{available:true,enabled:true,tier:'ultrafast'},{available:true,enabled:'true',tier:'priority'}]) {
    assert.equal(await req(value),null);
  }
  await assert.rejects(callCodexFast('fastStatus',{},undefined,async () => ({ok:false,status:404})));
});
const state = {status:'ready', pending:null,current:{provider:'p/q',model:'m'},groups:[
  {id:'p/q',name:'First',models:[{id:'m',name:'One',reasoning:{defaultEffort:'medium',efforts:[{id:'low',name:'Light'},{id:'medium',name:'Medium'}]}}]},
  {id:'p',name:'Second',models:[{id:'q/m',name:'One'}]}]};
const route = project(state).modelId;

import {pointerFraction, tierAt, thumbPosition} from './view.js';
test('pointer travel is continuous inside a tier, but release selects the nearest stop', () => {
  // 228px rail with a 28px thumb gives exactly 200px of travel.
  const at = x => pointerFraction(x, 50, 228);
  assert.equal(at(104), .20); assert.equal(at(114), .25);
  assert.equal(tierAt(at(104), 5), 1); assert.equal(tierAt(at(114), 5), 1);
  assert.equal(tierAt(at(138), 5), 1); assert.equal(tierAt(at(139), 5), 2);
});
test('off-centre grabs keep the position; bounds and single-tier tracks are safe', () => {
  assert.equal(pointerFraction(224, 100, 228, 10), .5);
  assert.equal(pointerFraction(-500, 100, 228), 0); assert.equal(pointerFraction(500, 100, 228), 1);
  assert.equal(pointerFraction(140, 100, 20), 0); assert.equal(tierAt(.85, 1), 0);
  assert.equal(thumbPosition(.5), 'calc(50% + 0px)');
});
test('generated client registers a single composer seat and skips addressed subagents',async()=>{
  const {readFile} = await import('node:fs/promises');
  const vm = await import('node:vm'); let module,entry,disposer;
  vm.runInNewContext(await readFile(new URL('./client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load(x){module=x;}}}});
  const manifest = JSON.parse(await readFile(new URL('./package.json',import.meta.url),'utf8'));
  assert.equal(module.id,manifest.name);
  const registered=module.factory(name=>{assert.ok(['react','react-dom'].includes(name));return {} });
  const directory={},ctx={effect(fn){disposer=fn()},locale:{register(ns,dict){assert.ok(dict.zh.selectModel);return ()=>{}}},slots:{inject(name,fn){assert.equal(name,'conversation.input.model');fn()},register(e,component){entry=e;assert.equal(typeof component,'function')}},sessions:{subagentAddress:id=>id==='child'?{}:undefined},modelDirectories:{directoryFor(id){assert.equal(id,'root');return directory}}};
  registered.apply(ctx);assert.equal(entry.name,'conversation.input.model');assert.ok(entry.priority<0);assert.equal(entry.inject('child').source,null);assert.equal(entry.inject('root').source,directory);assert.equal(typeof disposer,'function');
});
test('catalog identity, defaults, and exact advertised names',()=>{
  const p = project(state); assert.notEqual(p.models[0].id,p.models[1].id);
  assert.equal(p.activeId,'medium'); assert.deepEqual(p.tiers.map(x=>x.label),['Light','Medium']);
});
test('effort changes, model change and reset produce full session selections',()=>{
  assert.deepEqual(selectionFor(state,'effort','low',route),{provider:'p/q',model:'m',reasoningEffort:'low'});
  assert.deepEqual(selectionFor(state,'reset',null,route),{provider:'p/q',model:'m',reasoningEffort:'medium'});
  assert.deepEqual(selectionFor(state,'model',project(state).models[1].id),{provider:'p',model:'q/m'});
});
test('reject unadvertised, removed, stale, pending, and unknown actions',()=>{
  for(const call of [[state,'effort','Ultra',route],[state,'effort','low','old'],[{...state,pending:{}},'effort','low',route],[{...state,groups:[]},'effort','low',route],[state,'model','missing'],[state,'other','low',route]])assert.equal(selectionFor(...call),undefined);
});
test('no declared default omits reasoningEffort; never invents levels',()=>{
  const s={...state,groups:[{...state.groups[0],models:[{id:'m',name:'One',reasoning:{efforts:[{id:'some',name:'Some'}]}}]}]};
  assert.equal(project(s).activeId,undefined);assert.deepEqual(selectionFor(s,'reset',null,route),{provider:'p/q',model:'m'});
  assert.deepEqual(project({...state,current:null}).tiers,[]);
});
