const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createRuntimeAccess} = require('../preload.cjs');
test('invalidated extension APIs shut down once without an uncaught error',async()=>{
  assert.equal(typeof createRuntimeAccess,'function','extension API boundary must handle invalidation');
  let shutdowns=0, operations=0;
  const api={runtime:{id:'test'}};
  const access=createRuntimeAccess(api,()=>shutdowns++);
  const result=await access.invoke(()=>{operations++;throw new Error('Extension context invalidated.');});
  assert.equal(result,undefined);assert.equal(shutdowns,1);
  await access.invoke(()=>{operations++;});
  assert.equal(operations,1);assert.equal(shutdowns,1);
});
test('a removed runtime ID stops callbacks before another API call',async()=>{
  assert.equal(typeof createRuntimeAccess,'function');
  const api={runtime:{id:'test'}};let shutdowns=0,called=false;
  const access=createRuntimeAccess(api,()=>shutdowns++);
  api.runtime.id=undefined;
  await access.invoke(()=>{called=true;});
  assert.equal(called,false);assert.equal(shutdowns,1);
});
test('a rejected invalidation promise also shuts down cleanly',async()=>{
  assert.equal(typeof createRuntimeAccess,'function');
  let shutdowns=0;
  const access=createRuntimeAccess({runtime:{id:'test'}},()=>shutdowns++);
  await access.invoke(()=>Promise.reject(new Error('Extension context invalidated.')));
  assert.equal(shutdowns,1);
});
test('normal results and ordinary failures remain observable',async()=>{
  assert.equal(typeof createRuntimeAccess,'function');
  let shutdowns=0;
  const access=createRuntimeAccess({runtime:{id:'test'}},()=>shutdowns++);
  assert.deepEqual(await access.invoke(()=>({ok:true})),{ok:true});
  await assert.rejects(access.invoke(()=>Promise.reject(new Error('Receiving end does not exist'))),/Receiving end/);
  assert.equal(shutdowns,0);
});
