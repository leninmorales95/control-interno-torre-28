/**
 * TORRE 28 - EMPRESAS Y LOGOS
 * Hoja EMPRESAS: A Empresa, B Logo, C Observaciones.
 */

const T28_EMPRESAS_SHEET = 'EMPRESAS';
const T28_EMPRESAS_FOLDER = 'EMPRESAS_Images';
const T28_EMPRESA_MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function probarEmpresasT28() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(T28_EMPRESAS_SHEET);
  if (!sh) throw new Error('No existe la hoja "' + T28_EMPRESAS_SHEET + '".');
  return {
    ok: true,
    hoja: sh.getName(),
    filas: Math.max(0, sh.getLastRow() - 1),
    columnas: sh.getLastColumn()
  };
}

function obtenerEmpresasWebT28(incluirLogos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(T28_EMPRESAS_SHEET);
  if (!sh) throw new Error('No existe la hoja "' + T28_EMPRESAS_SHEET + '".');

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const values = sh.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
  const cargarLogos = Boolean(incluirLogos);
  const archivosLogo = cargarLogos ? t28MapaLogosEmpresas_(ss) : null;

  return values.map(function(row, i) {
    const empresa = String(row[0] || '').trim();
    const logo = String(row[1] || '').trim();
    const observaciones = String(row[2] || '').trim();
    if (!empresa) return null;

    let logoDataUrl = '';
    let logoError = '';
    if (cargarLogos && logo) {
      try {
        logoDataUrl = t28EmpresaLogoDataUrl_(ss, logo, archivosLogo);
      } catch (err) {
        logoError = err && err.message ? err.message : String(err);
      }
    }

    return {
      filaIndex: i + 2,
      empresa: empresa,
      logo: logo,
      observaciones: observaciones,
      logoDataUrl: logoDataUrl,
      logoError: logoError
    };
  }).filter(Boolean).sort(function(a, b) {
    return a.empresa.localeCompare(b.empresa, 'es', { sensitivity: 'base' });
  });
}

function guardarEmpresaWebT28(datos) {
  datos = datos || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(T28_EMPRESAS_SHEET);
  if (!sh) throw new Error('No existe la hoja "' + T28_EMPRESAS_SHEET + '".');

  const filaIndex = Number(datos.filaIndex || 0);
  const empresa = String(datos.empresa || '').trim();
  const observaciones = String(datos.observaciones || '').trim();
  const imagenDataUrl = String(datos.imagenDataUrl || '').trim();
  if (!empresa) throw new Error('El nombre de la empresa es obligatorio.');

  const lastRow = sh.getLastRow();
  const existentes = lastRow >= 2
    ? sh.getRange(2, 1, lastRow - 1, 3).getDisplayValues()
    : [];
  const claveNueva = t28NormalizarEmpresa_(empresa);

  existentes.forEach(function(row, i) {
    const fila = i + 2;
    if (filaIndex && fila === filaIndex) return;
    if (t28NormalizarEmpresa_(row[0]) === claveNueva) {
      throw new Error('Ya existe una empresa llamada "' + empresa + '".');
    }
  });

  let filaDestino = filaIndex;
  let logoActual = '';
  if (filaDestino) {
    if (filaDestino < 2 || filaDestino > Math.max(sh.getLastRow(), 2)) {
      throw new Error('La fila de empresa ya no es válida.');
    }
    logoActual = String(sh.getRange(filaDestino, 2).getDisplayValue() || '').trim();
  } else {
    filaDestino = Math.max(sh.getLastRow() + 1, 2);
  }

  let logoRuta = logoActual;
  let logoDataUrl = '';
  if (imagenDataUrl) {
    const guardado = t28GuardarLogoEmpresa_(ss, empresa, imagenDataUrl);
    logoRuta = guardado.ruta;
    logoDataUrl = guardado.dataUrl;
  } else if (logoActual) {
    try {
      logoDataUrl = t28EmpresaLogoDataUrl_(ss, logoActual);
    } catch (e) {
      logoDataUrl = '';
    }
  }

  sh.getRange(filaDestino, 1, 1, 3).setValues([[empresa, logoRuta, observaciones]]);
  SpreadsheetApp.flush();

  return {
    filaIndex: filaDestino,
    empresa: empresa,
    logo: logoRuta,
    observaciones: observaciones,
    logoDataUrl: logoDataUrl,
    logoError: ''
  };
}

function t28GuardarLogoEmpresa_(ss, empresa, dataUrl) {
  const match = String(dataUrl).match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i);
  if (!match) throw new Error('El formato de imagen no es válido.');

  const mime = match[1].toLowerCase();
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > T28_EMPRESA_MAX_IMAGE_BYTES) {
    throw new Error('La imagen supera el límite de 3 MB.');
  }

  const ext = mime === 'image/jpeg' ? 'jpg' : (mime === 'image/webp' ? 'webp' : 'png');
  const folder = t28ObtenerCarpetaEmpresas_(ss, true);
  const nombreSeguro = String(empresa || 'EMPRESA')
    .replace(/[\\/:*?"<>|#%{}~&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);
  const sello = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || 'America/Lima',
    'yyyyMMdd.HHmmss'
  );
  const fileName = nombreSeguro + '.Logo.' + sello + '.' + ext;
  const blob = Utilities.newBlob(bytes, mime, fileName);
  folder.createFile(blob);

  return {
    ruta: T28_EMPRESAS_FOLDER + '/' + fileName,
    dataUrl: 'data:' + mime + ';base64,' + Utilities.base64Encode(bytes)
  };
}

function t28MapaLogosEmpresas_(ss) {
  const mapa = {};
  const folder = t28ObtenerCarpetaEmpresas_(ss, false);
  if (!folder) return mapa;

  const archivos = folder.getFiles();
  while (archivos.hasNext()) {
    const archivo = archivos.next();
    mapa[archivo.getName()] = archivo;
  }
  return mapa;
}

function t28EmpresaLogoDataUrl_(ss, valorLogo, archivosLogo) {
  const valor = String(valorLogo || '').trim();
  if (!valor) return '';

  let file = null;
  const id = t28ExtraerDriveId_(valor);
  if (id) {
    try { file = DriveApp.getFileById(id); } catch (e) {}
  }

  const fileName = valor.split('/').pop();
  if (!file && archivosLogo && fileName && archivosLogo[fileName]) {
    file = archivosLogo[fileName];
  }

  if (!file) {
    const folder = t28ObtenerCarpetaEmpresas_(ss, false);
    if (folder && fileName) {
      const dentro = folder.getFilesByName(fileName);
      if (dentro.hasNext()) file = dentro.next();
    }
  }

  if (!file && fileName) {
    const globales = DriveApp.getFilesByName(fileName);
    if (globales.hasNext()) file = globales.next();
  }
  if (!file) throw new Error('No se encontró el archivo de logo: ' + valor);

  const blob = file.getBlob();
  const mime = String(blob.getContentType() || '').toLowerCase();
  if (mime.indexOf('image/') !== 0) {
    throw new Error('El archivo no es una imagen: ' + file.getName());
  }

  const bytes = blob.getBytes();
  return 'data:' + mime + ';base64,' + Utilities.base64Encode(bytes);
}

function t28ObtenerCarpetaEmpresas_(ss, crearSiNoExiste) {
  let parent = null;
  try {
    const archivo = DriveApp.getFileById(ss.getId());
    const padres = archivo.getParents();
    if (padres.hasNext()) parent = padres.next();
  } catch (e) {}

  if (parent) {
    const folders = parent.getFoldersByName(T28_EMPRESAS_FOLDER);
    if (folders.hasNext()) return folders.next();
    if (crearSiNoExiste) return parent.createFolder(T28_EMPRESAS_FOLDER);
  }

  const globales = DriveApp.getFoldersByName(T28_EMPRESAS_FOLDER);
  if (globales.hasNext()) return globales.next();
  if (crearSiNoExiste) return DriveApp.createFolder(T28_EMPRESAS_FOLDER);
  return null;
}

function t28ExtraerDriveId_(valor) {
  const s = String(valor || '').trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  let m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : '';
}

function t28NormalizarEmpresa_(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
