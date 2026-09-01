/** Enriquece estacionamientos con TIPO_VEHICULO de la hoja VEHICULOS. */
function obtenerDatosEstacionamientosConTipoT28() {
  var datos = obtenerDatosEstacionamientos();
  if (!Array.isArray(datos) || !datos.length) return datos || [];
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VEHICULOS');
  if (!sh || sh.getLastRow() < 2) return datos;

  var valores = sh.getDataRange().getDisplayValues();
  var normalizar = function(v) {
    return String(v || '').trim().toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '');
  };
  var encabezados = valores[0].map(normalizar);
  var indice = function() {
    for (var i = 0; i < arguments.length; i++) {
      var pos = encabezados.indexOf(normalizar(arguments[i]));
      if (pos >= 0) return pos;
    }
    return -1;
  };
  var iEst = indice('ESTACIONAMIENTO');
  var iUsuario = indice('USUARIO');
  var iPlaca = indice('PLACA');
  var iEmpresa = indice('EMPRESA');
  var iTipo = indice('TIPO_VEHICULO', 'TIPO VEHICULO');
  if (iTipo < 0) return datos;

  var tipos = {};
  valores.slice(1).forEach(function(row) {
    var tipo = String(row[iTipo] || '').trim();
    if (!tipo) return;
    var clave = [
      iEst >= 0 ? row[iEst] : '', iEmpresa >= 0 ? row[iEmpresa] : '',
      iUsuario >= 0 ? row[iUsuario] : '', iPlaca >= 0 ? row[iPlaca] : ''
    ].map(normalizar).join('|');
    tipos[clave] = tipo;
    if (iPlaca >= 0 && normalizar(row[iPlaca])) tipos['PLACA|' + normalizar(row[iPlaca])] = tipo;
  });

  datos.forEach(function(item) {
    (item.ocupantes || []).forEach(function(oc) {
      var clave = [item.est, item.empresa, oc.usuario, oc.placa].map(normalizar).join('|');
      oc.tipoVehiculo = tipos[clave] || tipos['PLACA|' + normalizar(oc.placa)] || oc.tipoVehiculo || '';
    });
  });
  return datos;
}

/** Guarda los campos habituales y luego actualiza TIPO_VEHICULO. */
function actualizarEstacionamientoConTipoT28(datos) {
  datos = datos || {};
  var resultado = actualizarEstacionamiento(datos);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VEHICULOS');
  if (!sh || sh.getLastRow() < 2) return resultado;

  var valores = sh.getDataRange().getDisplayValues();
  var norm = function(v) {
    return String(v || '').trim().toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '');
  };
  var encabezados = valores[0].map(norm);
  var iTipo = encabezados.indexOf(norm('TIPO_VEHICULO'));
  var iPlaca = encabezados.indexOf(norm('PLACA'));
  var iUsuario = encabezados.indexOf(norm('USUARIO'));
  if (iTipo < 0) throw new Error('No existe la columna TIPO_VEHICULO en VEHICULOS.');

  var fila = Number(datos.filaIndex || 0);
  if (fila < 2 || fila > sh.getLastRow()) {
    for (var i = 1; i < valores.length; i++) {
      var coincidePlaca = iPlaca >= 0 && norm(valores[i][iPlaca]) === norm(datos.placa);
      var coincideUsuario = iUsuario >= 0 && norm(valores[i][iUsuario]) === norm(datos.usuario);
      if (coincidePlaca || (!datos.placa && coincideUsuario)) { fila = i + 1; break; }
    }
  }
  if (fila >= 2) sh.getRange(fila, iTipo + 1).setValue(String(datos.tipoVehiculo || '').trim());
  return resultado;
}

/** Registra un trabajador fijo y completa TIPO_VEHICULO en la nueva fila. */
function agregarEstacionamientoConTipoT28(datos) {
  datos = datos || {};
  var resultado = agregarEstacionamiento(datos);
  var tipo = String(datos.tipoVehiculo || '').trim();
  if (!tipo) return resultado;

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VEHICULOS');
  if (!sh || sh.getLastRow() < 2) return resultado;
  var valores = sh.getDataRange().getDisplayValues();
  var norm = function(v) {
    return String(v || '').trim().toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '');
  };
  var encabezados = valores[0].map(norm);
  var iTipo = encabezados.indexOf(norm('TIPO_VEHICULO'));
  var iPlaca = encabezados.indexOf(norm('PLACA'));
  var iUsuario = encabezados.indexOf(norm('USUARIO'));
  if (iTipo < 0) throw new Error('No existe la columna TIPO_VEHICULO en VEHICULOS.');

  // Recorremos desde abajo porque el registro nuevo normalmente es la última coincidencia.
  for (var i = valores.length - 1; i >= 1; i--) {
    var coincidePlaca = iPlaca >= 0 && norm(valores[i][iPlaca]) === norm(datos.placa);
    var coincideUsuario = iUsuario >= 0 && norm(valores[i][iUsuario]) === norm(datos.usuario);
    if (coincidePlaca && coincideUsuario) {
      sh.getRange(i + 1, iTipo + 1).setValue(tipo);
      break;
    }
  }
  return resultado;
}
