const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const headers = ['id','PlacaIngreso','NombresPrincipal','HoraEntrada','HoraSalida','Empresa','Estacionamiento','TipoIngreso','Observaciones','Estado','RegistradoPor','RegistradoPorNombre','CantidadAcompanantes','Formula'];
const original = () => ['id-1','ABC 123','Persona original',new Date('2026-10-20T08:00:00Z'),'','EMPRESA',18,'Trabajador','Anterior','Abierto','p1','Operador',0,'=A2'];
function setup(rows = [headers, original()]) {
  let writes = 0, held = false, allowLock = true;
  const sheet = {
    getLastRow: () => rows.length, getLastColumn: () => headers.length,
    getRange(row, col, height = 1, width = 1) {
      if (row < 1 || col < 1 || row + height - 1 > rows.length) throw Error('invalid range');
      const values = () => rows.slice(row - 1, row - 1 + height).map(r => r.slice(col - 1, col - 1 + width));
      return {
        getValues: values,
        getDisplayValues: () => values().map(r => r.map(v => v instanceof Date ? v.toISOString() : String(v))),
        getDisplayValue: () => String(rows[row - 1][col - 1]),
        getFormulas: () => values().map(r => r.map(v => typeof v === 'string' && v.startsWith('=') ? v : '')),
        setValues(input) { writes++; input.forEach((r, i) => r.forEach((v, j) => { rows[row - 1 + i][col - 1 + j] = v; })); },
        setNumberFormat() { return this; },
        createTextFinder(value) { return { matchEntireCell() { return this; }, matchCase() { return this; }, useRegularExpression() { return this; }, findAll: () => rows.slice(row - 1, row - 1 + height).flatMap((r, i) => String(r[col - 1]) === value ? [{ getRow: () => row + i }] : []) }; }
      };
    },
    deleteRow(row) { writes++; rows.splice(row - 1, 1); }
  };
  const context = vm.createContext({ SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (!allowLock || held) return false; held = true; return true; }, releaseLock: () => { held = false; } }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (algorithm, value) => crypto.createHash(algorithm).update(value).digest(), base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url') },
    indiceCabeceraEst_: (list, aliases) => list.findIndex(h => aliases.some(alias => h.toLowerCase() === alias.toLowerCase())),
    normalizarPlacaT28_: value => value,
    validarEstacionamientoDisponibleHoyWeb: () => ({ ocupado: false }),
    t28RegistrarMovimientoSinBloqueo_: () => ({ success: true })
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../BACKEND_APPS_SCRIPT_NUEVO/T28_Movimientos.gs'), 'utf8'), context);
  context.validarEstacionamientoDisponibleHoyWeb = () => ({ ocupado: false });
  return { context, rows, sheet, get writes() { return writes; }, get held() { return held; }, denyLock() { allowLock = false; } };
}
const update = () => ({ filaIndex: 2, id: 'id-1', placa: 'XYZ 789', nombre: 'Editado', empresa: 'EMPRESA', estacionamiento: 18,
  tipoIngreso: 'Trabajador', registradoPorId: 'p1', registradoPorNombre: 'Operador', horaEntrada: '2026-10-20T08:00:00Z', horaSalida: '', observaciones: 'Nueva' });

test('an invalid exit date never partially edits the movement', () => {
  const server = setup(); const data = update(); data.horaSalida = 'not-a-date';
  assert.throws(() => server.context.actualizarMovimientoWeb(data), /salida no es válida/);
  assert.equal(server.writes, 0); assert.equal(server.rows[1][2], 'Persona original');
});
test('an exit before entry never writes any fields', () => {
  const server = setup(); const data = update(); data.horaSalida = '2026-10-20T07:00:00Z';
  assert.throws(() => server.context.actualizarMovimientoWeb(data), /anterior/); assert.equal(server.writes, 0);
});
test('valid updates use one row write, preserve IDs and unrelated formulas, and release the lock', () => {
  const server = setup(); server.context.actualizarMovimientoWeb(update());
  assert.equal(server.writes, 1); assert.equal(server.rows[1][0], 'id-1');
  assert.equal(server.rows[1][2], 'Editado'); assert.equal(server.rows[1][13], '=A2'); assert.equal(server.held, false);
});
test('a remote AppSheet change after reading causes a conflict and no write', () => {
  const server = setup(); const data = update();
  data._expectedVersion = server.context.t28MovVersion_(server.sheet.getRange(2, 1, 1, headers.length).getDisplayValues()[0]);
  server.rows[1][8] = 'Editado desde AppSheet';
  assert.throws(() => server.context.actualizarMovimientoWeb(data), error => error.t28Code === 'CONFLICT');
  assert.equal(server.writes, 0); assert.equal(server.held, false);
});
test('a moved record is located by ID instead of editing the new occupant of its old row', () => {
  const other = original(); other[0] = 'id-2';
  const server = setup([headers, other, original()]); server.context.actualizarMovimientoWeb(update());
  assert.equal(server.rows[1][2], 'Persona original'); assert.equal(server.rows[2][2], 'Editado');
});
test('a removed ID never falls back to deleting an unrelated row', () => {
  const server = setup();
  assert.throws(() => server.context.eliminarMovimientoWeb({ filaIndex: 2, id: 'removed' }), error => error.t28Code === 'CONFLICT');
  assert.equal(server.writes, 0); assert.equal(server.rows.length, 2);
});
test('a competing web write returns BUSY instead of writing without the lock', () => {
  const server = setup(); server.denyLock();
  assert.throws(() => server.context.actualizarMovimientoWeb(update()), error => error.t28Code === 'BUSY');
  assert.equal(server.writes, 0);
});
test('exit date validation happens before writing either state or exit time', () => {
  const server = setup();
  assert.throws(() => server.context.registrarSalidaMovimientoWeb({ filaIndex: 2, id: 'id-1', horaSalida: '2026-10-20T07:00:00Z' }), /anterior/);
  assert.equal(server.writes, 0); assert.equal(server.rows[1][9], 'Abierto');
});

test('receipt-backed deletion uses actual ID lookup after row movement and replay never deletes again',()=>{
 const other=original();other[0]='id-2';
 const server=setup([headers,other,original()]);let receiptRows;
 const receiptSheet={getLastRow:()=>receiptRows.length,appendRow:row=>receiptRows.push([...row]),getRange(r,c,h=1,w=1){return {
  getValues:()=>receiptRows.slice(r-1,r-1+h).map(row=>row.slice(c-1,c-1+w)),
  setValues:input=>input.forEach((row,i)=>row.forEach((value,j)=>{if(!receiptRows[r-1+i])receiptRows[r-1+i]=[];receiptRows[r-1+i][c-1+j]=value;})),
  createTextFinder:value=>({matchEntireCell(){return this;},matchCase(){return this;},useRegularExpression(){return this;},findAll:()=>receiptRows.slice(r-1,r-1+h).flatMap((row,i)=>row[c-1]===value?[{getRow:()=>r+i}]:[])})
 };}};
 server.context.SpreadsheetApp={flush(){},getActiveSpreadsheet:()=>({
  getSheetByName:name=>name==='MOVIMIENTOS'?server.sheet:receiptRows?receiptSheet:null,
  insertSheet:()=>{receiptRows=[];return receiptSheet;}
 })};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../BACKEND_APPS_SCRIPT_NUEVO/T28_Sync_Salidas.gs'),'utf8'),server.context);
 const version=server.context.t28MovVersion_(server.sheet.getRange(3,1,1,headers.length).getDisplayValues()[0]);
 const payload={operationId:'12345678-1234-4123-8123-123456789abc',datos:{id:'id-1',filaIndex:2,_expectedVersion:version}};
 server.context.t28SyncEliminarMovimiento_(payload,{id:'operator'});
 assert.equal(server.rows.length,2);assert.equal(server.rows[1][0],'id-2');assert.equal(server.writes,1);assert.equal(server.held,false);
 const reply=server.context.t28SyncEliminarMovimiento_(payload,{id:'operator'});
 assert.equal(reply.replay,true);assert.equal(server.writes,1);assert.equal(server.rows[1][0],'id-2');
});
