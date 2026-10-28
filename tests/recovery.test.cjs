const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { IDBFactory } = require('fake-indexeddb');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function browser({ db = new IDBFactory(), fetch = async () => ({ ok: true, json: async () => ({ ok: true, data: { success: true } }) }), offline = false } = {}) {
  const storage = new Map([['torre28_auth_token', 'secret-session-not-to-be-persisted']]);
  const context = vm.createContext({ indexedDB: db, crypto: webcrypto, fetch, AbortController,
    navigator: { onLine: !offline }, setTimeout, clearTimeout,
    localStorage: { getItem: key => storage.get(key) },
    T28_WEB_CONFIG: { apiUrl: 'https://example.test/api' } });
  context.window = context;
  for (const file of ['local-store.js', 'api-client.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
  context.T28Local.setOwner('operator-1');
  return context;
}
const payload = { placa: 'ABC 123', nombre: 'Persona de prueba', horaEntrada: '2026-10-20T08:00' };

test('a receipt for a different movement never removes an edit, exit or deletion backup',async()=>{
 for(const method of ['editarMovimientoSeguro','salidaMovimientoSeguro','eliminarMovimientoSeguro']){
  const client=browser({fetch:async(_,options)=>{
   const body=JSON.parse(options.body);
   return {ok:true,json:async()=>({ok:true,data:{success:true,operationId:body.payload.operationId,id:'wrong-record'}})};
  }});
  await assert.rejects(client.T28Api[method]({id:'expected-record',_expectedVersion:'version'}),e=>e.code==='INVALID_RECEIPT');
  const [pending]=await client.T28Local.listOperations();
  assert.equal(pending.args[0].id,'expected-record');assert.equal(pending.code,'INVALID_RECEIPT');
  assert.equal(await client.T28Local.claimRetry(pending.id),false);
 }
});

test('deletion survives reload and retries the identical ID and version only',async()=>{
 const db=new IDBFactory();let firstBody;
 const client=browser({db,fetch:async(_,options)=>{firstBody=JSON.parse(options.body);throw Error('lost');}});
 client.T28_WEB_CONFIG.syncEliminaciones=true;
 await assert.rejects(client.T28Api.rpc('eliminarMovimientoWeb',[{id:'record-delete',filaIndex:5,_expectedVersion:'before-delete'}]));
 const [pending]=await client.T28Local.listOperations();assert.equal(pending.method,'sync.movimientos.eliminar');
 let sends=0;
 const reopened=browser({db,fetch:async(_,options)=>{
  sends++;const body=JSON.parse(options.body);assert.deepEqual(body.payload,firstBody.payload);
  assert.equal(body.action,'sync.movimientos.eliminar');
  return {ok:true,json:async()=>({ok:true,data:{success:true,id:'record-delete',operationId:pending.id,replay:true}})};
 }});
 await assert.rejects(reopened.T28Api.reintentarEdicionSegura(pending.id));assert.equal(sends,0);
 await reopened.T28Api.reintentarEliminacionSegura(pending.id);
 assert.equal(sends,1);assert.equal((await reopened.T28Local.listOperations()).length,0);
});

test('deletion conflict remains durable and is excluded from automatic retry',async()=>{
 const client=browser({fetch:async()=>({ok:true,json:async()=>({ok:false,code:'CONFLICT',error:'Changed remotely'})})});
 client.T28_WEB_CONFIG.syncEliminaciones=true;
 await assert.rejects(client.T28Api.rpc('eliminarMovimientoWeb',[{id:'existing',_expectedVersion:'old'}]));
 const [pending]=await client.T28Local.listOperations();assert.equal(pending.args[0].id,'existing');
 assert.equal(await client.T28Local.claimRetry(pending.id),false);
});

test('edit form retry preserves version and clears its linked draft only on confirmation',async()=>{
 const db=new IDBFactory();let body;
 const client=browser({db,fetch:async(_,options)=>{body=JSON.parse(options.body);throw Error('lost');}});
 client.T28_WEB_CONFIG.syncEdiciones=true;
 const draftId=await client.T28Local.saveDraft(payload,true);
 const edit={...payload,id:'existing',_expectedVersion:'original-version',_localDraftId:draftId};
 await assert.rejects(client.T28Api.rpc('actualizarMovimientoWeb',[edit]));
 const [operation]=await client.T28Local.listOperations();assert.equal(operation.method,'sync.movimientos.editar');
 const reopened=browser({db,fetch:async(_,options)=>{
  assert.deepEqual(JSON.parse(options.body).payload,body.payload);
  return {ok:true,json:async()=>({ok:true,data:{success:true,id:'existing',operationId:operation.id,replay:true}})};
 }});
 await assert.rejects(reopened.T28Api.reintentarSalidaSegura(operation.id));
 await reopened.T28Api.reintentarEdicionSegura(operation.id);
 assert.equal((await reopened.T28Local.listOperations()).length,0);assert.equal((await reopened.T28Local.listDrafts()).length,0);
});

test('exit form RPC and retry retain exit operation ID and never become a creation',async()=>{
 let firstBody,secondBody;const db=new IDBFactory();
 const client=browser({db,fetch:async(_,options)=>{firstBody=JSON.parse(options.body);throw Error('lost');}});
 client.T28_WEB_CONFIG.syncSalidas=true;
 const exit={id:'record-1',_expectedVersion:'original',horaSalida:'2026-10-22T15:00:00Z'};
 await assert.rejects(client.T28Api.rpc('registrarSalidaMovimientoWeb',[exit]));
 const [pending]=await client.T28Local.listOperations();assert.equal(pending.method,'sync.movimientos.salida');
 const reopened=browser({db,fetch:async(_,options)=>{secondBody=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,data:{success:true,operationId:pending.id,id:'record-1',replay:true}})};}});
 await assert.rejects(reopened.T28Api.reintentarMovimientoSeguro(pending.id));
 assert.equal(secondBody,undefined);
 assert.equal(firstBody.payload.operationId,pending.id);
 await reopened.T28Api.reintentarSalidaSegura(pending.id);
 assert.deepEqual(secondBody.payload,firstBody.payload);
 assert.equal(secondBody.action,'sync.movimientos.salida');
 assert.equal((await reopened.T28Local.listOperations()).length,0);
});

test('only one tab can claim the same receipt retry at a time',async()=>{
 const db=new IDBFactory(),first=browser({db,offline:true}),second=browser({db,offline:true});
 await assert.rejects(first.T28Api.crearMovimientoSeguro(payload));
 const [record]=await first.T28Local.listOperations();
 const claims=await Promise.all([first.T28Local.claimRetry(record.id),second.T28Local.claimRetry(record.id)]);
 assert.equal(claims.filter(Boolean).length,1);
 assert.equal((await first.T28Local.getOperation(record.id)).attempts,1);
});

test('automatic retry excludes legacy writes, reviewed records and permanent conflicts',async()=>{
 const client=browser({offline:true});
 await assert.rejects(client.T28Api.rpc('guardarAvisoWebT28',[payload]));
 const [legacy]=await client.T28Local.listOperations();
 assert.equal(await client.T28Local.claimRetry(legacy.id),false);
 const conflict=await client.T28Local.begin('sync.movimientos.crear',[payload]);
 await client.T28Local.finish(conflict,{message:'remote change',code:'CONFLICT',uncertain:false});
 assert.equal(await client.T28Local.claimRetry(conflict.id),false);
 const mismatch=await client.T28Local.begin('sync.movimientos.crear',[payload]);
 await client.T28Local.finish(mismatch,{message:'mismatch',code:'OPERATION_MISMATCH',uncertain:true});
 assert.equal(await client.T28Local.claimRetry(mismatch.id),false);
 await client.T28Local.markReviewed(conflict.id);
 assert.equal(await client.T28Local.claimRetry(conflict.id),false);
});

test('fresh in-flight writes and another account cannot be claimed',async()=>{
 const client=browser();const record=await client.T28Local.begin('sync.movimientos.crear',[payload]);
 assert.equal(await client.T28Local.claimRetry(record.id),false);
 await client.T28Local.finish(record,{message:'offline',code:'OFFLINE'});
 client.T28Local.setOwner('other');assert.equal(await client.T28Local.claimRetry(record.id),false);
 client.T28Local.setOwner('operator-1');assert.equal(await client.T28Local.claimRetry(record.id),true);
 const claimed=await client.T28Local.getOperation(record.id);
 await client.T28Local.finish(claimed,{message:'network',code:'NETWORK_ERROR',uncertain:true});
 assert.equal(await client.T28Local.claimRetry(record.id),false);
});

test('the existing form RPC uses receipt mode only when explicitly enabled',async()=>{
  const actions=[];
  const client=browser({fetch:async (_,options)=>{
    const body=JSON.parse(options.body);actions.push(body.action);
    return {ok:true,json:async()=>({ok:true,data:{success:true,id:'saved',operationId:body.payload.operationId}})};
  }});
  await client.T28Api.rpc('registrarMovimientoWeb',[payload]);
  client.T28_WEB_CONFIG.syncMovimientos=true;
  await client.T28Api.rpc('registrarMovimientoWeb',[payload]);
  assert.deepEqual(actions,['rpc','sync.movimientos.crear']);
  assert.equal((await client.T28Local.listOperations()).length,0);
});

test('enabled form receipt mode never falls back when the server rejects its route',async()=>{
  let sent=0;
  const client=browser({fetch:async()=>{sent++;return {ok:true,json:async()=>({ok:false,error:'Route unavailable'})};}});
  client.T28_WEB_CONFIG.syncMovimientos=true;
  await assert.rejects(client.T28Api.rpc('registrarMovimientoWeb',[payload]));
  assert.equal(sent,1);
  assert.equal((await client.T28Local.listOperations())[0].method,'sync.movimientos.crear');
});

test('safe movement retry reuses the durable ID and payload after a lost reply', async () => {
  const db=new IDBFactory(); let firstBody;
  const first=browser({db,fetch:async (_,options)=>{firstBody=JSON.parse(options.body);throw Error('lost');}});
  await assert.rejects(first.T28Api.crearMovimientoSeguro(payload));
  const [pending]=await first.T28Local.listOperations();
  assert.equal(firstBody.payload.operationId,pending.id);
  const reopened=browser({db,fetch:async (_,options)=>{
    const body=JSON.parse(options.body);
    assert.deepEqual(body.payload,firstBody.payload);
    assert.equal(body.action,'sync.movimientos.crear');
    return {ok:true,json:async()=>({ok:true,data:{success:true,operationId:pending.id,id:'saved-record'}})};
  }});
  await reopened.T28Api.reintentarMovimientoSeguro(pending.id);
  assert.equal((await reopened.T28Local.listOperations()).length,0);
});

test('confirmation removes the linked draft atomically even after account switch',async()=>{
  const client=browser();
  const draftId=await client.T28Local.saveDraft(payload,false);
  const operation=await client.T28Local.begin('sync.movimientos.crear',[{...payload,_localDraftId:draftId}]);
  client.T28Local.setOwner('another-account');
  await client.T28Local.finish(operation);
  client.T28Local.setOwner('operator-1');
  assert.equal((await client.T28Local.listOperations()).length,0);
  assert.equal((await client.T28Local.listDrafts()).length,0);
});

test('a malformed sync acknowledgment never removes the durable operation',async()=>{
  const client=browser();
  await assert.rejects(client.T28Api.crearMovimientoSeguro(payload),{code:'INVALID_RECEIPT'});
  const [pending]=await client.T28Local.listOperations();
  assert.equal(pending.status,'uncertain');
});

test('safe retries cannot read another account or fall back to a legacy write',async()=>{
  let sent=0;
  const client=browser({offline:true,fetch:async()=>{sent++;}});
  await assert.rejects(client.T28Api.crearMovimientoSeguro(payload));
  const [pending]=await client.T28Local.listOperations();
  client.T28Local.setOwner('other-account');
  await assert.rejects(client.T28Api.reintentarMovimientoSeguro(pending.id));
  assert.equal(sent,0);
});

test('changing session while the local commit is pending prevents network dispatch',async()=>{
  let sent=0;
  const client=browser({fetch:async()=>{sent++;}});
  const begin=client.T28Local.begin;
  client.T28Local.begin=async (...args)=>{
    const operation=await begin(...args);
    client.localStorage.getItem=()=> 'a-different-session';
    return operation;
  };
  await assert.rejects(client.T28Api.crearMovimientoSeguro(payload),{code:'SESSION_CHANGED'});
  assert.equal(sent,0);
  assert.equal((await client.T28Local.listOperations()).length,1);
});

test('the durable write exists before dispatch, then disappears only after confirmation', async () => {
  let client;
  client = browser({ fetch: async () => {
    const records = await client.T28Local.listOperations();
    assert.equal(records.length, 1);
    assert.equal(records[0].status, 'sending');
    assert.equal(JSON.stringify(records).includes('secret-session'), false);
    return { ok: true, json: async () => ({ ok: true, data: { success: true } }) };
  } });
  await client.T28Api.rpc('registrarMovimientoWeb', [payload]);
  assert.equal((await client.T28Local.listOperations()).length, 0);
});

test('a lost response is retained after reload and is never automatically replayed', async () => {
  const db = new IDBFactory(); let sent = 0;
  const client = browser({ db, fetch: async () => { sent++; throw new TypeError('response lost after commit'); } });
  await assert.rejects(client.T28Api.rpc('registrarMovimientoWeb', [payload]), /interrumpió/);
  const reopened = browser({ db, fetch: async () => { sent++; } });
  const records = await reopened.T28Local.listOperations();
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'uncertain');
  assert.equal(records[0].args[0].placa, payload.placa);
  assert.equal(sent, 1);
});

test('offline keeps records locally without sending a request', async () => {
  let sent = 0;
  const client = browser({ offline: true, fetch: async () => { sent++; } });
  await assert.rejects(client.T28Api.rpc('guardarAvisoWebT28', [{ titulo: 'Aviso de prueba' }]), /Sin conexión/);
  const records = await client.T28Local.listOperations();
  assert.equal(sent, 0); assert.equal(records.length, 1); assert.equal(records[0].code, 'OFFLINE');
});

test('failed local transaction blocks a write before it reaches the server', async () => {
  let sent = 0;
  const client = browser({ db: null, fetch: async () => { sent++; } });
  await assert.rejects(client.T28Api.rpc('registrarMovimientoWeb', [payload]), { code: 'LOCAL_STORAGE_FAILED' });
  assert.equal(sent, 0);
});

test('server conflict preserves local changes and is not acknowledged as synchronized', async () => {
  const client = browser({ fetch: async () => ({ ok: true, json: async () => ({ ok: false, code: 'CONFLICT', error: 'Cambio remoto' }) }) });
  await assert.rejects(client.T28Api.rpc('actualizarMovimientoWeb', [payload]), { code: 'CONFLICT' });
  const records = await client.T28Local.listOperations();
  assert.equal(records[0].status, 'rejected'); assert.equal(records[0].args[0].nombre, payload.nombre);
});

test('nested failure returned by a legacy RPC is not treated as a saved record', async () => {
  const client = browser({ fetch: async () => ({ ok: true, json: async () => ({ ok: true, data: { success: false, message: 'No guardado' } }) }) });
  await assert.rejects(client.T28Api.rpc('registrarMovimientoWeb', [payload]), /No guardado/);
  assert.equal((await client.T28Local.listOperations()).length, 1);
});

test('accounts and endpoints cannot see or remove each other’s recovery drafts', async () => {
  const client = browser();
  const id = await client.T28Local.saveDraft(payload, false);
  client.T28Local.setOwner('operator-2');
  assert.equal((await client.T28Local.listDrafts()).length, 0);
  await client.T28Local.removeDraft(id);
  client.T28Local.setOwner('operator-1');
  assert.equal((await client.T28Local.listDrafts()).length, 1);
  client.T28_WEB_CONFIG.apiUrl = 'https://another.test/api';
  assert.equal((await client.T28Local.listDrafts()).length, 0);
});

test('drafts survive reopening and a confirmed draft can be removed', async () => {
  const db = new IDBFactory();
  const first = browser({ db });
  const id = await first.T28Local.saveDraft(payload, true);
  const second = browser({ db });
  assert.equal((await second.T28Local.listDrafts())[0].datos.placa, payload.placa);
  await second.T28Local.removeDraft(id);
  assert.equal((await first.T28Local.listDrafts()).length, 0);
});

test('simultaneous tabs retain separate writes, including failures with identical forms', async () => {
  const db = new IDBFactory();
  const first = browser({ db, offline: true }), second = browser({ db, offline: true });
  await Promise.allSettled([first.T28Api.rpc('registrarMovimientoWeb', [payload]), second.T28Api.rpc('registrarMovimientoWeb', [payload])]);
  const records = await first.T28Local.listOperations();
  assert.equal(records.length, 2); assert.notEqual(records[0].id, records[1].id);
});

test('concurrent reads share one request; a subsequent refresh fetches current remote data', async () => {
  let count = 0, release;
  const wait = new Promise(resolve => { release = resolve; });
  const client = browser({ fetch: async () => { count++; await wait; return { ok: true, json: async () => ({ ok: true, data: [count] }) }; } });
  const one = client.T28Api.movimientosHoy(), two = client.T28Api.movimientosHoy();
  release(); await Promise.all([one, two]); assert.equal(count, 1);
  await client.T28Api.movimientosHoy(); assert.equal(count, 2);
});

test('administrator credentials are never written to the journal', async () => {
  const client = browser();
  await client.T28Api.guardarUsuarioAdmin({ pin: 'test-only-secret', usuario: 'fake-account' });
  assert.equal((await client.T28Local.listOperations()).length, 0);
});

test('reviewing a pending write preserves a recoverable copy instead of pretending it synchronized', async () => {
  const client = browser({ offline: true });
  await assert.rejects(client.T28Api.rpc('registrarMovimientoWeb', [payload]));
  const record = (await client.T28Local.listOperations())[0];
  await client.T28Local.markReviewed(record.id);
  assert.equal((await client.T28Local.listOperations()).length, 0);
  const reviewed = await client.T28Local.listReviewedOperations();
  assert.equal(reviewed.length, 1);
  assert.equal(reviewed[0].args[0].placa, payload.placa);
  assert.equal(reviewed[0].status, 'reviewed');
});

test('reviewing records requires the original account and endpoint', async () => {
  const client = browser({ offline: true });
  await assert.rejects(client.T28Api.rpc('registrarMovimientoWeb', [payload]));
  const record = (await client.T28Local.listOperations())[0];
  client.T28Local.setOwner('operator-2');
  await client.T28Local.markReviewed(record.id);
  client.T28Local.setOwner('operator-1');
  assert.equal((await client.T28Local.listOperations()).length, 1);
});
