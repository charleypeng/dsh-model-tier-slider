import {test} from 'node:test';
import assert from 'node:assert/strict';
import {project,selectionFor} from './controller.js';
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
