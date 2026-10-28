/** Conservative exit receipts. Not enabled in HTTP or client until tested.
 * A PREPARADO receipt is ambiguous after a crash: never repeat its mutation.
 * This intentionally requires review rather than inferring success from a row
 * that AppSheet or another user could have changed in the meantime.
 */
function t28SyncSalidaMovimiento_(payload, usuario) {
  return t28SyncCambioMovimiento_(payload, usuario, 'salida');
}

function t28SyncEditarMovimiento_(payload, usuario) {
  return t28SyncCambioMovimiento_(payload, usuario, 'editar');
}

function t28SyncEliminarMovimiento_(payload, usuario) {
  return t28SyncCambioMovimiento_(payload, usuario, 'eliminar');
}

function t28SyncCambioMovimiento_(payload, usuario, tipo) {
  const operationId=String(payload&&payload.operationId||'').toLowerCase();
  const actor=String(usuario&&(usuario.id||usuario.usuario)||'');
  if(!actor)t28MovError_('Sesión requerida.','AUTH_REQUIRED');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(operationId))t28MovError_('Identificador inválido.','INVALID_OPERATION');
  const datos=payload.datos||{};
  const salida=new Date(datos.horaSalida);
  if(!datos.id||!datos._expectedVersion)t28MovError_('Actualiza el movimiento antes de registrar su salida.','CONFLICT');
  const editar=tipo==='editar';
  const eliminar=tipo==='eliminar';
  if(!editar&&!eliminar&&isNaN(salida.getTime()))t28MovError_('La hora de salida no es válida.','INVALID_OPERATION');
  const safe={id:String(datos.id),filaIndex:datos.filaIndex,_expectedVersion:String(datos._expectedVersion)};
  if(editar){
    t28MovFechas_(datos);
    if(!datos.placa||!datos.nombre||!datos.empresa||!datos.estacionamiento||!datos.registradoPorId)t28MovError_('Faltan datos obligatorios.','INVALID_OPERATION');
    const fields=['placa','nombre','empresa','estacionamiento','registradoPorId','registradoPorNombre','horaEntrada','horaSalida','tipoIngreso','tipoDocumento','numeroDocumento','tipoEstacionamiento','observaciones','permitirEstacionamientoOcupado'];
    fields.forEach(function(key){if(datos[key]!==undefined)safe[key]=datos[key];});
    safe.acompanantes=Array.isArray(datos.acompanantes)?datos.acompanantes.map(function(persona){return {nombre:persona&&persona.nombre||'',tipoDocumento:persona&&persona.tipoDocumento||'',documento:persona&&persona.documento||''};}):[];
    if(safe.acompanantes.length>3||safe.acompanantes.some(function(persona){return !String(persona.nombre).trim();}))t28MovError_('Revisa los acompañantes.','INVALID_OPERATION');
  }else if(!eliminar)safe.horaSalida=salida.toISOString();
  // filaIndex is only a locator hint; stable record ID determines the target.
  const digestData=Object.assign({},safe);delete digestData.filaIndex;
  const digest=editar||eliminar?t28MovVersion_([tipo,JSON.stringify(digestData)]):t28MovVersion_([safe.id,safe._expectedVersion,safe.horaSalida]);
  return t28MovConBloqueo_(function(){
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    const movimientos=ss.getSheetByName('MOVIMIENTOS');
    if(!movimientos)t28MovError_('No se encontró MOVIMIENTOS.');
    const columns=['OPERATION_ID','USUARIO','HASH','RECORD_ID','ESTADO','CREADO','CONFIRMADO'];
    const receiptSheet=eliminar?'_T28_SYNC_ELIMINACIONES':editar?'_T28_SYNC_EDICIONES':'_T28_SYNC_SALIDAS';
    let receipts=ss.getSheetByName(receiptSheet);
    if(receipts&&JSON.stringify(receipts.getRange(1,1,1,columns.length).getValues()[0])!==JSON.stringify(columns))t28MovError_('Registro de salidas incompatible.','SYNC_NOT_READY');
    const matches=!receipts||receipts.getLastRow()<2?[]:receipts.getRange(2,1,receipts.getLastRow()-1,1)
      .createTextFinder(operationId).matchEntireCell(true).matchCase(true).useRegularExpression(false).findAll();
    if(matches.length>1)t28MovError_('Operación duplicada; requiere revisión.','CONFLICT');
    if(matches.length){
      const receipt=receipts.getRange(matches[0].getRow(),1,1,columns.length).getValues()[0];
      if(receipt[1]!==actor||receipt[2]!==digest)t28MovError_('El identificador corresponde a otra operación.','OPERATION_MISMATCH');
      if(receipt[4]==='CONFIRMADO')return {success:true,operationId:operationId,id:receipt[3],replay:true};
      t28MovError_('El intento anterior requiere revisión; no se repitió la salida.','CONFLICT');
    }
    const ver=validarMovimientoExacto_(movimientos,safe.filaIndex,safe.id,safe._expectedVersion);
    const cEntrada=indiceCabeceraEst_(ver.headers,['horaentrada','hora entrada']);
    const cSalida=indiceCabeceraEst_(ver.headers,['horasalida','hora salida']);
    const cEstado=indiceCabeceraEst_(ver.headers,['estado']);
    if(!eliminar&&(cEntrada<0||cSalida<0||cEstado<0))t28MovError_('Faltan columnas de fecha o estado.','SYNC_NOT_READY');
    const entrada=new Date(ver.valores[cEntrada]);
    if(!editar&&!eliminar&&(isNaN(entrada.getTime())||salida<entrada))t28MovError_('La salida no puede ser anterior al ingreso.','INVALID_OPERATION');
    if(!receipts){receipts=ss.insertSheet(receiptSheet);receipts.getRange(1,1,1,columns.length).setValues([columns]);}
    const creado=new Date();
    receipts.appendRow([operationId,actor,digest,safe.id,'PREPARADO',creado,'']);
    const receiptRow=receipts.getLastRow();SpreadsheetApp.flush();
    if(eliminar){
      // Re-resolve ID and version immediately before deleting. Never trust a
      // persisted row index: another client may have moved or replaced it.
      const actual=validarMovimientoExacto_(movimientos,safe.filaIndex,safe.id,safe._expectedVersion);
      movimientos.deleteRow(actual.fila);
    }else if(editar)t28ActualizarMovimientoSinBloqueo_(safe);
    else t28RegistrarSalidaSinBloqueo_(safe);
    SpreadsheetApp.flush();
    receipts.getRange(receiptRow,5,1,3).setValues([['CONFIRMADO',creado,new Date()]]);
    return {success:true,operationId:operationId,id:safe.id,replay:false};
  });
}
