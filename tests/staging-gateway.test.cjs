const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../scripts/T28_Staging_Gateway.gs.txt'),'utf8'),context);
test('staging gateway accepts only isolated authentication and receipt endpoints',()=>{
  for(const action of ['auth.login','auth.validar','auth.logout','sync.capabilities','sync.movimientos.crear','sync.movimientos.salida','sync.movimientos.editar','inicio.movimientosHoy']) {
    assert.doesNotThrow(()=>context.t28StagingExigirRuta_({action}));
  }
});
test('staging gateway blocks Telegram, arbitrary RPC and inherited administration',()=>{
  for(const body of [null,{}, {action:'rpc',payload:{method:'guardarAvisoWebT28'}},
    {action:'admin.usuarios.guardar'}, {action:'inicio.estacionamientos'},
    {action:'sync.capabilities',update_id:1}, {action:'sync.capabilities',message:{text:'x'}}]) {
    assert.throws(()=>context.t28StagingExigirRuta_(body),error=>error.t28Code==='STAGING_ROUTE_DISABLED');
  }
});
