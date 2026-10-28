const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function worker({enabled=true,online=true,hidden=false,protocol=1,authFailure=false}={}){
 let tick,calls=0,capabilities=0;const events={};
 const context=vm.createContext({navigator:{onLine:online},document:{hidden,addEventListener:(name,fn)=>events[name]=fn},
  localStorage:{getItem:()=> 'session'},T28_WEB_CONFIG:{autoSyncMovimientos:enabled},
  setInterval:fn=>tick=fn,setTimeout(){},addEventListener:(name,fn)=>events[name]=fn,
  T28Local:{listOperations:async()=>[{id:'one',method:'sync.movimientos.crear'},{id:'two',method:'sync.movimientos.crear'}],claimRetry:async()=>true},
  T28Api:{syncCapabilities:async()=>{capabilities++;return {data:{protocol,methods:['movimientos.crear']}};},
   reintentarMovimientoSeguro:async()=>{calls++;if(authFailure){const error=Error('expired');error.code='AUTH_EXPIRED';throw error;}}}
 });context.window=context;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/sync-worker.js'),'utf8'),context);
 return {tick:()=>tick(),get calls(){return calls;},get capabilities(){return capabilities;},context,events};
}
test('worker is disabled in production by default and does not run offline or hidden',async()=>{
 for(const options of [{enabled:false},{online:false},{hidden:true}]){
  const w=worker(options);await w.tick();assert.equal(w.calls,0);assert.equal(w.capabilities,0);
 }
});
test('worker requires supported receipts before claiming and replaying',async()=>{
 const old=worker({protocol:0});await old.tick();assert.equal(old.calls,0);
 const current=worker();await current.tick();assert.equal(current.calls,2);
});
test('worker stops on expired sessions and suppresses overlapping runs',async()=>{
 const expired=worker({authFailure:true});await expired.tick();assert.equal(expired.calls,1);
 const current=worker();await Promise.all([current.tick(),current.tick()]);assert.equal(current.calls,2);
});

test('edit worker requires its own switch and matching server capability',async()=>{
 const w=worker({enabled:false});let edits=0;
 w.context.T28_WEB_CONFIG.autoSyncEdiciones=true;
 w.context.T28Local.listOperations=async()=>[{id:'edit',method:'sync.movimientos.editar'}];
 w.context.T28Api.reintentarEdicionSegura=async()=>{edits++;};
 await w.tick();assert.equal(edits,0);
 w.context.T28Api.syncCapabilities=async()=>({data:{protocol:1,methods:['movimientos.editar']}});
 await w.tick();assert.equal(edits,1);assert.equal(w.calls,0);
});

test('deletion worker requires independent enablement and server support',async()=>{
 const w=worker({enabled:false});let deletions=0;
 w.context.T28Local.listOperations=async()=>[{id:'delete',method:'sync.movimientos.eliminar',args:[{id:'target'}]}];
 w.context.T28Api.reintentarEliminacionSegura=async()=>{deletions++;};
 w.context.T28Api.syncCapabilities=async()=>({data:{protocol:1,methods:['movimientos.eliminar']}});
 await w.tick();assert.equal(deletions,0);
 w.context.T28_WEB_CONFIG.autoSyncEliminaciones=true;
 w.context.T28Api.syncCapabilities=async()=>({data:{protocol:1,methods:['movimientos.editar']}});
 await w.tick();assert.equal(deletions,0);
 w.context.T28Api.syncCapabilities=async()=>({data:{protocol:1,methods:['movimientos.eliminar']}});
 await w.tick();assert.equal(deletions,1);
});

test('an unresolved earlier write blocks later changes to the same movement only',async()=>{
 const w=worker();const sent=[];
 w.context.T28_WEB_CONFIG.autoSyncEdiciones=true;
 w.context.T28Local.listOperations=async()=>[
  {id:'old',method:'actualizarMovimientoWeb',args:[{id:'record-a'}]},
  {id:'later',method:'sync.movimientos.editar',args:[{id:'record-a'}]},
  {id:'independent',method:'sync.movimientos.editar',args:[{id:'record-b'}]}
 ];
 w.context.T28Api.syncCapabilities=async()=>({data:{protocol:1,methods:['movimientos.editar']}});
 w.context.T28Api.reintentarEdicionSegura=async id=>sent.push(id);
 await w.tick();assert.deepEqual(sent,['independent']);
});

test('a failed or leased earlier edit blocks a later exit but confirmed edits release it',async()=>{
 for(const outcome of ['failed','leased','confirmed']){
  const w=worker();const sent=[];
  Object.assign(w.context.T28_WEB_CONFIG,{autoSyncEdiciones:true,autoSyncSalidas:true});
  w.context.T28Local.listOperations=async()=>[
   {id:'first',method:'sync.movimientos.editar',args:[{id:'same'}]},
   {id:'second',method:'sync.movimientos.salida',args:[{id:'same'}]}
  ];
  w.context.T28Local.claimRetry=async id=>!(id==='first'&&outcome==='leased');
  w.context.T28Api.syncCapabilities=async()=>({data:{protocol:1,methods:['movimientos.editar','movimientos.salida']}});
  w.context.T28Api.reintentarEdicionSegura=async()=>{sent.push('edit');if(outcome==='failed')throw Error('lost');};
  w.context.T28Api.reintentarSalidaSegura=async()=>sent.push('exit');
  await w.tick();assert.deepEqual(sent,outcome==='confirmed'?['edit','exit']:outcome==='failed'?['edit']:[]);
 }
});
