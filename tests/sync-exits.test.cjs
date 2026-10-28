const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const operationId='12345678-1234-4123-8123-123456789abc';
const data=()=>({operationId,datos:{id:'record-1',filaIndex:2,_expectedVersion:'version-1',horaSalida:'2026-10-22T15:00:00Z'}});
function server(){
 const tables={MOVIMIENTOS:[['id']]};let writes=0,version='version-1',failAfter=false;
 const sheet=name=>({deleteRow:()=>{writes++;version='deleted';if(failAfter)throw Error('crash after mutation');},getLastRow:()=>tables[name].length,getRange(r,c,h=1,w=1){return {
  getValues:()=>tables[name].slice(r-1,r-1+h).map(row=>row.slice(c-1,c-1+w)),
  setValues:rows=>rows.forEach((row,i)=>row.forEach((value,j)=>{if(!tables[name][r-1+i])tables[name][r-1+i]=[];tables[name][r-1+i][c-1+j]=value;})),
  createTextFinder:value=>({matchEntireCell(){return this;},matchCase(){return this;},useRegularExpression(){return this;},findAll:()=>tables[name].slice(r-1,r-1+h).flatMap((row,i)=>row[c-1]===value?[{getRow:()=>r+i}]:[])})
 };},appendRow:row=>tables[name].push([...row])});
 const context=vm.createContext({SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:name=>tables[name]?sheet(name):null,insertSheet:name=>{tables[name]=[];return sheet(name);}}),flush(){}},
  t28MovError_:(message,code)=>{const error=Error(message);error.t28Code=code;throw error;},
  t28MovVersion_:value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),
  t28MovConBloqueo_:fn=>fn(),
  indiceCabeceraEst_:(headers,aliases)=>headers.findIndex(h=>aliases.includes(h)),
  validarMovimientoExacto_:(sheet,row,id,expected)=>{if(id!=='record-1'||expected!==version){const error=Error('changed');error.t28Code='CONFLICT';throw error;}return {headers:['horaentrada','horasalida','estado'],valores:['2026-10-22T10:00:00Z','','Abierto']};},
  t28MovFechas_:datos=>{if(isNaN(new Date(datos.horaEntrada)))throw Error('invalid date');},
  t28ActualizarMovimientoSinBloqueo_:()=>{writes++;version='version-2';if(failAfter)throw Error('crash after mutation');},
  t28RegistrarSalidaSinBloqueo_:()=>{writes++;version='version-2';if(failAfter)throw Error('crash after mutation');}
 });vm.runInContext(fs.readFileSync(path.join(__dirname,'../BACKEND_APPS_SCRIPT_NUEVO/T28_Sync_Salidas.gs'),'utf8'),context);
 return {remove:(payload=data(),actor={id:'user-1'})=>context.t28SyncEliminarMovimiento_(payload,actor),edit:(payload,actor={id:'user-1'})=>context.t28SyncEditarMovimiento_(payload,actor),call:(payload=data(),actor={id:'user-1'})=>context.t28SyncSalidaMovimiento_(payload,actor),get writes(){return writes;},tables,change(){version='remote';},crash(){failAfter=true;}};
}

test('confirmed deletion acknowledges original receipt without deleting another row',()=>{
 const api=server();const first=api.remove();api.change();const replay=api.remove();
 assert.equal(api.writes,1);assert.equal(replay.replay,true);assert.equal(replay.id,first.id);
 assert.equal(api.tables._T28_SYNC_ELIMINACIONES[1][4],'CONFIRMADO');
});

test('deletion rejects changed versions and missing identity before preparing a receipt',()=>{
 const api=server();api.change();assert.throws(()=>api.remove(),e=>e.t28Code==='CONFLICT');
 assert.equal(api.writes,0);assert.equal(api.tables._T28_SYNC_ELIMINACIONES,undefined);
 const missing=server(),payload=data();payload.datos.id='';assert.throws(()=>missing.remove(payload));assert.equal(missing.writes,0);
});

test('an interrupted deletion is kept for review and never repeated',()=>{
 const api=server();api.crash();assert.throws(()=>api.remove(),/crash/);
 assert.throws(()=>api.remove(),e=>e.t28Code==='CONFLICT');assert.equal(api.writes,1);
});

test('deletion receipt cannot be reused for another account or movement',()=>{
 const api=server();api.remove();assert.throws(()=>api.remove(data(),{id:'other'}),e=>e.t28Code==='OPERATION_MISMATCH');
 const changed=data();changed.datos.id='other-record';assert.throws(()=>api.remove(changed),e=>e.t28Code==='OPERATION_MISMATCH');assert.equal(api.writes,1);
});
test('confirmed exit retry returns same receipt without mutating a newer row',()=>{
 const api=server();const first=api.call();api.change();const replay=api.call();
 assert.equal(api.writes,1);assert.equal(replay.replay,true);assert.equal(replay.id,first.id);
});
test('exit conflict before preparation does not write a receipt or mutation',()=>{
 const api=server();api.change();assert.throws(()=>api.call(),error=>error.t28Code==='CONFLICT');
 assert.equal(api.writes,0);assert.equal(api.tables._T28_SYNC_SALIDAS,undefined);
});
test('ambiguous crash after exit is never automatically applied again',()=>{
 const api=server();api.crash();assert.throws(()=>api.call(),/crash/);
 assert.throws(()=>api.call(),error=>error.t28Code==='CONFLICT');assert.equal(api.writes,1);
});
test('same exit operation cannot be reassigned to another actor or timestamp',()=>{
 const api=server();api.call();assert.throws(()=>api.call(data(),{id:'other'}),error=>error.t28Code==='OPERATION_MISMATCH');
 const altered=data();altered.datos.horaSalida='2026-10-22T16:00:00Z';assert.throws(()=>api.call(altered),error=>error.t28Code==='OPERATION_MISMATCH');assert.equal(api.writes,1);
});
test('exit requires stable ID and version and validates chronology before receipts',()=>{
 for(const change of [{id:''},{_expectedVersion:''},{horaSalida:'invalid'},{horaSalida:'2026-10-22T08:00:00Z'}]){
  const api=server(),payload=data();Object.assign(payload.datos,change);assert.throws(()=>api.call(payload));assert.equal(api.writes,0);assert.equal(api.tables._T28_SYNC_SALIDAS,undefined);
 }
});

const editData=()=>({operationId,datos:{id:'record-1',filaIndex:2,_expectedVersion:'version-1',placa:'TST123',nombre:'Prueba',empresa:'DEMO',estacionamiento:18,registradoPorId:'test',horaEntrada:'2026-10-22T10:00:00Z',horaSalida:'',observaciones:'Editada'}});
test('edit receipt acknowledges original operation without overwriting a later edit',()=>{
 const api=server();const payload=editData();api.edit(payload);api.change();const replay=api.edit(payload);
 assert.equal(api.writes,1);assert.equal(replay.replay,true);assert.equal(replay.id,'record-1');
 assert.equal(api.tables._T28_SYNC_EDICIONES[1][4],'CONFIRMADO');
});
test('edit rejects stale versions and malformed fields before preparing receipts',()=>{
 const api=server();api.change();assert.throws(()=>api.edit(editData()),error=>error.t28Code==='CONFLICT');assert.equal(api.writes,0);
 assert.equal(api.tables._T28_SYNC_EDICIONES,undefined);
 const invalid=server(),payload=editData();payload.datos.acompanantes=[{nombre:''}];assert.throws(()=>invalid.edit(payload));assert.equal(invalid.writes,0);
});
test('ambiguous interrupted edit is retained as conflict, never reapplied',()=>{
 const api=server();api.crash();assert.throws(()=>api.edit(editData()),/crash/);
 assert.throws(()=>api.edit(editData()),error=>error.t28Code==='CONFLICT');assert.equal(api.writes,1);
});
test('edit operation ID cannot be reused with changed observations',()=>{
 const api=server();api.edit(editData());const changed=editData();changed.datos.observaciones='Otra';
 assert.throws(()=>api.edit(changed),error=>error.t28Code==='OPERATION_MISMATCH');assert.equal(api.writes,1);
});
