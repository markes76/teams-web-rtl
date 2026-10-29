const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createWindowController} = require('../extension/windows.js');
function fixture() {
  let saved = {}, next = 100;
  const existing = new Set(), creates = [], focuses = [];
  const api = {
    runtime:{id:'rtl-test',getURL:p=>`chrome-extension://rtl-test/${p}`},
    storage:{session:{get:async()=>({callChatWindows:{...saved}}),set:async data=>{saved={...data.callChatWindows};}},local:{get:async()=>({autoCallChat:true})}},
    tabs:{query:async()=>[{id:9}]},
    windows:{create:async options=>{creates.push(options);existing.add(next);return{id:next++};},get:async id=>{if(!existing.has(id))throw Error('closed');return{id};},update:async(id,options)=>{focuses.push([id,options]);}},
  };
  return {api,creates,focuses,existing};
}
const teams = {id:'rtl-test',url:'https://teams.cloud.microsoft/',tab:{id:7}};
test('opening a companion never navigates/moves/reloads the call tab',async()=>{
  const f=fixture(), c=createWindowController(f.api);
  const result=await c.handle({type:'teams-rtl:call-active'},teams);
  assert.equal(result.ok,true);assert.deepEqual(f.creates,[{url:'https://teams.cloud.microsoft/',type:'popup',width:1200,height:880,focused:true}]);
});
test('duplicate call detections coalesce to one window',async()=>{
  const f=fixture(), c=createWindowController(f.api);
  const results=await Promise.all([c.handle({type:'teams-rtl:call-active'},teams),c.handle({type:'teams-rtl:call-active'},teams)]);
  assert.equal(f.creates.length,1);assert.equal(results[0].windowId,results[1].windowId);
});
test('session metadata allows worker restart to reuse an existing window',async()=>{
  const f=fixture();await createWindowController(f.api).handle({type:'teams-rtl:call-active'},teams);
  await createWindowController(f.api).handle({type:'teams-rtl:call-active'},teams);assert.equal(f.creates.length,1);
});
test('automatic and manual actions visibly focus an existing companion',async()=>{
  const f=fixture(), c=createWindowController(f.api);
  await c.handle({type:'teams-rtl:call-active'},teams);await c.handle({type:'teams-rtl:open-chat'},teams);
  assert.equal(f.focuses.length,1);assert.deepEqual(f.focuses[0][1],{focused:true});
});
test('a minimized companion is restored before focusing',async()=>{
  const f=fixture(),c=createWindowController(f.api);
  await c.handle({type:'teams-rtl:call-active'},teams);
  f.api.windows.get=async id=>({id,state:'minimized'});
  await c.handle({type:'teams-rtl:call-active'},teams);
  assert.deepEqual(f.focuses[0][1],{focused:true,state:'normal'});
});
test('closed companion can be recreated',async()=>{
  const f=fixture(), c=createWindowController(f.api);
  await c.handle({type:'teams-rtl:call-active'},teams);f.existing.clear();await c.handle({type:'teams-rtl:open-chat'},teams);assert.equal(f.creates.length,2);
});
test('disabled automatic setting is respected',async()=>{
  const f=fixture();f.api.storage.local.get=async()=>({autoCallChat:false});
  const r=await createWindowController(f.api).handle({type:'teams-rtl:call-active'},teams);assert.equal(r.skipped,true);assert.equal(f.creates.length,0);
});
test('unexpected senders and URLs cannot open windows',async()=>{
  const f=fixture(),c=createWindowController(f.api);
  for(const sender of [{...teams,id:'other'},{...teams,url:'https://evil.example/'},{...teams,url:'https://teams.cloud.microsoft.evil.example/'},{id:'rtl-test',url:'https://teams.cloud.microsoft/'}])assert.equal((await c.handle({type:'teams-rtl:call-active'},sender)).ok,false);
  assert.equal(f.creates.length,0);
});
test('popup manual request works without tabs permission or URL inspection',async()=>{
  const f=fixture();const r=await createWindowController(f.api).handle({type:'teams-rtl:open-chat'},{id:'rtl-test',url:f.api.runtime.getURL('popup.html')});assert.equal(r.ok,true);assert.equal(f.creates[0].focused,true);
});
