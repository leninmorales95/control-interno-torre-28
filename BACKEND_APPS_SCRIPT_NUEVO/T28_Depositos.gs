/** Datos de depósitos usados por la distribución visual de sótanos. */
function obtenerDepositosPlanoT28() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DEPOSITOS');
  if (!sh) throw new Error('No existe la hoja "DEPOSITOS".');
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const values = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const headers = values[0].map(function(h) { return String(h || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); });
  function col(names) { for (var i = 0; i < names.length; i++) { var idx = headers.indexOf(names[i]); if (idx >= 0) return idx; } return -1; }
  const cUbicacion = col(['ubicacion', 'sotano', 'nivel']);
  const cEst = col(['estacionamiento', 'est', 'puesto']);
  const cEmpresa = col(['empresa']);
  const cObs = col(['observacion', 'observaciones', 'notas']);
  const cTipo = col(['tipo', 'categoria', 'clase']);
  return values.slice(1).map(function(row, i) { return { filaIndex:i+2, ubicacion:cUbicacion>=0?String(row[cUbicacion]||'').trim():'', estacionamiento:cEst>=0?String(row[cEst]||'').trim():'', empresa:cEmpresa>=0?String(row[cEmpresa]||'').trim():'', observacion:cObs>=0?String(row[cObs]||'').trim():'', tipo:cTipo>=0?String(row[cTipo]||'').trim():'deposito' }; }).filter(function(x) { return x.ubicacion || x.estacionamiento || x.empresa; });
}
