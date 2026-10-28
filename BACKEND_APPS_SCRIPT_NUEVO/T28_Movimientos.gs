// ==========================================================
// TORRE 28 - MOVIMIENTOS
// Archivo separado del proyecto Torre 28.
// NO dupliques estas funciones en Código.gs.
// ==========================================================

function obtenerCatalogosIngresoWeb() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const out = { visitantes: [], personal: [], encargadoDia: null };

  // VISITANTES
  const hv = ss.getSheetByName("VISITANTES");
  if (hv && hv.getLastRow() >= 2) {
    const d = hv.getDataRange().getDisplayValues();
    const h = d[0];
    const ci = indiceCabeceraEst_(h, ["id"]);
    const cu = indiceCabeceraEst_(h, ["usuario", "nombre"]);
    const cp = indiceCabeceraEst_(h, ["placa"]);
    const ce = indiceCabeceraEst_(h, ["empresa"]);
    const co = indiceCabeceraEst_(h, ["observaciones", "observacion"]);
    const ct = indiceCabeceraEst_(h, ["tipo_vehiculo", "tipo vehiculo"]);

    for (let i = 1; i < d.length; i++) {
      const f = d[i];
      const placa = cp >= 0 ? String(f[cp] || "").trim() : "";
      if (!placa) continue;

      out.visitantes.push({
        id: ci >= 0 ? f[ci] : "",
        usuario: cu >= 0 ? f[cu] : "",
        placa: placa,
        empresa: ce >= 0 ? f[ce] : "",
        observaciones: co >= 0 ? f[co] : "",
        tipoVehiculo: ct >= 0 ? f[ct] : ""
      });
    }
  }

  // PERSONAL_APP - estructura real:
  // A = ID_PERSONAL, B = NOMBRE, C = IMAGEN
  const hp = ss.getSheetByName("PERSONAL_APP");
  if (hp && hp.getLastRow() >= 2) {
    const datos = hp.getRange(2, 1, hp.getLastRow() - 1, Math.min(3, hp.getLastColumn())).getDisplayValues();

    datos.forEach(f => {
      const id = String(f[0] || "").trim();
      const nombre = String(f[1] || "").trim();
      const imagen = f.length >= 3 ? String(f[2] || "") : "";
      if (!id || !nombre) return;

      out.personal.push({
        id: id,
        nombre: nombre,
        imagen: imagen
      });
    });
  }

  // CONFIG_APP!B2 contiene el ID_PERSONAL del responsable actual.
  const hc = ss.getSheetByName("CONFIG_APP");
  out.responsableId = "";

  if (hc) {
    const idResponsable = String(hc.getRange("B2").getDisplayValue() || "").trim();
    out.responsableId = idResponsable;

    if (idResponsable) {
      const persona = out.personal.find(p => String(p.id).trim() === idResponsable);
      out.encargadoDia = {
        id: idResponsable,
        nombre: persona ? persona.nombre : ""
      };
    }
  }

  return out;
}


function obtenerResponsableTurnoWeb() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaPersonal = ss.getSheetByName("PERSONAL_APP");
  const hojaConfig = ss.getSheetByName("CONFIG_APP");

  if (!hojaPersonal) throw new Error("No se encontró PERSONAL_APP.");
  if (!hojaConfig) throw new Error("No se encontró CONFIG_APP.");

  const salida = {
    personal: [],
    responsable: null
  };

  // PERSONAL_APP:
  // A = ID_PERSONAL
  // B = NOMBRE
  const lastRowPersonal = hojaPersonal.getLastRow();
  if (lastRowPersonal >= 2) {
    const datos = hojaPersonal
      .getRange(2, 1, lastRowPersonal - 1, 2)
      .getDisplayValues();

    datos.forEach(f => {
      const id = String(f[0] || "").trim();
      const nombre = String(f[1] || "").trim();
      if (!id || !nombre) return;

      salida.personal.push({
        id: id,
        nombre: nombre
      });
    });
  }

  // CONFIG_APP:
  // A2 = CONFIG
  // B2 = RESPONSABLE_TURNO
  const idResponsable = String(hojaConfig.getRange("B2").getDisplayValue() || "").trim();

  if (idResponsable) {
    const persona = salida.personal.find(p => String(p.id) === idResponsable);

    salida.responsable = {
      id: idResponsable,
      nombre: persona ? persona.nombre : ""
    };
  }

  return salida;
}


function obtenerEncargadoDiaWeb() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaConfig = ss.getSheetByName("CONFIG_APP");
  const hojaPersonal = ss.getSheetByName("PERSONAL_APP");

  if (!hojaConfig || hojaConfig.getLastRow() < 2) return null;
  if (!hojaPersonal || hojaPersonal.getLastRow() < 2) return null;

  // CONFIG_APP:
  // ID_CONFIG | RESPONSABLE_TURNO
  const config = hojaConfig.getDataRange().getDisplayValues();
  const hConfig = config[0];
  const cIdConfig = indiceCabeceraEst_(hConfig, ["id_config", "id config", "id"]);
  const cResponsable = indiceCabeceraEst_(hConfig, [
    "responsable_turno", "responsable turno", "responsable"
  ]);

  if (cResponsable < 0) return null;

  let idResponsable = "";

  // Preferimos la fila cuya ID_CONFIG sea CONFIG.
  for (let i = 1; i < config.length; i++) {
    const idCfg = cIdConfig >= 0 ? String(config[i][cIdConfig] || "").trim() : "";
    if (normalizarCabeceraEst_(idCfg) === "config") {
      idResponsable = String(config[i][cResponsable] || "").trim();
      break;
    }
  }

  // Compatibilidad: si no existe ID_CONFIG o no encontramos CONFIG,
  // tomamos la primera fila de datos.
  if (!idResponsable && config.length >= 2) {
    idResponsable = String(config[1][cResponsable] || "").trim();
  }

  if (!idResponsable) return null;

  // Resolver ID contra PERSONAL_APP.
  const personal = hojaPersonal.getDataRange().getDisplayValues();
  const hPersonal = personal[0];
  const cId = indiceCabeceraEst_(hPersonal, ["id_personal", "id personal", "id"]);
  const cNombre = indiceCabeceraEst_(hPersonal, ["nombre", "nombres"]);

  if (cId < 0 || cNombre < 0) return null;

  for (let i = 1; i < personal.length; i++) {
    if (String(personal[i][cId] || "").trim() === idResponsable) {
      return {
        id: idResponsable,
        nombre: String(personal[i][cNombre] || "").trim()
      };
    }
  }

  return null;
}


function guardarEncargadoDiaWeb(datos) {
  if (!datos || !datos.id) {
    throw new Error("Selecciona al responsable del turno.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaPersonal = ss.getSheetByName("PERSONAL_APP");
  const hojaConfig = ss.getSheetByName("CONFIG_APP");

  if (!hojaPersonal) throw new Error("No se encontró PERSONAL_APP.");
  if (!hojaConfig) throw new Error("No se encontró CONFIG_APP.");

  const idBuscado = String(datos.id).trim();
  let nombreReal = "";

  const lastRowPersonal = hojaPersonal.getLastRow();
  if (lastRowPersonal >= 2) {
    const datosPersonal = hojaPersonal
      .getRange(2, 1, lastRowPersonal - 1, 2)
      .getDisplayValues();

    for (let i = 0; i < datosPersonal.length; i++) {
      const id = String(datosPersonal[i][0] || "").trim();
      if (id === idBuscado) {
        nombreReal = String(datosPersonal[i][1] || "").trim();
        break;
      }
    }
  }

  if (!nombreReal) {
    throw new Error("El responsable seleccionado no existe en PERSONAL_APP.");
  }

  // Mantener tu estructura AppSheet:
  // A2 = CONFIG
  // B2 = ID_PERSONAL responsable
  hojaConfig.getRange("A2").setValue("CONFIG");
  hojaConfig.getRange("B2").setValue(idBuscado);

  SpreadsheetApp.flush();

  return {
    id: idBuscado,
    nombre: nombreReal
  };
}


function normalizarPlacaT28_(valor) {
  const limpio = String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!limpio) return "";
  if (limpio.length <= 3) return limpio;

  return limpio.substring(0, 3) + " " + limpio.substring(3);
}


function validarEstacionamientoDisponibleHoyWeb(estacionamiento, filaExcluir, idExcluir) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("MOVIMIENTOS");

  if (!hoja || hoja.getLastRow() < 2 || !estacionamiento) {
    return { ocupado: false };
  }

  const lastCol = hoja.getLastColumn();
  const headers = hoja.getRange(1, 1, 1, lastCol).getValues()[0];
  const idx = aliases => indiceCabeceraEst_(headers, aliases);

  const cId = idx(["id"]);
  const cEst = idx(["estacionamiento", "est", "puesto"]);
  const cEstado = idx(["estado"]);
  const cEntrada = idx(["horaentrada", "hora entrada"]);
  const cPlaca = idx(["placaingreso", "placa ingreso", "placa"]);
  const cNombre = idx(["nombresprincipal", "nombres principal"]);

  if (cEst < 0 || cEstado < 0 || cEntrada < 0) {
    return { ocupado: false };
  }

  const tz = Session.getScriptTimeZone() || "America/Lima";
  const hoy = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  const valores = hoja.getRange(2, 1, hoja.getLastRow() - 1, lastCol).getValues();

  for (let i = valores.length - 1; i >= 0; i--) {
    const fila = valores[i];
    const filaReal = i + 2;

    if (filaExcluir && Number(filaExcluir) === Number(filaReal)) continue;
    if (idExcluir && cId >= 0 && String(fila[cId] || "").trim() === String(idExcluir).trim()) continue;

    if (String(fila[cEst] || "").trim() !== String(estacionamiento).trim()) continue;
    if (!String(fila[cEstado] || "").toLowerCase().includes("abierto")) continue;

    const entrada = fila[cEntrada] instanceof Date ? fila[cEntrada] : new Date(fila[cEntrada]);
    if (!(entrada instanceof Date) || isNaN(entrada.getTime())) continue;

    const fechaEntrada = Utilities.formatDate(entrada, tz, "yyyy-MM-dd");
    if (fechaEntrada !== hoy) continue;

    return {
      ocupado: true,
      movimiento: {
        filaIndex: filaReal,
        id: cId >= 0 ? String(fila[cId] || "") : "",
        est: String(fila[cEst] || ""),
        nombre: cNombre >= 0 ? String(fila[cNombre] || "Sin nombre") : "Sin nombre",
        placa: cPlaca >= 0 ? normalizarPlacaT28_(fila[cPlaca]) : "---",
        horaEntrada: Utilities.formatDate(entrada, tz, "dd/MM/yyyy HH:mm:ss"),
        estado: "Abierto"
      }
    };
  }

  return { ocupado: false };
}


function t28RegistrarMovimientoSinBloqueo_(datos) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const hoja=ss.getSheetByName("MOVIMIENTOS");
  if(!hoja) throw new Error("No se encontró la pestaña MOVIMIENTOS.");

  const lastCol=hoja.getLastColumn();
  const headers=hoja.getRange(1,1,1,lastCol).getValues()[0];
  const idx=a=>indiceCabeceraEst_(headers,a);

  const cId=idx(["id"]);
  const cPlaca=idx(["placaingreso","placa ingreso","placa"]);
  const cNombre=idx(["nombresprincipal","nombres principal"]);
  const cTipoDoc=idx(["tipodocumento","tipo documento"]);
  const cNroDoc=idx(["n°","nro","numero documento","número documento"]);
  const cEntrada=idx(["horaentrada","hora entrada"]);
  const cSalida=idx(["horasalida","hora salida"]);
  const cEmpresa=idx(["empresa","oficina"]);
  const cEst=idx(["estacionamiento","est","puesto"]);
  const cTipoIng=idx(["tipoingreso","tipo ingreso"]);
  const cObs=idx(["observaciones","observacion"]);
  const cEstado=idx(["estado"]);
  const cRegPor=idx(["registradopor"]);
  const cRegNombre=idx(["registradopornombre","registrado por nombre"]);
  const cCant=idx(["cantidadacompanantes","cantidad acompañantes"]);

  const cols=[
    [idx(["acomp1_nombre"]),idx(["acomp1_tipodoc"]),idx(["acomp1_documento"])],
    [idx(["acomp2_nombre"]),idx(["acomp2_tipodoc"]),idx(["acomp2_documento"])],
    [idx(["acomp3_nombre"]),idx(["acomp3_tipodoc"]),idx(["acomp3_documento"])]
  ];
  const cEstPrestado=idx(["estprestado","est prestado"]);

  const faltantes=[[cPlaca,"PlacaIngreso"],[cNombre,"NombresPrincipal"],[cEntrada,"HoraEntrada"],[cEmpresa,"Empresa"],[cEst,"Estacionamiento"],[cTipoIng,"TipoIngreso"],[cEstado,"Estado"]]
    .filter(x=>x[0]===-1).map(x=>x[1]);
  if(faltantes.length) throw new Error("Faltan columnas en MOVIMIENTOS: "+faltantes.join(", "));

  if(!datos||!datos.placa||!datos.nombre||!datos.empresa||!datos.estacionamiento||!datos.horaEntrada||!datos.registradoPorId)
    throw new Error("Faltan datos obligatorios para registrar el ingreso.");

  const entrada=new Date(datos.horaEntrada);
  if(isNaN(entrada.getTime())) throw new Error("La hora de ingreso no es válida.");

  let salida="";
  if(datos.horaSalida){
    salida=new Date(datos.horaSalida);
    if(isNaN(salida.getTime())) throw new Error("La hora de salida no es válida.");
    if(salida<entrada) throw new Error("La hora de salida no puede ser anterior a la entrada.");
  }

  if (!datos.permitirEstacionamientoOcupado) {
    const disponibilidad = validarEstacionamientoDisponibleHoyWeb(datos.estacionamiento, null, null);
    if (disponibilidad.ocupado) {
      const m = disponibilidad.movimiento || {};
      throw new Error(
        "ESTACIONAMIENTO_OCUPADO|" +
        JSON.stringify({
          est: datos.estacionamiento,
          nombre: m.nombre || "Sin nombre",
          placa: m.placa || "---",
          horaEntrada: m.horaEntrada || ""
        })
      );
    }
  }

  const trabajador=String(datos.tipoIngreso||"Trabajador").toLowerCase()==="trabajador";
  const acomp=trabajador?[]:(Array.isArray(datos.acompanantes)?datos.acompanantes.slice(0,3):[]);
  const fila=new Array(lastCol).fill("");

  if(cId>=0) fila[cId]=datos._syncRecordId || Utilities.getUuid();
  fila[cPlaca]=normalizarPlacaT28_(datos.placa);
  fila[cNombre]=String(datos.nombre).trim();
  if(cTipoDoc>=0) fila[cTipoDoc]=trabajador?"":(datos.tipoDocumento||"");
  if(cNroDoc>=0) fila[cNroDoc]=trabajador?"":(datos.numeroDocumento||"");
  fila[cEntrada]=entrada;
  if(cSalida>=0) fila[cSalida]=salida||"";
  fila[cEmpresa]=String(datos.empresa).trim();
  fila[cEst]=datos.estacionamiento;
  fila[cTipoIng]=datos.tipoIngreso||"Trabajador";
  if(cObs>=0) fila[cObs]=datos.observaciones||"";
  fila[cEstado]=salida?"Cerrado":"Abierto";
  if(cRegPor>=0) fila[cRegPor]=datos.registradoPorId||"";
  if(cRegNombre>=0) fila[cRegNombre]=datos.registradoPorNombre||"";
  if(cCant>=0) fila[cCant]=acomp.length;

  for(let i=0;i<3;i++){
    const p=acomp[i]||{};
    if(cols[i][0]>=0) fila[cols[i][0]]=p.nombre||"";
    if(cols[i][1]>=0) fila[cols[i][1]]=p.tipoDocumento||"";
    if(cols[i][2]>=0) fila[cols[i][2]]=p.documento||"";
  }

  if(cEstPrestado>=0) {
    const tipoEst = String(datos.tipoEstacionamiento || "Propio").trim();
    fila[cEstPrestado] = /^prestado$/i.test(tipoEst) ? "Prestado" : "Propio";
  }

  hoja.appendRow(fila);
  const nr=hoja.getLastRow();
  hoja.getRange(nr,cEntrada+1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
  if(cSalida>=0&&salida) hoja.getRange(nr,cSalida+1).setNumberFormat("dd/MM/yyyy HH:mm:ss");

  return {success:true,message:"Ingreso registrado correctamente",filaIndex:nr};
}


function obtenerMovimientosHoy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("MOVIMIENTOS");
  if (!hoja) return [];

  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return [];

  const filaInicio = Math.max(2, ultimaFila - 250);
  const numFilas = ultimaFila - filaInicio + 1;
  const lastCol = hoja.getLastColumn();
  const rawValues = hoja.getRange(filaInicio, 1, numFilas, lastCol).getDisplayValues();
  const headers = hoja.getRange(1, 1, 1, lastCol).getValues()[0];

  const idx = aliases => indiceCabeceraEst_(headers, aliases);

  const cId = idx(["id"]);
  const cPlaca = idx(["placaingreso", "placa ingreso", "placa"]);
  const cNombre = idx(["nombresprincipal", "nombres principal"]);
  const cTipoDoc = idx(["tipodocumento", "tipo documento"]);
  const cNro = idx(["n°", "nro", "numero documento", "número documento"]);
  const cEntrada = idx(["horaentrada", "hora entrada"]);
  const cSalida = idx(["horasalida", "hora salida"]);
  const cEmpresa = idx(["empresa"]);
  const cEst = idx(["estacionamiento"]);
  const cTipoIng = idx(["tipoingreso", "tipo ingreso"]);
  const cObs = idx(["observaciones", "observacion"]);
  const cEstado = idx(["estado"]);
  const cRegPorId = idx(["registradopor"]);
  const cRegPorNombre = idx(["registradopornombre", "registrado por nombre"]);
  const cCant = idx(["cantidadacompanantes", "cantidad acompañantes"]);
  const cEstPrestado = idx(["estprestado", "est prestado"]);

  const acompCols = [
    [idx(["acomp1_nombre"]), idx(["acomp1_tipodoc"]), idx(["acomp1_documento"])],
    [idx(["acomp2_nombre"]), idx(["acomp2_tipodoc"]), idx(["acomp2_documento"])],
    [idx(["acomp3_nombre"]), idx(["acomp3_tipodoc"]), idx(["acomp3_documento"])]
  ];

  const hoyStr = Utilities.formatDate(new Date(), ZONA, "dd/MM/yyyy");
  const registrosHoy = [];

  for (let i = 0; i < rawValues.length; i++) {
    const fila = rawValues[i];
    const horaEntradaVal = cEntrada >= 0 ? fila[cEntrada] : "";

    if (!horaEntradaVal || !String(horaEntradaVal).includes(hoyStr)) continue;

    const acompanantes = [];
    for (let j = 0; j < acompCols.length; j++) {
      const cols = acompCols[j];
      const nombre = cols[0] >= 0 ? String(fila[cols[0]] || "").trim() : "";
      const tipoDoc = cols[1] >= 0 ? String(fila[cols[1]] || "").trim() : "";
      const documento = cols[2] >= 0 ? String(fila[cols[2]] || "").trim() : "";
      if (nombre || tipoDoc || documento) {
        acompanantes.push({
          nombre: nombre,
          tipoDocumento: tipoDoc,
          documento: documento
        });
      }
    }

    const tipoDoc = cTipoDoc >= 0 ? fila[cTipoDoc] : "";
    const nroDoc = cNro >= 0 ? fila[cNro] : "";

    registrosHoy.push({
      _version: t28MovVersion_(fila),
      filaIndex: filaInicio + i,
      id: cId >= 0 ? fila[cId] : "",
      placa: cPlaca >= 0 ? (fila[cPlaca] || "---") : "---",
      nombre: cNombre >= 0 ? (fila[cNombre] || "Sin Nombre") : "Sin Nombre",
      tipoDocumento: tipoDoc || "",
      numeroDocumento: nroDoc || "",
      documento: [tipoDoc, nroDoc].filter(Boolean).join(" "),
      horaEntrada: horaEntradaVal,
      horaSalida: cSalida >= 0 ? (fila[cSalida] || "---") : "---",
      empresa: cEmpresa >= 0 ? (fila[cEmpresa] || "N/A") : "N/A",
      est: cEst >= 0 ? (fila[cEst] || "N/A") : "N/A",
      tipoIngreso: cTipoIng >= 0 ? (fila[cTipoIng] || "N/A") : "N/A",
      observaciones: cObs >= 0 ? (fila[cObs] || "") : "",
      estado: cEstado >= 0 ? (fila[cEstado] || "Abierto") : "Abierto",
      registradoPorId: cRegPorId >= 0 ? (fila[cRegPorId] || "") : "",
      registradoPor: cRegPorNombre >= 0 ? (fila[cRegPorNombre] || "Sistema") : "Sistema",
      cantidadAcompanantes: cCant >= 0 ? Number(fila[cCant] || acompanantes.length) : acompanantes.length,
      acompanantes: acompanantes,
      estPrestado: cEstPrestado >= 0 ? (fila[cEstPrestado] || "") : ""
    });
  }

  return registrosHoy.reverse();
}




/** PATCH for the existing T28_Movimientos.gs, NOT a second file to upload.
 * Replace the functions with the same names. Rename the old registrarMovimientoWeb
 * to t28RegistrarMovimientoSinBloqueo_ and add this wrapper. Add `_version:
 * t28MovVersion_(fila)` to each result in obtenerMovimientosHoy().
 * No existing sheet, column, ID, formula or AppSheet configuration is changed.
 */
function t28MovConBloqueo_(trabajo) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    const error = new Error('Hay otro guardado en curso. El registro se conserva en tu equipo; revisa Movimientos antes de repetir.');
    error.t28Code = 'BUSY';
    throw error;
  }
  try { return trabajo(); }
  finally { lock.releaseLock(); }
}

function t28MovVersion_(fila) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, JSON.stringify(fila.map(String)), Utilities.Charset.UTF_8
  ));
}

function t28MovError_(mensaje, codigo) {
  const error = new Error(mensaje);
  error.t28Code = codigo || 'VALIDATION_ERROR';
  throw error;
}

function t28MovFechas_(datos) {
  const entrada = new Date(datos && datos.horaEntrada);
  const salida = datos && datos.horaSalida ? new Date(datos.horaSalida) : '';
  if (isNaN(entrada.getTime())) t28MovError_('La hora de entrada no es válida.');
  if (salida && isNaN(salida.getTime())) t28MovError_('La hora de salida no es válida.');
  if (salida && salida < entrada) t28MovError_('La hora de salida no puede ser anterior a la entrada.');
  return { entrada: entrada, salida: salida };
}

function registrarMovimientoWeb(datos) {
  t28MovFechas_(datos);
  const safe = Object.assign({}, datos);
  delete safe._syncRecordId;
  return t28MovConBloqueo_(function () { return t28RegistrarMovimientoSinBloqueo_(safe); });
}

function validarMovimientoExacto_(hoja, filaIndex, idEsperado, versionEsperada) {
  let fila = parseInt(filaIndex, 10);
  const lastRow = hoja.getLastRow(), lastCol = hoja.getLastColumn();
  const headers = hoja.getRange(1, 1, 1, lastCol).getValues()[0];
  const cId = indiceCabeceraEst_(headers, ['id']);
  const id = String(idEsperado || '').trim();
  if (id && cId >= 0) {
    // A row number is only a hint. AppSheet or another user can move a row.
    if (!(fila >= 2 && fila <= lastRow) ||
        String(hoja.getRange(fila, cId + 1).getDisplayValue()).trim() !== id) {
      const matches = lastRow >= 2 ? hoja.getRange(2, cId + 1, lastRow - 1, 1)
        .createTextFinder(id).matchEntireCell(true).matchCase(true).useRegularExpression(false).findAll() : [];
      if (matches.length !== 1) t28MovError_('El registro fue eliminado o su ID no es único. Sincroniza y revisa los cambios.', 'CONFLICT');
      fila = matches[0].getRow();
    }
  }
  if (!fila || fila < 2 || fila > lastRow) t28MovError_('El registro ya no está disponible. Sincroniza y revisa los cambios.', 'CONFLICT');
  const rango = hoja.getRange(fila, 1, 1, lastCol);
  const version = t28MovVersion_(rango.getDisplayValues()[0]);
  if (versionEsperada && version !== versionEsperada) {
    t28MovError_('Este movimiento cambió desde que lo abriste. Conservamos tus datos en este equipo; sincroniza y compara antes de guardar.', 'CONFLICT');
  }
  const valores = rango.getValues()[0];
  const formulas = rango.getFormulas()[0];
  // setValues must preserve formulas in columns not edited by this form.
  const filaCompleta = valores.map(function (valor, i) { return formulas[i] || valor; });
  return { fila: fila, headers: headers, rango: rango, hoja: hoja, valores: valores, filaCompleta: filaCompleta, version: version };
}

function t28MovGuardarFila_(ver) {
  // AppSheet does not participate in LockService. Recheck immediately before
  // committing, including when an older client did not send a base version.
  if (t28MovVersion_(ver.rango.getDisplayValues()[0]) !== ver.version) {
    t28MovError_('El registro cambió durante el guardado. Sincroniza y compara tus datos.', 'CONFLICT');
  }
  ver.rango.setValues([ver.filaCompleta]);
  [['horaentrada', 'hora entrada'], ['horasalida', 'hora salida']].forEach(function(aliases) {
    const c = indiceCabeceraEst_(ver.headers, aliases);
    if (c >= 0) ver.hoja.getRange(ver.fila, c + 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  });
}

function actualizarMovimientoWeb(datos) {
  return t28MovConBloqueo_(function () { return t28ActualizarMovimientoSinBloqueo_(datos); });
}

function t28ActualizarMovimientoSinBloqueo_(datos) {
  // Validate everything before the first write, including companions and dates.
  const fechas = t28MovFechas_(datos);
  if (!datos || !datos.placa || !datos.nombre || !datos.empresa || !datos.estacionamiento || !datos.registradoPorId) {
    t28MovError_('Faltan datos obligatorios para actualizar el movimiento.');
  }
  const trabajador = String(datos.tipoIngreso || '').toLowerCase() === 'trabajador';
  const acompanantes = trabajador ? [] : (Array.isArray(datos.acompanantes) ? datos.acompanantes : []);
  if (acompanantes.length > 3 || acompanantes.some(function (p) { return !p || !String(p.nombre || '').trim(); })) {
    t28MovError_('Revisa los nombres de los acompañantes; se permiten como máximo tres.');
  }
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('MOVIMIENTOS');
    if (!hoja) t28MovError_('No se encontró MOVIMIENTOS.');
    const ver = validarMovimientoExacto_(hoja, datos.filaIndex, datos.id, datos._expectedVersion);
    const idx = function (aliases) { return indiceCabeceraEst_(ver.headers, aliases); };
    if (idx(['horaentrada', 'hora entrada']) < 0 || idx(['horasalida', 'hora salida']) < 0 || idx(['estado']) < 0) {
      t28MovError_('Faltan columnas de fecha o estado en MOVIMIENTOS.');
    }
    if (!datos.permitirEstacionamientoOcupado && !fechas.salida) {
      const disponibilidad = validarEstacionamientoDisponibleHoyWeb(datos.estacionamiento, ver.fila, datos.id);
      if (disponibilidad.ocupado) {
        const m = disponibilidad.movimiento || {};
        t28MovError_('ESTACIONAMIENTO_OCUPADO|' + JSON.stringify({ est: datos.estacionamiento,
          nombre: m.nombre || 'Sin nombre', placa: m.placa || '---', horaEntrada: m.horaEntrada || '' }));
      }
    }
    const set = function (aliases, valor) { const c = idx(aliases); if (c >= 0) ver.filaCompleta[c] = valor; };
    set(['placaingreso', 'placa ingreso', 'placa'], normalizarPlacaT28_(datos.placa));
    set(['nombresprincipal', 'nombres principal'], String(datos.nombre).trim());
    set(['tipodocumento', 'tipo documento'], trabajador ? '' : datos.tipoDocumento || '');
    set(['n°', 'nro', 'numero documento', 'número documento'], trabajador ? '' : datos.numeroDocumento || '');
    set(['empresa'], datos.empresa);
    set(['estacionamiento'], datos.estacionamiento);
    set(['tipoingreso', 'tipo ingreso'], datos.tipoIngreso || '');
    set(['observaciones', 'observacion'], datos.observaciones || '');
    set(['registradopor'], datos.registradoPorId);
    set(['registradopornombre', 'registrado por nombre'], datos.registradoPorNombre || '');
    set(['estprestado', 'est prestado'], /^prestado$/i.test(String(datos.tipoEstacionamiento || 'Propio').trim()) ? 'Prestado' : 'Propio');
    set(['horaentrada', 'hora entrada'], fechas.entrada);
    set(['horasalida', 'hora salida'], fechas.salida);
    set(['estado'], fechas.salida ? 'Cerrado' : 'Abierto');
    set(['cantidadacompanantes', 'cantidad acompañantes'], acompanantes.length);
    for (let i = 0; i < 3; i++) {
      const p = acompanantes[i] || {}, n = i + 1;
      set(['acomp' + n + '_nombre'], p.nombre || '');
      set(['acomp' + n + '_tipodoc'], p.tipoDocumento || '');
      set(['acomp' + n + '_documento'], p.documento || '');
    }
    t28MovGuardarFila_(ver);
    return { success: true, message: 'Movimiento actualizado correctamente', filaIndex: ver.fila };
}

function registrarSalidaMovimientoWeb(datos) {
  return t28MovConBloqueo_(function () { return t28RegistrarSalidaSinBloqueo_(datos); });
}

function t28RegistrarSalidaSinBloqueo_(datos) {
  const salida = new Date(datos && datos.horaSalida);
  if (isNaN(salida.getTime())) t28MovError_('La hora de salida no es válida.');
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('MOVIMIENTOS');
    if (!hoja) t28MovError_('No se encontró MOVIMIENTOS.');
    const ver = validarMovimientoExacto_(hoja, datos.filaIndex, datos.id, datos._expectedVersion);
    const cEntrada = indiceCabeceraEst_(ver.headers, ['horaentrada', 'hora entrada']);
    const cSalida = indiceCabeceraEst_(ver.headers, ['horasalida', 'hora salida']);
    const cEstado = indiceCabeceraEst_(ver.headers, ['estado']);
    if (cEntrada < 0 || cSalida < 0 || cEstado < 0) t28MovError_('Faltan columnas de fecha o estado en MOVIMIENTOS.');
    const entrada = new Date(ver.valores[cEntrada]);
    if (isNaN(entrada.getTime()) || salida < entrada) t28MovError_('La salida no puede ser anterior a la hora de ingreso.');
    ver.filaCompleta[cSalida] = salida;
    ver.filaCompleta[cEstado] = 'Cerrado';
    t28MovGuardarFila_(ver);
    return { success: true, message: 'Salida registrada correctamente', filaIndex: ver.fila };
}

function eliminarMovimientoWeb(datos) {
  return t28MovConBloqueo_(function () {
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('MOVIMIENTOS');
    if (!hoja) t28MovError_('No se encontró MOVIMIENTOS.');
    const ver = validarMovimientoExacto_(hoja, datos.filaIndex, datos.id, datos._expectedVersion);
    hoja.deleteRow(ver.fila);
    return { success: true, message: 'Registro eliminado correctamente' };
  });
}

