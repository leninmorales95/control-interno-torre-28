/** Durable receipts for movement creation. Wire only through the authenticated
 * API: t28ApiExigirPermiso_(usuario, 'crear') then t28SyncCrearMovimiento_(payload, usuario).
 * No public RPC dispatch or client-side enablement until integration tests pass.
 * New metadata lives in its own sheet; existing AppSheet columns stay intact.
 */
function t28SyncCrearMovimiento_(payload, usuario) {
  // UUID text is case-insensitive. Canonicalize before exact receipt lookup so
  // casing changes cannot turn a retry into a second insertion.
  const operationId = String(payload && payload.operationId || '').toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
    t28MovError_('La operación no tiene un identificador válido.', 'INVALID_OPERATION');
  }
  const actor = String(usuario && (usuario.id || usuario.usuario) || '');
  if (!actor) t28MovError_('Sesión requerida.', 'AUTH_REQUIRED');
  const datos = payload.datos;
  t28MovFechas_(datos);
  if (!datos || !datos.placa || !datos.nombre || !datos.empresa || !datos.estacionamiento || !datos.registradoPorId) {
    t28MovError_('Faltan datos obligatorios para registrar el ingreso.');
  }
  // Ignore unknown client fields, including attempts to inject another record ID.
  const fields = ['tipoIngreso','placa','nombre','tipoDocumento','numeroDocumento','acompanantes',
    'empresa','tipoEstacionamiento','estacionamiento','observaciones','horaEntrada','horaSalida',
    'registradoPorId','registradoPorNombre','permitirEstacionamientoOcupado'];
  const safe = {};
  fields.forEach(function(key) { if (datos[key] !== undefined) safe[key] = datos[key]; });
  const digest = t28MovVersion_([JSON.stringify(safe)]);
  return t28MovConBloqueo_(function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const movimientos = ss && ss.getSheetByName('MOVIMIENTOS');
    if (!movimientos) t28MovError_('No se encontró MOVIMIENTOS.');
    const headers = movimientos.getRange(1,1,1,movimientos.getLastColumn()).getValues()[0];
    const cId = indiceCabeceraEst_(headers, ['id']);
    if (cId < 0) t28MovError_('MOVIMIENTOS necesita una columna ID estable.', 'SYNC_NOT_READY');
    let receipts = ss.getSheetByName('_T28_SYNC_OPERACIONES');
    const columns = ['OPERATION_ID','USUARIO','HASH','RECORD_ID','ESTADO','CREADO','CONFIRMADO'];
    if (!receipts) {
      receipts = ss.insertSheet('_T28_SYNC_OPERACIONES');
      receipts.getRange(1,1,1,columns.length).setValues([columns]);
    }
    if (JSON.stringify(receipts.getRange(1,1,1,columns.length).getValues()[0]) !== JSON.stringify(columns)) {
      t28MovError_('La estructura del registro de sincronización no coincide.', 'SYNC_NOT_READY');
    }
    const matches = receipts.getLastRow() < 2 ? [] : receipts.getRange(2,1,receipts.getLastRow()-1,1)
      .createTextFinder(operationId).matchEntireCell(true).matchCase(true).useRegularExpression(false).findAll();
    if (matches.length > 1) t28MovError_('La operación tiene confirmaciones duplicadas. Requiere revisión.', 'CONFLICT');
    let receiptRow, receipt;
    if (matches.length) {
      receiptRow = matches[0].getRow();
      receipt = receipts.getRange(receiptRow,1,1,columns.length).getValues()[0];
      if (receipt[1] !== actor || receipt[2] !== digest) {
        t28MovError_('Este identificador ya corresponde a otra operación.', 'OPERATION_MISMATCH');
      }
      // A completed receipt remains authoritative even after a later deletion.
      // Retrying must never recreate a record somebody deliberately removed.
      if (receipt[4] === 'CONFIRMADO') return { success:true, operationId:operationId, id:receipt[3], replay:true };
      const records = movimientos.getLastRow() < 2 ? [] : movimientos.getRange(2,cId+1,movimientos.getLastRow()-1,1)
        .createTextFinder(String(receipt[3])).matchEntireCell(true).matchCase(true).useRegularExpression(false).findAll();
      if (records.length === 1) {
        receipts.getRange(receiptRow,5,1,3).setValues([['CONFIRMADO',receipt[5],new Date()]]);
        return { success:true, operationId:operationId, id:receipt[3], filaIndex:records[0].getRow(), replay:true };
      }
      // A process could have stopped before the append, or the appended record
      // could have been deleted by AppSheet before receipt completion. Ambiguous
      // means conflict, never an automatic second append.
      t28MovError_('El intento anterior requiere revisión; no se ha repetido el ingreso.', 'CONFLICT');
    }
    receipt = [operationId,actor,digest,Utilities.getUuid(),'PREPARADO',new Date(),''];
    receipts.appendRow(receipt);
    receiptRow = receipts.getLastRow();
    SpreadsheetApp.flush();
    safe._syncRecordId = receipt[3];
    const result = t28RegistrarMovimientoSinBloqueo_(safe);
    SpreadsheetApp.flush();
    receipts.getRange(receiptRow,5,1,3).setValues([['CONFIRMADO',receipt[5],new Date()]]);
    return { success:true, operationId:operationId, id:receipt[3], filaIndex:result.filaIndex, replay:false };
  });
}
