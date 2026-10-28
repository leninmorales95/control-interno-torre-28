const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const operationId = '12345678-1234-4123-8123-123456789abc';
const actor = { id:'operator-1' };
const datos = { placa:'TST123',nombre:'Prueba',empresa:'DEMO',estacionamiento:18,registradoPorId:'p1',horaEntrada:'2026-10-20T10:00:00Z' };
function setup() {
  const tables = { MOVIMIENTOS:[['id'],['existing-id']] };
  let writes = 0, failBefore = false, failAfter = false;
  const sheet = name => ({
    getLastRow: () => tables[name].length,
    getLastColumn: () => tables[name][0].length,
    appendRow(row) { tables[name].push([...row]); },
    getRange(r,c,h=1,w=1) { return {
      getValues: () => tables[name].slice(r-1,r-1+h).map(row => row.slice(c-1,c-1+w)),
      setValues: rows => rows.forEach((row,i) => row.forEach((v,j) => { if(!tables[name][r-1+i]) tables[name][r-1+i]=[]; tables[name][r-1+i][c-1+j]=v; })),
      createTextFinder(value) { return {
        matchEntireCell() { return this; },matchCase() { return this; },useRegularExpression() { return this; },
        findAll: () => tables[name].slice(r-1,r-1+h).flatMap((row,i) => String(row[c-1]) === value ? [{getRow:() => r+i}] : [])
      }; }
    }; }
  });
  const ss = { getSheetByName:name => tables[name] ? sheet(name):null, insertSheet(name) { tables[name]=[]; return sheet(name); } };
  const context = vm.createContext({ SpreadsheetApp:{getActiveSpreadsheet:() => ss,flush() {}},
    Utilities:{getUuid:() => 'generated-record-id'},
    t28MovVersion_:values => crypto.createHash('sha256').update(JSON.stringify(values)).digest('hex'),
    t28MovConBloqueo_:fn => fn(),
    t28MovFechas_:input => { if(!input || isNaN(new Date(input.horaEntrada))) throw Error('invalid date'); },
    t28MovError_:(message,code) => { const err=Error(message);err.t28Code=code;throw err; },
    indiceCabeceraEst_:(headers,aliases) => headers.findIndex(h => aliases.includes(h)),
    t28RegistrarMovimientoSinBloqueo_:input => {
      if(failBefore) throw Error('stopped before append');
      writes++; tables.MOVIMIENTOS.push([input._syncRecordId]);
      if(failAfter) throw Error('response lost');
      return {filaIndex:tables.MOVIMIENTOS.length};
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../BACKEND_APPS_SCRIPT_NUEVO/T28_Sync.gs'),'utf8'),context);
  return { tables,context,get writes(){return writes;},before(){failBefore=true;},after(){failAfter=true;},clear(){failBefore=failAfter=false;} };
}
test('a repeated confirmed operation appends once and acknowledges the same ID', () => {
  const server=setup();const payload={operationId,datos};
  const first=server.context.t28SyncCrearMovimiento_(payload,actor);
  const second=server.context.t28SyncCrearMovimiento_(payload,actor);
  assert.equal(server.writes,1);assert.equal(first.id,second.id);assert.equal(second.replay,true);
});

test('UUID casing changes still resolve the original receipt', () => {
  const server=setup();
  const first=server.context.t28SyncCrearMovimiento_({operationId,datos},actor);
  const replay=server.context.t28SyncCrearMovimiento_({operationId:operationId.toUpperCase(),datos},actor);
  assert.equal(server.writes,1);
  assert.equal(replay.id,first.id);
  assert.equal(replay.operationId,operationId);
  assert.equal(replay.replay,true);
});
test('a lost reply after append recovers from stable record ID without duplicating', () => {
  const server=setup();server.after();const payload={operationId,datos};
  assert.throws(() => server.context.t28SyncCrearMovimiento_(payload,actor),/response lost/);
  server.clear();const result=server.context.t28SyncCrearMovimiento_(payload,actor);
  assert.equal(server.writes,1);assert.equal(result.replay,true);
  assert.equal(server.tables._T28_SYNC_OPERACIONES[1][4],'CONFIRMADO');
});
test('a crash before append is kept as conflict instead of risking a second record', () => {
  const server=setup();server.before();const payload={operationId,datos};
  assert.throws(() => server.context.t28SyncCrearMovimiento_(payload,actor));server.clear();
  assert.throws(() => server.context.t28SyncCrearMovimiento_(payload,actor),err => err.t28Code==='CONFLICT');assert.equal(server.writes,0);
});
test('a confirmed receipt does not recreate a record deleted later from AppSheet', () => {
  const server=setup();const payload={operationId,datos};server.context.t28SyncCrearMovimiento_(payload,actor);
  server.tables.MOVIMIENTOS.pop();server.context.t28SyncCrearMovimiento_(payload,actor);
  assert.equal(server.writes,1);assert.equal(server.tables.MOVIMIENTOS.length,2);
});
test('operation ID cannot be reused for a different payload or account', () => {
  const server=setup();server.context.t28SyncCrearMovimiento_({operationId,datos},actor);
  assert.throws(() => server.context.t28SyncCrearMovimiento_({operationId,datos:{...datos,nombre:'Otra'}},actor),err=>err.t28Code==='OPERATION_MISMATCH');
  assert.throws(() => server.context.t28SyncCrearMovimiento_({operationId,datos},{id:'operator-2'}),err=>err.t28Code==='OPERATION_MISMATCH');
  assert.equal(server.writes,1);
});
test('untrusted record ID is ignored and sessions and UUIDs are validated', () => {
  const server=setup();
  assert.throws(() => server.context.t28SyncCrearMovimiento_({operationId:'invalid',datos},actor));
  assert.throws(() => server.context.t28SyncCrearMovimiento_({operationId,datos},{}));
  const result=server.context.t28SyncCrearMovimiento_({operationId,datos:{...datos,_syncRecordId:'existing-id'}},actor);
  assert.equal(result.id,'generated-record-id');
});
