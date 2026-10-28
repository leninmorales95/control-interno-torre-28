const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function server(role='operador',permissions=['crear']) {
  let writes=0;
  const context=vm.createContext({
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})},
    validarSesionT28:token=>token==='valid' ? {ok:true,usuario:{id:'operator',rol:role,permisos:permissions}} : {ok:false},
    t28AuthNorm_:value=>String(value||'').toLowerCase(),
    t28PermisosPorRol_:()=>[],
    t28SyncCrearMovimiento_:(payload,user)=>{writes++;return {success:true,operationId:payload.operationId,id:user.id};},
    t28SyncSalidaMovimiento_:(payload,user)=>{writes++;return {success:true,operationId:payload.operationId,id:user.id};},
    t28SyncEditarMovimiento_:(payload,user)=>{writes++;return {success:true,operationId:payload.operationId,id:user.id};},
    t28SyncEliminarMovimiento_:(payload,user)=>{writes++;return {success:true,operationId:payload.operationId,id:user.id};}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../BACKEND_APPS_SCRIPT_NUEVO/T28_API_Actual.gs'),'utf8'),context);
  return {call:body=>JSON.parse(context.t28ApiProcesarPost_(body).text),get writes(){return writes;}};
}
test('sync routes require a valid session before capabilities or writes',()=>{
  const api=server();
  for(const action of ['sync.capabilities','sync.movimientos.crear','sync.movimientos.salida','sync.movimientos.editar','sync.movimientos.eliminar']) {
    assert.equal(api.call({action}).code,'AUTH_REQUIRED');
    assert.equal(api.call({action,token:'expired'}).code,'AUTH_EXPIRED');
  }
  assert.equal(api.writes,0);
});
test('creation permission is enforced before the sync helper',()=>{
  const api=server('operador',['editar']);
  assert.equal(api.call({action:'sync.movimientos.crear',token:'valid',payload:{}}).code,'PERMISSION_DENIED');
  assert.equal(api.writes,0);
});
test('authenticated sync request receives the server-side actor',()=>{
  const api=server();
  const result=api.call({action:'sync.movimientos.crear',token:'valid',payload:{operationId:'test',usuario:{id:'forged'}}});
  assert.equal(result.data.id,'operator');assert.equal(api.writes,1);
  assert.deepEqual(api.call({action:'sync.capabilities',token:'valid'}).data,{protocol:1,methods:['movimientos.crear','movimientos.salida','movimientos.editar','movimientos.eliminar']});
});

test('exit sync requires edit permission, not just create permission',()=>{
 const creator=server('operador',['crear']);
 assert.equal(creator.call({action:'sync.movimientos.salida',token:'valid',payload:{}}).code,'PERMISSION_DENIED');assert.equal(creator.writes,0);
 const editor=server('operador',['editar']);
 assert.equal(editor.call({action:'sync.movimientos.salida',token:'valid',payload:{operationId:'exit'}}).data.id,'operator');assert.equal(editor.writes,1);
});

test('edit receipt route enforces editing permission before mutation',()=>{
 const creator=server('operador',['crear']);
 assert.equal(creator.call({action:'sync.movimientos.editar',token:'valid',payload:{}}).code,'PERMISSION_DENIED');assert.equal(creator.writes,0);
 const editor=server('operador',['editar']);
 assert.equal(editor.call({action:'sync.movimientos.editar',token:'valid',payload:{operationId:'edit'}}).data.id,'operator');assert.equal(editor.writes,1);
});

test('deletion requires its own permission and uses the authenticated account',()=>{
 const editor=server('operador',['crear','editar']);
 assert.equal(editor.call({action:'sync.movimientos.eliminar',token:'valid',payload:{}}).code,'PERMISSION_DENIED');assert.equal(editor.writes,0);
 const remover=server('operador',['eliminar']);
 assert.equal(remover.call({action:'sync.movimientos.eliminar',token:'valid',payload:{operationId:'delete',usuario:{id:'forged'}}}).data.id,'operator');assert.equal(remover.writes,1);
});
